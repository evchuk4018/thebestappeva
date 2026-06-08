import argparse
import base64
import io
import json
import re
import sys
import zipfile
from pathlib import Path


def build_health_payload():
    try:
        import docling  # type: ignore
        from docling.document_converter import DocumentConverter  # type: ignore

        _ = DocumentConverter
        return {
            "available": True,
            "parser": "docling",
            "message": "The local Docling parser is available.",
            "details": getattr(docling, "__version__", "unknown"),
        }
    except Exception as error:  # pragma: no cover - runtime dependency probe
        return {
            "available": False,
            "parser": "docling",
            "message": "The local Docling parser is unavailable.",
            "details": str(error),
        }


def normalize_text(value: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", value.replace("\r", "")).strip()


def infer_outline(markdown: str) -> list[str]:
    headings: list[str] = []
    for line in markdown.splitlines():
        match = re.match(r"^#{1,6}\s+(.*)$", line.strip())
        if match:
            headings.append(match.group(1).strip())
    return headings[:16]


def count_xlsx_sheets(file_path: Path) -> int | None:
    if file_path.suffix.lower() != ".xlsx":
        return None

    try:
        with zipfile.ZipFile(file_path) as archive:
            raw = archive.read("xl/workbook.xml").decode("utf-8", errors="ignore")
        return len(re.findall(r"<sheet\b", raw))
    except Exception:
        return None


def count_document_pages(document) -> int | None:
    pages = getattr(document, "pages", None)
    if isinstance(pages, dict):
        return len(pages)
    if isinstance(pages, list):
        return len(pages)
    return None


def extract_document_pages(document) -> list[dict]:
    page_count = count_document_pages(document)
    if not page_count:
        return []

    pages = []
    for page_number in range(1, page_count + 1):
        markdown = normalize_text(document.export_to_markdown(page_no=page_number) or "")
        text = normalize_text(document.export_to_text(page_no=page_number) or "")
        pages.append({
            "pageNumber": page_number,
            "markdown": markdown or text,
            "text": text or markdown,
        })
    return pages


def parse_document(file_path: Path):
    from docling.document_converter import DocumentConverter  # type: ignore

    converter = DocumentConverter()
    result = converter.convert(str(file_path))
    document = result.document
    markdown = normalize_text(document.export_to_markdown() or "")
    text = normalize_text(document.export_to_text() or "")
    pages = extract_document_pages(document) if file_path.suffix.lower() == ".pdf" else []
    outline = infer_outline(markdown)
    warnings = []
    status = getattr(result, "status", None)
    if status and str(status).lower() not in {"success", "converted"}:
        warnings.append(f"Docling reported status: {status}")

    return {
        "title": outline[0] if outline else file_path.stem,
        "markdown": markdown or text,
        "text": text or markdown,
        "pages": pages,
        "warnings": warnings,
        "stats": {
            "pageCount": count_document_pages(document),
            "sheetCount": count_xlsx_sheets(file_path),
        },
    }


def render_pdf_page(file_path: Path, page_number: int, scale: float):
    import pypdfium2 as pdfium  # type: ignore

    document = pdfium.PdfDocument(str(file_path))
    if page_number < 1 or page_number > len(document):
        raise ValueError(f"Page {page_number} is outside this PDF's 1-{len(document)} page range.")

    page = document[page_number - 1]
    bitmap = page.render(scale=scale)
    image = bitmap.to_pil()
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return {
        "base64Data": base64.b64encode(output.getvalue()).decode("ascii"),
        "mediaType": "image/png",
        "pageNumber": page_number,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--health", action="store_true")
    parser.add_argument("--parse")
    parser.add_argument("--render-page")
    parser.add_argument("--page", type=int)
    parser.add_argument("--scale", type=float, default=1.5)
    args = parser.parse_args()

    if args.health:
        print(json.dumps(build_health_payload()))
        return 0

    if args.render_page:
        if not args.page:
            print("Missing --page for PDF rendering.", file=sys.stderr)
            return 1

        try:
            print(json.dumps(render_pdf_page(Path(args.render_page), args.page, args.scale)))
            return 0
        except Exception as error:  # pragma: no cover - runtime dependency execution
            print(str(error), file=sys.stderr)
            return 1

    if not args.parse:
        print("Missing --parse file path.", file=sys.stderr)
        return 1

    file_path = Path(args.parse)
    if not file_path.exists():
        print(f"Input file does not exist: {file_path}", file=sys.stderr)
        return 1

    try:
        print(json.dumps(parse_document(file_path)))
        return 0
    except Exception as error:  # pragma: no cover - runtime dependency execution
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
