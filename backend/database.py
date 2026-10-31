import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from config import DATABASE_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    page_count INTEGER NOT NULL,
    text_length INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    extracted_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS study_notes (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_notes_document
    ON study_notes(document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    title TEXT NOT NULL,
    questions_json TEXT NOT NULL,
    time_limit_seconds INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quizzes_document
    ON quizzes(document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL,
    quiz_title TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    percentage REAL NOT NULL,
    duration_seconds INTEGER NOT NULL,
    answers_json TEXT NOT NULL,
    weak_topics_json TEXT NOT NULL,
    completed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz
    ON quiz_attempts(quiz_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS narrations (
    id TEXT PRIMARY KEY,
    document_id TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    voice TEXT NOT NULL,
    text_length INTEGER NOT NULL,
    duration_seconds REAL NOT NULL,
    size_bytes INTEGER NOT NULL,
    stored_path TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


@dataclass(frozen=True)
class DocumentRecord:
    id: str
    filename: str
    content_type: str
    size_bytes: int
    page_count: int
    text_length: int
    created_at: str
    stored_path: str
    extracted_path: str


@dataclass(frozen=True)
class StudyNotesRecord:
    id: str
    document_id: str
    notes: dict
    created_at: str


@dataclass(frozen=True)
class QuizRecord:
    id: str
    document_id: str
    title: str
    questions: list[dict]
    time_limit_seconds: int
    created_at: str


@dataclass(frozen=True)
class AttemptRecord:
    id: str
    quiz_id: str
    quiz_title: str
    score: int
    total: int
    percentage: float
    duration_seconds: int
    answers: list[dict]
    weak_topics: list[dict]
    completed_at: str


def get_connection(db_path: Path = DATABASE_PATH) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def init_db(db_path: Path = DATABASE_PATH) -> None:
    with get_connection(db_path) as connection:
        connection.executescript(SCHEMA)


def create_document(record: DocumentRecord, db_path: Path = DATABASE_PATH) -> None:
    with get_connection(db_path) as connection:
        connection.execute(
            """
            INSERT INTO documents (
                id, filename, content_type, size_bytes, page_count,
                text_length, created_at, stored_path, extracted_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.id,
                record.filename,
                record.content_type,
                record.size_bytes,
                record.page_count,
                record.text_length,
                record.created_at,
                record.stored_path,
                record.extracted_path,
            ),
        )


def get_document(document_id: str, db_path: Path = DATABASE_PATH) -> DocumentRecord | None:
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM documents WHERE id = ?",
            (document_id,),
        ).fetchone()

    if row is None:
        return None

    return DocumentRecord(
        id=row["id"],
        filename=row["filename"],
        content_type=row["content_type"],
        size_bytes=row["size_bytes"],
        page_count=row["page_count"],
        text_length=row["text_length"],
        created_at=row["created_at"],
        stored_path=row["stored_path"],
        extracted_path=row["extracted_path"],
    )


def update_document_text(
    document_id: str,
    page_count: int,
    text_length: int,
    db_path: Path = DATABASE_PATH,
) -> None:
    with get_connection(db_path) as connection:
        connection.execute(
            """
            UPDATE documents
            SET page_count = ?, text_length = ?
            WHERE id = ?
            """,
            (page_count, text_length, document_id),
        )


def list_documents_with_flags(db_path: Path = DATABASE_PATH) -> list[dict]:
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT
                d.id AS document_id,
                d.filename,
                d.page_count,
                d.text_length,
                d.created_at,
                EXISTS(
                    SELECT 1 FROM study_notes n WHERE n.document_id = d.id
                ) AS has_study_notes,
                EXISTS(
                    SELECT 1 FROM quizzes q WHERE q.document_id = d.id
                ) AS has_quiz
            FROM documents d
            ORDER BY d.created_at DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]


def count_documents(db_path: Path = DATABASE_PATH) -> int:
    with get_connection(db_path) as connection:
        row = connection.execute("SELECT COUNT(*) AS count FROM documents").fetchone()
    return int(row["count"])


def create_study_notes(
    note_id: str,
    document_id: str,
    notes: dict,
    created_at: str,
    db_path: Path = DATABASE_PATH,
) -> None:
    with get_connection(db_path) as connection:
        connection.execute(
            """
            INSERT INTO study_notes (id, document_id, payload_json, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (note_id, document_id, json.dumps(notes), created_at),
        )


def get_latest_study_notes(
    document_id: str, db_path: Path = DATABASE_PATH
) -> StudyNotesRecord | None:
    with get_connection(db_path) as connection:
        row = connection.execute(
            """
            SELECT * FROM study_notes
            WHERE document_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (document_id,),
        ).fetchone()

    if row is None:
        return None

    return StudyNotesRecord(
        id=row["id"],
        document_id=row["document_id"],
        notes=json.loads(row["payload_json"]),
        created_at=row["created_at"],
    )


def list_study_notes(
    limit: int = 20, db_path: Path = DATABASE_PATH
) -> list[StudyNotesRecord]:
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT * FROM study_notes
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [
        StudyNotesRecord(
            id=row["id"],
            document_id=row["document_id"],
            notes=json.loads(row["payload_json"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]


def create_quiz(record: QuizRecord, db_path: Path = DATABASE_PATH) -> None:
    with get_connection(db_path) as connection:
        connection.execute(
            """
            INSERT INTO quizzes (
                id, document_id, title, questions_json,
                time_limit_seconds, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                record.id,
                record.document_id,
                record.title,
                json.dumps(record.questions),
                record.time_limit_seconds,
                record.created_at,
            ),
        )


def get_quiz(quiz_id: str, db_path: Path = DATABASE_PATH) -> QuizRecord | None:
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM quizzes WHERE id = ?",
            (quiz_id,),
        ).fetchone()

    if row is None:
        return None

    return QuizRecord(
        id=row["id"],
        document_id=row["document_id"],
        title=row["title"],
        questions=json.loads(row["questions_json"]),
        time_limit_seconds=row["time_limit_seconds"],
        created_at=row["created_at"],
    )


def list_quizzes(
    limit: int = 20, db_path: Path = DATABASE_PATH
) -> list[dict]:
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT
                q.id AS quiz_id,
                q.document_id,
                q.title,
                q.questions_json,
                q.time_limit_seconds,
                q.created_at,
                d.filename AS document_filename,
                (
                    SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id
                ) AS attempt_count
            FROM quizzes q
            JOIN documents d ON d.id = q.document_id
            ORDER BY q.created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    results = []
    for row in rows:
        item = dict(row)
        item["question_count"] = len(json.loads(item.pop("questions_json")))
        results.append(item)
    return results


def create_attempt(record: AttemptRecord, db_path: Path = DATABASE_PATH) -> None:
    with get_connection(db_path) as connection:
        connection.execute(
            """
            INSERT INTO quiz_attempts (
                id, quiz_id, quiz_title, score, total, percentage,
                duration_seconds, answers_json, weak_topics_json, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.id,
                record.quiz_id,
                record.quiz_title,
                record.score,
                record.total,
                record.percentage,
                record.duration_seconds,
                json.dumps(record.answers),
                json.dumps(record.weak_topics),
                record.completed_at,
            ),
        )


def get_attempt(attempt_id: str, db_path: Path = DATABASE_PATH) -> AttemptRecord | None:
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM quiz_attempts WHERE id = ?",
            (attempt_id,),
        ).fetchone()

    if row is None:
        return None

    return AttemptRecord(
        id=row["id"],
        quiz_id=row["quiz_id"],
        quiz_title=row["quiz_title"],
        score=row["score"],
        total=row["total"],
        percentage=row["percentage"],
        duration_seconds=row["duration_seconds"],
        answers=json.loads(row["answers_json"]),
        weak_topics=json.loads(row["weak_topics_json"]),
        completed_at=row["completed_at"],
    )


def list_attempts(
    limit: int | None = None, db_path: Path = DATABASE_PATH
) -> list[AttemptRecord]:
    query = "SELECT * FROM quiz_attempts ORDER BY completed_at DESC"
    params: tuple[int, ...] = ()

    if limit is not None:
        query += " LIMIT ?"
        params = (limit,)

    with get_connection(db_path) as connection:
        rows = connection.execute(query, params).fetchall()

    return [
        AttemptRecord(
            id=row["id"],
            quiz_id=row["quiz_id"],
            quiz_title=row["quiz_title"],
            score=row["score"],
            total=row["total"],
            percentage=row["percentage"],
            duration_seconds=row["duration_seconds"],
            answers=json.loads(row["answers_json"]),
            weak_topics=json.loads(row["weak_topics_json"]),
            completed_at=row["completed_at"],
        )
        for row in rows
    ]


@dataclass(frozen=True)
class NarrationRecord:
    id: str
    document_id: str | None
    provider: str
    model: str
    voice: str
    text_length: int
    duration_seconds: float
    size_bytes: int
    stored_path: str
    created_at: str


def _narration_from_row(row: sqlite3.Row) -> NarrationRecord:
    return NarrationRecord(
        id=row["id"],
        document_id=row["document_id"],
        provider=row["provider"],
        model=row["model"],
        voice=row["voice"],
        text_length=row["text_length"],
        duration_seconds=row["duration_seconds"],
        size_bytes=row["size_bytes"],
        stored_path=row["stored_path"],
        created_at=row["created_at"],
    )


def create_narration(record: NarrationRecord, db_path: Path = DATABASE_PATH) -> None:
    with get_connection(db_path) as connection:
        connection.execute(
            """
            INSERT INTO narrations (
                id, document_id, provider, model, voice, text_length,
                duration_seconds, size_bytes, stored_path, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.id,
                record.document_id,
                record.provider,
                record.model,
                record.voice,
                record.text_length,
                record.duration_seconds,
                record.size_bytes,
                record.stored_path,
                record.created_at,
            ),
        )


def get_narration(
    narration_id: str, db_path: Path = DATABASE_PATH
) -> NarrationRecord | None:
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM narrations WHERE id = ?",
            (narration_id,),
        ).fetchone()

    return _narration_from_row(row) if row is not None else None
