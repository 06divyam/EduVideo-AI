import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "storage" / "uploads"
EXTRACTED_DIR = BASE_DIR / "storage" / "extracted"

DATABASE_PATH = DATA_DIR / "eduvideo.db"

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

MIN_EXTRACTED_CHARS = int(os.getenv("MIN_EXTRACTED_CHARS", "20"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
MAX_AI_SOURCE_CHARS = int(os.getenv("MAX_AI_SOURCE_CHARS", "24000"))

QUIZ_TIME_PER_QUESTION_SECONDS = int(
    os.getenv("QUIZ_TIME_PER_QUESTION_SECONDS", "60")
)
QUIZ_MIN_QUESTIONS = 5
QUIZ_MAX_QUESTIONS = 10

DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def ensure_directories() -> None:
    for directory in (DATA_DIR, UPLOAD_DIR, EXTRACTED_DIR):
        directory.mkdir(parents=True, exist_ok=True)
