import logging
from pathlib import Path

import pymupdf
from starlette.datastructures import UploadFile

from config import MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, MIN_EXTRACTED_CHARS

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1024 * 1024
PDF_CONTENT_TYPES = {
    "application/pdf",
    "application/x-pdf",
    "application/octet-stream",
    "binary/octet-stream",
    "",
}


class PdfServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def validate_upload(filename: str | None, content_type: str | None) -> None:
    if not filename or not filename.lower().endswith(".pdf"):
        raise PdfServiceError("invalid_type", "Please upload a PDF file.")

    normalized_type = (content_type or "").split(";")[0].strip().lower()
    if normalized_type not in PDF_CONTENT_TYPES:
        raise PdfServiceError("invalid_type", "Please upload a PDF file.")


async def save_upload(upload: UploadFile, destination: Path) -> int:
    total = 0

    try:
        with destination.open("wb") as output:
            while chunk := await upload.read(CHUNK_SIZE):
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise PdfServiceError(
                        "file_too_large",
                        f"This PDF is larger than {MAX_UPLOAD_MB} MB. Choose a smaller file.",
                        status_code=413,
                    )
                output.write(chunk)
    except PdfServiceError:
        destination.unlink(missing_ok=True)
        raise
    except OSError as exc:
        destination.unlink(missing_ok=True)
        logger.exception("Failed to store uploaded PDF")
        raise PdfServiceError(
            "storage_error",
            "The PDF could not be stored. Please try again.",
            status_code=500,
        ) from exc

    if total == 0:
        destination.unlink(missing_ok=True)
        raise PdfServiceError("empty_file", "This file is empty. Choose another PDF.")

    with destination.open("rb") as stored:
        header = stored.read(1024)

    if b"%PDF-" not in header:
        destination.unlink(missing_ok=True)
        raise PdfServiceError(
            "invalid_pdf",
            "This file is not a valid PDF. Choose another file.",
        )

    return total


def extract_text(pdf_path: Path) -> tuple[str, int]:
    if not pdf_path.exists():
        raise PdfServiceError(
            "document_file_missing",
            "The stored PDF is missing. Please upload it again.",
            status_code=410,
        )

    try:
        document = pymupdf.open(pdf_path)
    except Exception as exc:
        logger.warning("Could not open PDF: %s", exc)
        raise PdfServiceError(
            "invalid_pdf",
            "This PDF could not be read. It may be corrupted or password protected.",
        ) from exc

    try:
        if document.needs_pass:
            raise PdfServiceError(
                "encrypted_pdf",
                "This PDF is password protected. Remove the password and try again.",
                status_code=422,
            )

        page_count = document.page_count
        if page_count == 0:
            raise PdfServiceError("invalid_pdf", "This PDF has no pages.")

        pages = [page.get_text("text") for page in document]
        text = "\n\n".join(page.strip() for page in pages if page.strip()).strip()

        if len(text) < MIN_EXTRACTED_CHARS:
            raise PdfServiceError(
                "ocr_required",
                "No selectable text was found. This looks like a scanned PDF; please upload a text-based PDF or paste your notes.",
                status_code=422,
            )

        return text, page_count
    finally:
        document.close()


def write_extracted_text(text: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(text, encoding="utf-8")


def read_extracted_text(extracted_path: Path) -> str | None:
    if not extracted_path.exists():
        return None
    return extracted_path.read_text(encoding="utf-8")


def load_document_text(stored_path: Path, extracted_path: Path) -> str:
    text = read_extracted_text(extracted_path)

    if text:
        return text

    text, _ = extract_text(stored_path)
    write_extracted_text(text, extracted_path)
    return text
