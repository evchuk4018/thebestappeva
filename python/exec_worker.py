from __future__ import annotations

import builtins
import contextlib
import io
import json
import os
import socket
import sys
import time
import traceback
from typing import Any


def _normalize(path: str) -> str:
    return os.path.normcase(os.path.abspath(path))


def _guard_path(
    path_value: str | bytes | os.PathLike[str] | os.PathLike[bytes],
    allowed_read_roots: list[str],
    allowed_write_roots: list[str],
    mode: str,
) -> None:
    candidate = _normalize(os.fspath(path_value))
    is_write = any(flag in mode for flag in ("w", "a", "+", "x"))
    allowed_roots = allowed_write_roots if is_write else allowed_read_roots
    if not any(candidate == root or candidate.startswith(root + os.sep) for root in allowed_roots):
        action = "write" if is_write else "read"
        raise PermissionError(f"Python sandbox cannot {action} outside the workspace: {path_value}")


def _install_guards(read_roots: list[str], write_roots: list[str]) -> None:
    original_open = builtins.open
    original_os_open = os.open
    original_remove = os.remove
    original_mkdir = os.mkdir
    original_makedirs = os.makedirs
    original_rename = os.rename
    original_replace = os.replace
    original_rmdir = os.rmdir
    original_unlink = os.unlink

    def guarded_open(file: Any, mode: str = "r", *args: Any, **kwargs: Any):
        _guard_path(file, read_roots, write_roots, mode)
        return original_open(file, mode, *args, **kwargs)

    def guarded_os_open(file: Any, flags: int, *args: Any, **kwargs: Any):
        mode = "r"
        if flags & (os.O_WRONLY | os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_TRUNC):
            mode = "w"
        _guard_path(file, read_roots, write_roots, mode)
        return original_os_open(file, flags, *args, **kwargs)

    def guarded_write_call(original: Any, target: Any, *args: Any, **kwargs: Any):
        _guard_path(target, read_roots, write_roots, "w")
        return original(target, *args, **kwargs)

    def _blocked(*_: Any, **__: Any) -> Any:
        raise OSError("Python sandbox network access is disabled.")

    builtins.open = guarded_open
    os.open = guarded_os_open
    os.remove = lambda target, *a, **kw: guarded_write_call(original_remove, target, *a, **kw)  # type: ignore[assignment]
    os.unlink = lambda target, *a, **kw: guarded_write_call(original_unlink, target, *a, **kw)  # type: ignore[assignment]
    os.mkdir = lambda target, *a, **kw: guarded_write_call(original_mkdir, target, *a, **kw)  # type: ignore[assignment]
    os.makedirs = lambda target, *a, **kw: guarded_write_call(original_makedirs, target, *a, **kw)  # type: ignore[assignment]
    os.rename = lambda src, dst, *a, **kw: (  # type: ignore[assignment]
        _guard_path(src, read_roots, write_roots, "w"),
        _guard_path(dst, read_roots, write_roots, "w"),
        original_rename(src, dst, *a, **kw),
    )[-1]
    os.replace = lambda src, dst, *a, **kw: (  # type: ignore[assignment]
        _guard_path(src, read_roots, write_roots, "w"),
        _guard_path(dst, read_roots, write_roots, "w"),
        original_replace(src, dst, *a, **kw),
    )[-1]
    os.rmdir = lambda target, *a, **kw: guarded_write_call(original_rmdir, target, *a, **kw)  # type: ignore[assignment]

    guarded_socket = type(socket.socket.__name__, (socket.socket,), {"connect": _blocked, "connect_ex": _blocked})
    socket.socket = guarded_socket  # type: ignore[assignment]
    socket.create_connection = _blocked  # type: ignore[assignment]


def _truncate(text: str, limit: int) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    return text[:limit], True


def _run_code(code: str, namespace: dict[str, Any], output_limit: int) -> dict[str, Any]:
    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()
    exit_code = 0
    started = time.perf_counter()
    with contextlib.redirect_stdout(stdout_buffer), contextlib.redirect_stderr(stderr_buffer):
        try:
            exec(compile(code, "python_exec.py", "exec"), namespace, namespace)
        except SystemExit as error:
            exit_code = int(error.code) if isinstance(error.code, int) else 1
        except Exception:
            exit_code = 1
            traceback.print_exc()
    stdout, stdout_truncated = _truncate(stdout_buffer.getvalue(), output_limit)
    stderr, stderr_truncated = _truncate(stderr_buffer.getvalue(), output_limit)
    return {
        "ok": True,
        "exitCode": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "durationMs": max(0, int(round((time.perf_counter() - started) * 1000))),
        "stdoutTruncated": stdout_truncated,
        "stderrTruncated": stderr_truncated,
    }


def _make_namespace() -> dict[str, Any]:
    return {"__name__": "__main__"}


def main() -> int:
    work_dir = os.getcwd()
    inputs_dir = os.environ.get("PYTHON_EXEC_INPUTS_DIR", "/inputs")
    read_roots = [_normalize(work_dir)]
    if os.path.isdir(inputs_dir):
        read_roots.append(_normalize(inputs_dir))
    _install_guards(read_roots, [_normalize(work_dir)])

    namespace = _make_namespace()
    writer = sys.stdout
    reader = sys.stdin

    for raw_line in reader:
        line = raw_line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            if not isinstance(payload, dict):
                raise ValueError("Expected an object payload.")
        except Exception as error:
            writer.write(json.dumps({"ok": False, "error": f"Invalid request: {error}"}) + "\n")
            writer.flush()
            continue

        kind = payload.get("type")
        request_id = payload.get("id")
        try:
            if kind == "exec":
                code = payload.get("code", "")
                output_limit = int(payload.get("outputCharLimit", 12000))
                result = _run_code(str(code), namespace, output_limit)
                result["id"] = request_id
                writer.write(json.dumps(result) + "\n")
            elif kind == "reset":
                namespace = _make_namespace()
                writer.write(json.dumps({"ok": True, "reset": True, "id": request_id}) + "\n")
            elif kind == "ping":
                writer.write(json.dumps({"ok": True, "pong": True, "id": request_id}) + "\n")
            elif kind == "quit":
                writer.write(json.dumps({"ok": True, "quit": True, "id": request_id}) + "\n")
                writer.flush()
                return 0
            else:
                writer.write(json.dumps({"ok": False, "error": f"Unknown request type: {kind}", "id": request_id}) + "\n")
        except Exception as error:
            writer.write(json.dumps({"ok": False, "error": str(error)}) + "\n")
        writer.flush()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())