from __future__ import annotations

import builtins
import contextlib
import io
import json
import os
import pathlib
import socket
import sys
import time
import traceback
from typing import Any


def _normalize(path: str) -> str:
    return os.path.normcase(os.path.abspath(path))


def _guard_path(path_value: str | bytes | os.PathLike[str] | os.PathLike[bytes], allowed_read_roots: list[str], allowed_write_roots: list[str], mode: str) -> None:
    candidate = _normalize(os.fspath(path_value))
    is_write = any(flag in mode for flag in ("w", "a", "+", "x"))
    allowed_roots = allowed_write_roots if is_write else allowed_read_roots
    if not any(candidate == root or candidate.startswith(root + os.sep) for root in allowed_roots):
        action = "write" if is_write else "read"
        raise PermissionError(f"Python sandbox cannot {action} outside the staged sandbox: {path_value}")


def _install_network_guards() -> None:
    def _blocked(*_: Any, **__: Any) -> Any:
        raise OSError("Python sandbox network access is disabled.")

    original_socket = socket.socket

    class GuardedSocket(original_socket):
        def connect(self, *args: Any, **kwargs: Any) -> Any:
            return _blocked(*args, **kwargs)

        def connect_ex(self, *args: Any, **kwargs: Any) -> Any:
            return _blocked(*args, **kwargs)

    socket.socket = GuardedSocket
    socket.create_connection = _blocked  # type: ignore[assignment]


def _install_fs_guards(sandbox_root: str, work_dir: str) -> None:
    allowed_read_roots = [_normalize(sandbox_root)]
    allowed_write_roots = [_normalize(work_dir)]
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
        _guard_path(file, allowed_read_roots, allowed_write_roots, mode)
        return original_open(file, mode, *args, **kwargs)

    def guarded_os_open(file: Any, flags: int, *args: Any, **kwargs: Any):
        mode = "r"
        if flags & (os.O_WRONLY | os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_TRUNC):
            mode = "w"
        _guard_path(file, allowed_read_roots, allowed_write_roots, mode)
        return original_os_open(file, flags, *args, **kwargs)

    def guarded_write_call(original: Any, target: Any, *args: Any, **kwargs: Any):
        _guard_path(target, allowed_read_roots, allowed_write_roots, "w")
        return original(target, *args, **kwargs)

    builtins.open = guarded_open
    os.open = guarded_os_open
    os.remove = lambda target, *args, **kwargs: guarded_write_call(original_remove, target, *args, **kwargs)  # type: ignore[assignment]
    os.unlink = lambda target, *args, **kwargs: guarded_write_call(original_unlink, target, *args, **kwargs)  # type: ignore[assignment]
    os.mkdir = lambda target, *args, **kwargs: guarded_write_call(original_mkdir, target, *args, **kwargs)  # type: ignore[assignment]
    os.makedirs = lambda target, *args, **kwargs: guarded_write_call(original_makedirs, target, *args, **kwargs)  # type: ignore[assignment]
    os.rename = lambda src, dst, *args, **kwargs: (  # type: ignore[assignment]
        _guard_path(src, allowed_read_roots, allowed_write_roots, "w"),
        _guard_path(dst, allowed_read_roots, allowed_write_roots, "w"),
        original_rename(src, dst, *args, **kwargs),
    )[-1]
    os.replace = lambda src, dst, *args, **kwargs: (  # type: ignore[assignment]
        _guard_path(src, allowed_read_roots, allowed_write_roots, "w"),
        _guard_path(dst, allowed_read_roots, allowed_write_roots, "w"),
        original_replace(src, dst, *args, **kwargs),
    )[-1]
    os.rmdir = lambda target, *args, **kwargs: guarded_write_call(original_rmdir, target, *args, **kwargs)  # type: ignore[assignment]


def _truncate(text: str, limit: int) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    return text[:limit], True


def _collect_generated_files(work_dir: str, preview_limit: int, max_files: int) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    for candidate in sorted(pathlib.Path(work_dir).rglob("*")):
        if not candidate.is_file():
            continue
        preview = ""
        truncated = False
        try:
            preview_text = candidate.read_text(encoding="utf-8")
            preview, truncated = _truncate(preview_text, preview_limit)
        except Exception:
            preview = ""
            truncated = False
        collected.append({
            "path": candidate.relative_to(work_dir).as_posix(),
            "sizeBytes": candidate.stat().st_size,
            "preview": preview,
            "truncated": truncated,
        })
        if len(collected) >= max_files:
            break
    return collected


def _build_response(payload: dict[str, Any]) -> dict[str, Any]:
    sandbox_root = payload["sandboxRoot"]
    work_dir = payload["workDir"]
    output_limit = int(payload["outputCharLimit"])
    preview_limit = int(payload["generatedFilePreviewChars"])
    max_generated_files = int(payload["maxGeneratedFiles"])
    code = payload["code"]

    os.chdir(work_dir)
    _install_network_guards()
    _install_fs_guards(sandbox_root, work_dir)

    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()
    namespace = {"__name__": "__main__"}
    exit_code = 0

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
        "exitCode": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "durationMs": payload["durationMs"],
        "stagedFiles": payload["stagedFiles"],
        "generatedFiles": _collect_generated_files(work_dir, preview_limit, max_generated_files),
        "stdoutTruncated": stdout_truncated,
        "stderrTruncated": stderr_truncated,
    }


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("Expected an object payload.")
        payload["durationMs"] = 0
        started = time.perf_counter()
        response = _build_response(payload)
        response["durationMs"] = max(0, int(round((time.perf_counter() - started) * 1000)))
        print(json.dumps(response))
        return 0
    except Exception as error:
        sys.stderr.write(str(error))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
