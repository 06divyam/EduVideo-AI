from typing import Literal

from pydantic import BaseModel, Field

Difficulty = Literal["easy", "medium", "hard"]
DifficultyPreference = Literal["mixed", "easy", "medium", "hard"]


class HealthResponse(BaseModel):
    status: str
    service: str
    gemini_configured: bool
    gemini_model: str
    tts_configured: bool
    tts_provider: str
    tts_model: str
    ffmpeg_available: bool
    slide_languages: list[str]


class UploadPdfResponse(BaseModel):
    document_id: str
    filename: str
    content_type: str
    size_bytes: int
    page_count: int
    text: str
    text_length: int
    created_at: str


class ExtractTextRequest(BaseModel):
    document_id: str = Field(min_length=1)


class ExtractTextResponse(BaseModel):
    document_id: str
    page_count: int
    text: str
    text_length: int
    created_at: str


class DocumentListItem(BaseModel):
    document_id: str
    filename: str
    page_count: int
    text_length: int
    created_at: str
    has_study_notes: bool
    has_quiz: bool


class DocumentsResponse(BaseModel):
    documents: list[DocumentListItem]


class Definition(BaseModel):
    term: str
    definition: str


class StudyNoteTopic(BaseModel):
    name: str
    explanation: str
    definitions: list[Definition] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)
    key_points: list[str] = Field(default_factory=list)


class StudyNotes(BaseModel):
    title: str
    summary: str
    topics: list[StudyNoteTopic] = Field(min_length=1)
    revision_notes: list[str] = Field(default_factory=list)


class StudyNotesResponse(BaseModel):
    note_id: str
    document_id: str
    notes: StudyNotes
    created_at: str


class QuizGenerationRequest(BaseModel):
    document_id: str = Field(min_length=1)
    question_count: int = Field(default=5, ge=5, le=10)
    difficulty: DifficultyPreference = "mixed"


class GeneratedQuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    answer_index: int = Field(ge=0, le=3)
    explanation: str
    difficulty: Difficulty
    topic: str


class GeneratedQuiz(BaseModel):
    title: str
    questions: list[GeneratedQuizQuestion] = Field(min_length=1)


class QuizQuestionPublic(BaseModel):
    id: str
    question: str
    options: list[str]
    difficulty: Difficulty
    topic: str


class QuizPublic(BaseModel):
    quiz_id: str
    document_id: str
    title: str
    questions: list[QuizQuestionPublic]
    time_limit_seconds: int
    created_at: str


class QuizListItem(BaseModel):
    quiz_id: str
    document_id: str
    document_filename: str
    title: str
    question_count: int
    time_limit_seconds: int
    attempt_count: int
    created_at: str


class QuizzesResponse(BaseModel):
    quizzes: list[QuizListItem]


class QuizAnswer(BaseModel):
    question_id: str = Field(min_length=1)
    selected_index: int = Field(ge=0, le=3)


class QuizSubmission(BaseModel):
    answers: list[QuizAnswer] = Field(default_factory=list)
    duration_seconds: int = Field(default=0, ge=0)


class QuestionResult(BaseModel):
    question_id: str
    question: str
    options: list[str]
    selected_index: int | None
    correct_index: int
    is_correct: bool
    explanation: str
    topic: str
    difficulty: Difficulty


class WeakTopic(BaseModel):
    topic: str
    correct: int
    total: int
    accuracy: float


class TopicPerformance(BaseModel):
    topic: str
    correct: int
    total: int
    accuracy: float


class AttemptResult(BaseModel):
    attempt_id: str
    quiz_id: str
    quiz_title: str
    document_id: str
    score: int
    total: int
    percentage: float
    duration_seconds: int
    weak_topics: list[WeakTopic]
    topic_performance: list[TopicPerformance]
    questions: list[QuestionResult]
    completed_at: str


class ActivityItem(BaseModel):
    type: Literal["lesson_uploaded", "study_notes", "quiz_completed"]
    title: str
    detail: str
    created_at: str
    href: str


class ProgressResponse(BaseModel):
    total_lessons: int
    videos_generated: int
    quizzes_completed: int
    average_quiz_score: float
    weak_topics: list[WeakTopic]
    topic_performance: list[TopicPerformance]
    recent_activity: list[ActivityItem]


class NarrationRequest(BaseModel):
    text: str
    voice: str | None = None
    document_id: str | None = None


class NarrationResponse(BaseModel):
    narration_id: str
    document_id: str | None
    audio_url: str
    format: Literal["wav"] = "wav"
    mime_type: Literal["audio/wav"] = "audio/wav"
    sample_rate: int
    channels: int
    sample_width_bits: int
    duration_seconds: float
    size_bytes: int
    provider: str
    model: str
    voice: str
    text_length: int
    chunk_count: int | None = None
    created_at: str


LessonLevel = Literal["beginner", "college", "exam"]
LessonLanguage = Literal[
    "English", "Spanish", "French", "Hindi", "Arabic", "Portuguese"
]
SlideStyle = Literal["illustrated", "classroom", "minimal"]


class LessonScene(BaseModel):
    heading: str
    bullets: list[str] = Field(min_length=1, max_length=5)
    narration: str


class LessonScript(BaseModel):
    title: str
    subject: str
    summary: str
    scenes: list[LessonScene] = Field(min_length=1)


VideoStatus = Literal["queued", "processing", "ready", "failed"]


class VideoCreateRequest(BaseModel):
    document_id: str = Field(min_length=1)
    level: LessonLevel = "beginner"
    language: LessonLanguage = "English"
    duration_minutes: Literal[2, 5, 8] = 5
    style: SlideStyle = "illustrated"
    voice: str | None = None


class VideoSceneSummary(BaseModel):
    heading: str
    bullets: list[str]


class VideoJob(BaseModel):
    video_id: str
    document_id: str
    document_filename: str | None
    title: str | None
    subject: str | None
    status: VideoStatus
    stage: str
    progress: int
    level: str
    language: str
    duration_minutes: int
    style: str
    voice: str
    scene_count: int | None
    duration_seconds: float | None
    size_bytes: int | None
    video_url: str | None
    download_url: str | None
    thumbnail_url: str | None
    captions_url: str | None
    error_code: str | None
    error_message: str | None
    scenes: list[VideoSceneSummary] = Field(default_factory=list)
    created_at: str
    updated_at: str
    completed_at: str | None


class VideosResponse(BaseModel):
    videos: list[VideoJob]
