import logging
import uuid
import wave
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from config import (
    EXTRACTED_DIR,
    GEMINI_MODEL,
    GEMINI_TTS_MODEL,
    GEMINI_TTS_VOICE,
    QUIZ_TIME_PER_QUESTION_SECONDS,
    TTS_PROVIDER,
    UPLOAD_DIR,
    cors_origins,
    ensure_directories,
)
from database import (
    AttemptRecord,
    DocumentRecord,
    NarrationRecord,
    QuizRecord,
    count_ready_videos,
    create_attempt,
    create_document,
    create_narration,
    create_quiz,
    create_study_notes,
    get_attempt,
    get_document,
    get_latest_study_notes,
    get_narration,
    get_quiz,
    get_video,
    init_db,
    list_attempts,
    list_documents_with_flags,
    list_quizzes,
    list_study_notes,
    list_videos,
    update_document_text,
)
from schemas import (
    ActivityItem,
    AttemptResult,
    DocumentsResponse,
    DocumentListItem,
    ExtractTextRequest,
    ExtractTextResponse,
    HealthResponse,
    NarrationRequest,
    NarrationResponse,
    ProgressResponse,
    QuestionResult,
    QuizGenerationRequest,
    QuizListItem,
    QuizPublic,
    QuizQuestionPublic,
    QuizzesResponse,
    QuizSubmission,
    StudyNotes,
    StudyNotesResponse,
    TopicPerformance,
    UploadPdfResponse,
    VideoCreateRequest,
    VideoJob,
    VideoSceneSummary,
    VideosResponse,
    WeakTopic,
)
from services import ffmpeg_service, slide_service
from services.video_service import (
    VideoOptions,
    VideoServiceError,
    recover_interrupted_jobs,
    resolve_output,
    script_from_json,
    start_video_job,
)
from services.gemini_service import (
    GeminiServiceError,
    generate_quiz,
    generate_study_notes,
    is_configured,
)
from services.tts_service import (
    TtsServiceError,
    resolve_audio_path,
    synthesize_narration,
)
from services.tts_service import is_configured as tts_is_configured
from services.pdf_service import (
    PdfServiceError,
    extract_text,
    load_document_text,
    save_upload,
    validate_upload,
    write_extracted_text,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_directories()
    init_db()
    recover_interrupted_jobs()
    yield


app = FastAPI(
    title="EduVideo AI API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def http_error(exc: PdfServiceError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


def gemini_http_error(exc: GeminiServiceError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


def tts_http_error(exc: TtsServiceError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


def narration_not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={
            "code": "narration_not_found",
            "message": "No narration matches that id.",
        },
    )


def narration_response(
    record: NarrationRecord, chunk_count: int | None = None
) -> NarrationResponse:
    with wave.open(record.stored_path, "rb") as audio:
        sample_rate = audio.getframerate()
        channels = audio.getnchannels()
        sample_width_bits = audio.getsampwidth() * 8

    return NarrationResponse(
        narration_id=record.id,
        document_id=record.document_id,
        audio_url=f"/api/narrations/{record.id}/audio",
        sample_rate=sample_rate,
        channels=channels,
        sample_width_bits=sample_width_bits,
        duration_seconds=record.duration_seconds,
        size_bytes=record.size_bytes,
        provider=record.provider,
        model=record.model,
        voice=record.voice,
        text_length=record.text_length,
        chunk_count=chunk_count,
        created_at=record.created_at,
    )


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_document_or_404(document_id: str) -> DocumentRecord:
    record = get_document(document_id)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "document_not_found",
                "message": "No document matches that id. Upload the PDF again.",
            },
        )

    return record


def public_quiz(record: QuizRecord) -> QuizPublic:
    return QuizPublic(
        quiz_id=record.id,
        document_id=record.document_id,
        title=record.title,
        questions=[
            QuizQuestionPublic(
                id=question["id"],
                question=question["question"],
                options=question["options"],
                difficulty=question["difficulty"],
                topic=question["topic"],
            )
            for question in record.questions
        ],
        time_limit_seconds=record.time_limit_seconds,
        created_at=record.created_at,
    )


def aggregate_topics(answers: list[dict]) -> dict[str, dict]:
    topics: dict[str, dict] = defaultdict(lambda: {"correct": 0, "total": 0})

    for answer in answers:
        topic = answer.get("topic") or "General"
        topics[topic]["total"] += 1
        if answer.get("is_correct"):
            topics[topic]["correct"] += 1

    return dict(topics)


def topic_list(topics: dict[str, dict]) -> list[WeakTopic]:
    results = [
        WeakTopic(
            topic=topic,
            correct=stats["correct"],
            total=stats["total"],
            accuracy=round(stats["correct"] / stats["total"], 3)
            if stats["total"]
            else 0.0,
        )
        for topic, stats in topics.items()
    ]
    return sorted(results, key=lambda item: (item.accuracy, item.topic))


def build_attempt_result(attempt: AttemptRecord) -> AttemptResult:
    quiz = get_quiz(attempt.quiz_id)
    topics = aggregate_topics(attempt.answers)

    return AttemptResult(
        attempt_id=attempt.id,
        quiz_id=attempt.quiz_id,
        quiz_title=attempt.quiz_title,
        document_id=quiz.document_id if quiz else "",
        score=attempt.score,
        total=attempt.total,
        percentage=attempt.percentage,
        duration_seconds=attempt.duration_seconds,
        weak_topics=[WeakTopic(**topic) for topic in attempt.weak_topics],
        topic_performance=[
            TopicPerformance(**topic.model_dump()) for topic in topic_list(topics)
        ],
        questions=[QuestionResult(**answer) for answer in attempt.answers],
        completed_at=attempt.completed_at,
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="eduvideo-api",
        gemini_configured=is_configured(),
        gemini_model=GEMINI_MODEL,
        tts_configured=tts_is_configured(),
        tts_provider=TTS_PROVIDER,
        tts_model=GEMINI_TTS_MODEL,
        ffmpeg_available=ffmpeg_service.is_available(),
        slide_languages=sorted(
            slide_service.LATIN_LANGUAGES
            | (
                set(slide_service.COMPLEX_SCRIPT_FONTS)
                if slide_service.raqm_available()
                else set()
            )
        ),
    )


@app.post("/api/upload-pdf", response_model=UploadPdfResponse)
async def upload_pdf(file: UploadFile = File(...)) -> UploadPdfResponse:
    try:
        validate_upload(file.filename, file.content_type)
    except PdfServiceError as exc:
        await file.close()
        raise http_error(exc) from exc

    document_id = str(uuid.uuid4())
    stored_path = UPLOAD_DIR / f"{document_id}.pdf"

    try:
        size_bytes = await save_upload(file, stored_path)
        text, page_count = await run_in_threadpool(extract_text, stored_path)
    except PdfServiceError as exc:
        stored_path.unlink(missing_ok=True)
        raise http_error(exc) from exc
    finally:
        await file.close()

    extracted_path = EXTRACTED_DIR / f"{document_id}.txt"
    created_at = now_iso()
    record = DocumentRecord(
        id=document_id,
        filename=file.filename or "upload.pdf",
        content_type=file.content_type or "application/pdf",
        size_bytes=size_bytes,
        page_count=page_count,
        text_length=len(text),
        created_at=created_at,
        stored_path=str(stored_path),
        extracted_path=str(extracted_path),
    )

    try:
        await run_in_threadpool(write_extracted_text, text, extracted_path)
        await run_in_threadpool(create_document, record)
    except Exception as exc:
        stored_path.unlink(missing_ok=True)
        extracted_path.unlink(missing_ok=True)
        logger.exception("Failed to persist uploaded document")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "storage_error",
                "message": "The PDF could not be saved. Please try again.",
            },
        ) from exc

    return UploadPdfResponse(
        document_id=document_id,
        filename=record.filename,
        content_type=record.content_type,
        size_bytes=size_bytes,
        page_count=page_count,
        text=text,
        text_length=len(text),
        created_at=created_at,
    )


@app.post("/api/extract-text", response_model=ExtractTextResponse)
def extract_text_endpoint(payload: ExtractTextRequest) -> ExtractTextResponse:
    record = get_document_or_404(payload.document_id)
    stored_path = Path(record.stored_path)

    try:
        text, page_count = extract_text(stored_path)
    except PdfServiceError as exc:
        raise http_error(exc) from exc

    extracted_path = Path(record.extracted_path)

    try:
        write_extracted_text(text, extracted_path)
        update_document_text(record.id, page_count, len(text))
    except Exception as exc:
        logger.exception("Failed to refresh extracted text")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "storage_error",
                "message": "The extracted text could not be saved. Please try again.",
            },
        ) from exc

    return ExtractTextResponse(
        document_id=record.id,
        page_count=page_count,
        text=text,
        text_length=len(text),
        created_at=record.created_at,
    )


@app.get("/api/documents", response_model=DocumentsResponse)
def documents() -> DocumentsResponse:
    rows = list_documents_with_flags()
    return DocumentsResponse(
        documents=[
            DocumentListItem(
                document_id=row["document_id"],
                filename=row["filename"],
                page_count=row["page_count"],
                text_length=row["text_length"],
                created_at=row["created_at"],
                has_study_notes=bool(row["has_study_notes"]),
                has_quiz=bool(row["has_quiz"]),
            )
            for row in rows
        ]
    )


@app.post(
    "/api/documents/{document_id}/study-notes",
    response_model=StudyNotesResponse,
)
async def generate_document_study_notes(document_id: str) -> StudyNotesResponse:
    record = get_document_or_404(document_id)

    try:
        text = await run_in_threadpool(
            load_document_text,
            Path(record.stored_path),
            Path(record.extracted_path),
        )
        notes = await run_in_threadpool(
            generate_study_notes, text, record.filename
        )
    except PdfServiceError as exc:
        raise http_error(exc) from exc
    except GeminiServiceError as exc:
        raise gemini_http_error(exc) from exc

    note_id = str(uuid.uuid4())
    created_at = now_iso()
    await run_in_threadpool(
        create_study_notes,
        note_id,
        document_id,
        notes.model_dump(),
        created_at,
    )

    return StudyNotesResponse(
        note_id=note_id,
        document_id=document_id,
        notes=notes,
        created_at=created_at,
    )


@app.get(
    "/api/documents/{document_id}/study-notes",
    response_model=StudyNotesResponse,
)
def get_document_study_notes(document_id: str) -> StudyNotesResponse:
    get_document_or_404(document_id)
    record = get_latest_study_notes(document_id)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "study_notes_not_found",
                "message": "No study notes have been generated for this document yet.",
            },
        )

    return StudyNotesResponse(
        note_id=record.id,
        document_id=record.document_id,
        notes=StudyNotes(**record.notes),
        created_at=record.created_at,
    )


@app.get("/api/quizzes", response_model=QuizzesResponse)
def quizzes() -> QuizzesResponse:
    return QuizzesResponse(
        quizzes=[QuizListItem(**item) for item in list_quizzes()]
    )


@app.post("/api/quizzes", response_model=QuizPublic)
async def generate_document_quiz(payload: QuizGenerationRequest) -> QuizPublic:
    record = get_document_or_404(payload.document_id)

    try:
        text = await run_in_threadpool(
            load_document_text,
            Path(record.stored_path),
            Path(record.extracted_path),
        )
        generated = await run_in_threadpool(
            generate_quiz,
            text,
            record.filename,
            payload.question_count,
            payload.difficulty,
        )
    except PdfServiceError as exc:
        raise http_error(exc) from exc
    except GeminiServiceError as exc:
        raise gemini_http_error(exc) from exc

    created_at = now_iso()
    questions = [
        {"id": str(uuid.uuid4()), **question.model_dump()}
        for question in generated.questions
    ]
    quiz = QuizRecord(
        id=str(uuid.uuid4()),
        document_id=payload.document_id,
        title=generated.title,
        questions=questions,
        time_limit_seconds=payload.question_count
        * QUIZ_TIME_PER_QUESTION_SECONDS,
        created_at=created_at,
    )

    try:
        await run_in_threadpool(create_quiz, quiz)
    except Exception as exc:
        logger.exception("Failed to save generated quiz")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "storage_error",
                "message": "The quiz could not be saved. Please try again.",
            },
        ) from exc

    return public_quiz(quiz)


@app.get("/api/quizzes/{quiz_id}", response_model=QuizPublic)
def quiz_detail(quiz_id: str) -> QuizPublic:
    quiz = get_quiz(quiz_id)

    if quiz is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "quiz_not_found",
                "message": "No quiz matches that id.",
            },
        )

    return public_quiz(quiz)


@app.post("/api/quizzes/{quiz_id}/attempts", response_model=AttemptResult)
def submit_quiz_attempt(quiz_id: str, payload: QuizSubmission) -> AttemptResult:
    quiz = get_quiz(quiz_id)

    if quiz is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "quiz_not_found",
                "message": "No quiz matches that id.",
            },
        )

    answer_map: dict[str, int] = {}
    for answer in payload.answers:
        if answer.question_id in answer_map:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "duplicate_answer",
                    "message": "Each question can only be answered once.",
                },
            )
        answer_map[answer.question_id] = answer.selected_index

    valid_ids = {question["id"] for question in quiz.questions}
    unknown = set(answer_map) - valid_ids
    if unknown:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "unknown_question",
                "message": "One or more answers do not belong to this quiz.",
            },
        )

    results = []
    for question in quiz.questions:
        selected = answer_map.get(question["id"])
        results.append(
            {
                "question_id": question["id"],
                "question": question["question"],
                "options": question["options"],
                "selected_index": selected,
                "correct_index": question["answer_index"],
                "is_correct": selected == question["answer_index"],
                "explanation": question["explanation"],
                "topic": question["topic"],
                "difficulty": question["difficulty"],
            }
        )

    score = sum(1 for result in results if result["is_correct"])
    total = len(results)
    percentage = round((score / total) * 100, 1) if total else 0.0
    topics = aggregate_topics(results)
    weak_topics = [
        topic.model_dump()
        for topic in topic_list(topics)
        if topic.correct < topic.total
    ][:5]
    attempt = AttemptRecord(
        id=str(uuid.uuid4()),
        quiz_id=quiz_id,
        quiz_title=quiz.title,
        score=score,
        total=total,
        percentage=percentage,
        duration_seconds=payload.duration_seconds,
        answers=results,
        weak_topics=weak_topics,
        completed_at=now_iso(),
    )

    try:
        create_attempt(attempt)
    except Exception as exc:
        logger.exception("Failed to save quiz attempt")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "storage_error",
                "message": "The quiz result could not be saved. Please try again.",
            },
        ) from exc

    return build_attempt_result(attempt)


@app.get("/api/attempts/{attempt_id}", response_model=AttemptResult)
def attempt_detail(attempt_id: str) -> AttemptResult:
    attempt = get_attempt(attempt_id)

    if attempt is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "attempt_not_found",
                "message": "No quiz attempt matches that id.",
            },
        )

    return build_attempt_result(attempt)


@app.get("/api/progress", response_model=ProgressResponse)
def progress() -> ProgressResponse:
    documents_list = list_documents_with_flags()
    notes = list_study_notes()
    attempts = list_attempts()

    all_answers = [
        answer for attempt in attempts for answer in attempt.answers
    ]
    topics = aggregate_topics(all_answers)
    weak_topics = [
        topic for topic in topic_list(topics) if topic.correct < topic.total
    ][:5]
    average_score = (
        round(sum(attempt.percentage for attempt in attempts) / len(attempts), 1)
        if attempts
        else 0.0
    )

    activity: list[ActivityItem] = []

    for document in documents_list:
        activity.append(
            ActivityItem(
                type="lesson_uploaded",
                title=document["filename"],
                detail=(
                    f"{document['page_count']} pages · "
                    f"{document['text_length']:,} characters extracted"
                ),
                created_at=document["created_at"],
                href="/study",
            )
        )

    for note in notes:
        activity.append(
            ActivityItem(
                type="study_notes",
                title=note.notes.get("title", "Study notes"),
                detail="Smart study notes generated",
                created_at=note.created_at,
                href="/study",
            )
        )

    for attempt in attempts:
        activity.append(
            ActivityItem(
                type="quiz_completed",
                title=attempt.quiz_title,
                detail=(
                    f"{attempt.score}/{attempt.total} correct · "
                    f"{attempt.percentage:.1f}%"
                ),
                created_at=attempt.completed_at,
                href=f"/quiz/{attempt.quiz_id}/results/{attempt.id}",
            )
        )

    activity.sort(key=lambda item: item.created_at, reverse=True)

    return ProgressResponse(
        total_lessons=len(documents_list),
        videos_generated=count_ready_videos(),
        quizzes_completed=len(attempts),
        average_quiz_score=average_score,
        weak_topics=weak_topics,
        topic_performance=[
            TopicPerformance(**topic.model_dump()) for topic in topic_list(topics)
        ],
        recent_activity=activity[:8],
    )


@app.post("/api/narrations", response_model=NarrationResponse)
async def generate_narration(payload: NarrationRequest) -> NarrationResponse:
    if payload.document_id is not None:
        get_document_or_404(payload.document_id)

    try:
        audio = await run_in_threadpool(
            synthesize_narration, payload.text, payload.voice
        )
    except TtsServiceError as exc:
        raise tts_http_error(exc) from exc

    record = NarrationRecord(
        id=audio.audio_id,
        document_id=payload.document_id,
        provider=audio.provider,
        model=audio.model,
        voice=audio.voice,
        text_length=audio.text_length,
        duration_seconds=audio.duration_seconds,
        size_bytes=audio.size_bytes,
        stored_path=str(audio.path),
        created_at=now_iso(),
    )

    try:
        await run_in_threadpool(create_narration, record)
    except Exception as exc:
        audio.path.unlink(missing_ok=True)
        logger.exception("Failed to save narration metadata")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "storage_error",
                "message": "The narration could not be saved. Please try again.",
            },
        ) from exc

    return narration_response(record, chunk_count=audio.chunk_count)


@app.get("/api/narrations/{narration_id}", response_model=NarrationResponse)
def narration_detail(narration_id: str) -> NarrationResponse:
    record = get_narration(narration_id)
    if record is None:
        raise narration_not_found()

    if resolve_audio_path(record.stored_path) is None:
        raise HTTPException(
            status_code=410,
            detail={
                "code": "narration_audio_missing",
                "message": "The audio file for this narration is missing. Generate it again.",
            },
        )

    return narration_response(record)


@app.get("/api/narrations/{narration_id}/audio")
def narration_audio(narration_id: str) -> FileResponse:
    # Only files recorded in the database and located inside storage/audio
    # are served; the client never supplies a path.
    record = get_narration(narration_id)
    if record is None:
        raise narration_not_found()

    path = resolve_audio_path(record.stored_path)
    if path is None:
        raise HTTPException(
            status_code=410,
            detail={
                "code": "narration_audio_missing",
                "message": "The audio file for this narration is missing. Generate it again.",
            },
        )

    return FileResponse(
        path,
        media_type="audio/wav",
        filename=f"narration-{record.id}.wav",
        content_disposition_type="inline",
    )


def video_job(row: dict, include_scenes: bool = False) -> VideoJob:
    video_id = row["id"]
    ready = row["status"] == "ready"
    base = f"/api/videos/{video_id}"
    scenes: list[VideoSceneSummary] = []
    if include_scenes:
        script = script_from_json(row.get("script_json"))
        if script is not None:
            scenes = [
                VideoSceneSummary(heading=scene.heading, bullets=scene.bullets)
                for scene in script.scenes
            ]

    return VideoJob(
        video_id=video_id,
        document_id=row["document_id"],
        document_filename=row.get("document_filename"),
        title=row.get("title"),
        subject=row.get("subject"),
        status=row["status"],
        stage=row["stage"],
        progress=row["progress"],
        level=row["level"],
        language=row["language"],
        duration_minutes=row["duration_minutes"],
        style=row["style"],
        voice=row["voice"],
        scene_count=row.get("scene_count"),
        duration_seconds=row.get("duration_seconds"),
        size_bytes=row.get("size_bytes"),
        video_url=f"{base}/file" if ready else None,
        download_url=f"{base}/file?download=true" if ready else None,
        thumbnail_url=f"{base}/thumbnail" if ready and row.get("thumbnail_path") else None,
        captions_url=f"{base}/captions" if ready and row.get("captions_path") else None,
        error_code=row.get("error_code"),
        error_message=row.get("error_message"),
        scenes=scenes,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        completed_at=row.get("completed_at"),
    )


def get_video_or_404(video_id: str) -> dict:
    row = get_video(video_id)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "video_not_found", "message": "No video matches that id."},
        )
    return row


def video_output_or_error(row: dict, column: str, suffix: str) -> Path:
    if row["status"] != "ready":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "video_not_ready",
                "message": "This video is not ready yet.",
            },
        )
    path = resolve_output(row.get(column), suffix)
    if path is None:
        raise HTTPException(
            status_code=410,
            detail={
                "code": "video_file_missing",
                "message": "The file for this video is missing. Generate the video again.",
            },
        )
    return path


@app.post("/api/videos", response_model=VideoJob, status_code=202)
def create_video_job(payload: VideoCreateRequest) -> VideoJob:
    document = get_document_or_404(payload.document_id)
    options = VideoOptions(
        level=payload.level,
        language=payload.language,
        duration_minutes=payload.duration_minutes,
        style=payload.style,
        voice=payload.voice or GEMINI_TTS_VOICE,
    )

    try:
        video_id = start_video_job(document, options)
    except VideoServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc

    return video_job(get_video_or_404(video_id))


@app.get("/api/videos", response_model=VideosResponse)
def videos_list() -> VideosResponse:
    return VideosResponse(videos=[video_job(row) for row in list_videos()])


@app.get("/api/videos/{video_id}", response_model=VideoJob)
def video_detail(video_id: str) -> VideoJob:
    return video_job(get_video_or_404(video_id), include_scenes=True)


@app.get("/api/videos/{video_id}/file")
def video_file(video_id: str, download: bool = Query(default=False)) -> FileResponse:
    # Files are looked up by id in the database and must live in
    # storage/videos; clients never supply a path.
    row = get_video_or_404(video_id)
    path = video_output_or_error(row, "video_path", ".mp4")
    safe_title = "".join(
        char if char.isalnum() or char in " -_" else "" for char in (row.get("title") or "lesson")
    ).strip().replace(" ", "-")[:60] or "lesson"
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=f"{safe_title}.mp4",
        content_disposition_type="attachment" if download else "inline",
    )


@app.get("/api/videos/{video_id}/thumbnail")
def video_thumbnail(video_id: str) -> FileResponse:
    row = get_video_or_404(video_id)
    path = video_output_or_error(row, "thumbnail_path", ".jpg")
    return FileResponse(path, media_type="image/jpeg")


@app.get("/api/videos/{video_id}/captions")
def video_captions(video_id: str) -> FileResponse:
    row = get_video_or_404(video_id)
    path = video_output_or_error(row, "captions_path", ".vtt")
    return FileResponse(path, media_type="text/vtt")
