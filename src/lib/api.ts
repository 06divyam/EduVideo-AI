import type { Video } from "@/lib/types";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export type HealthResponse = {
  status: string;
  service: string;
  gemini_configured: boolean;
  gemini_model: string;
  tts_configured: boolean;
  tts_provider: string;
  tts_model: string;
  ffmpeg_available: boolean;
  slide_languages: string[];
};

export type UploadedDocument = {
  document_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  page_count: number;
  text: string;
  text_length: number;
  created_at: string;
};

export type ExtractedText = {
  document_id: string;
  page_count: number;
  text: string;
  text_length: number;
  created_at: string;
};

export type DocumentListItem = {
  document_id: string;
  filename: string;
  page_count: number;
  text_length: number;
  created_at: string;
  has_study_notes: boolean;
  has_quiz: boolean;
};

export type DocumentsResponse = {
  documents: DocumentListItem[];
};

export type Definition = {
  term: string;
  definition: string;
};

export type StudyNoteTopic = {
  name: string;
  explanation: string;
  definitions: Definition[];
  examples: string[];
  key_points: string[];
};

export type StudyNotes = {
  title: string;
  summary: string;
  topics: StudyNoteTopic[];
  revision_notes: string[];
};

export type StudyNotesResponse = {
  note_id: string;
  document_id: string;
  notes: StudyNotes;
  created_at: string;
};

export type QuizDifficulty = "easy" | "medium" | "hard";
export type QuizDifficultyPreference = "mixed" | QuizDifficulty;

export type QuizQuestionPublic = {
  id: string;
  question: string;
  options: string[];
  difficulty: QuizDifficulty;
  topic: string;
};

export type QuizPublic = {
  quiz_id: string;
  document_id: string;
  title: string;
  questions: QuizQuestionPublic[];
  time_limit_seconds: number;
  created_at: string;
};

export type QuizListItem = {
  quiz_id: string;
  document_id: string;
  document_filename: string;
  title: string;
  question_count: number;
  time_limit_seconds: number;
  attempt_count: number;
  created_at: string;
};

export type QuizzesResponse = {
  quizzes: QuizListItem[];
};

export type QuizAnswer = {
  question_id: string;
  selected_index: number;
};

export type QuestionResult = {
  question_id: string;
  question: string;
  options: string[];
  selected_index: number | null;
  correct_index: number;
  is_correct: boolean;
  explanation: string;
  topic: string;
  difficulty: QuizDifficulty;
};

export type WeakTopic = {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
};

export type TopicPerformance = WeakTopic;

export type AttemptResult = {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  document_id: string;
  score: number;
  total: number;
  percentage: number;
  duration_seconds: number;
  weak_topics: WeakTopic[];
  topic_performance: TopicPerformance[];
  questions: QuestionResult[];
  completed_at: string;
};

export type ActivityItem = {
  type: "lesson_uploaded" | "study_notes" | "quiz_completed";
  title: string;
  detail: string;
  created_at: string;
  href: string;
};

export type ProgressResponse = {
  total_lessons: number;
  videos_generated: number;
  quizzes_completed: number;
  average_quiz_score: number;
  weak_topics: WeakTopic[];
  topic_performance: TopicPerformance[];
  recent_activity: ActivityItem[];
};

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

type ErrorBody = {
  detail?:
    | string
    | { code?: string; message?: string }
    | Array<{ msg?: string }>;
};

function toApiError(status: number, body: ErrorBody | null): ApiError {
  const detail = body?.detail;

  if (typeof detail === "string") {
    return new ApiError("request_failed", detail, status);
  }

  if (Array.isArray(detail)) {
    return new ApiError(
      "validation_error",
      detail[0]?.msg ?? "The request was invalid.",
      status,
    );
  }

  if (detail && typeof detail === "object") {
    return new ApiError(
      detail.code ?? "request_failed",
      detail.message ?? "The request failed. Please try again.",
      status,
    );
  }

  return new ApiError(
    "request_failed",
    "The request failed. Please try again.",
    status,
  );
}

function parseBody(raw: string): ErrorBody | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ErrorBody;
  } catch {
    return null;
  }
}

function networkError(): ApiError {
  return new ApiError(
    "network_error",
    `Could not reach the backend at ${API_BASE_URL}. Is it running?`,
    0,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw networkError();
  }

  const body = parseBody(await response.text());

  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  return body as T;
}

type UploadOptions = {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

export function uploadPdf(
  file: File,
  { onProgress, signal }: UploadOptions = {},
): Promise<UploadedDocument> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError("aborted", "The upload was cancelled.", 0));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/api/upload-pdf`);
    xhr.responseType = "text";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const body = parseBody(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(body as unknown as UploadedDocument);
        return;
      }

      reject(toApiError(xhr.status, body));
    };

    xhr.onerror = () => reject(networkError());
    xhr.onabort = () =>
      reject(new ApiError("aborted", "The upload was cancelled.", 0));

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export async function extractText(
  documentId: string,
): Promise<ExtractedText> {
  return request<ExtractedText>("/api/extract-text", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId }),
  });
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function listDocuments(): Promise<DocumentsResponse> {
  return request<DocumentsResponse>("/api/documents");
}

export async function generateStudyNotes(
  documentId: string,
): Promise<StudyNotesResponse> {
  return request<StudyNotesResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/study-notes`,
    { method: "POST" },
  );
}

export async function getStudyNotes(
  documentId: string,
): Promise<StudyNotesResponse> {
  return request<StudyNotesResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/study-notes`,
  );
}

export async function generateQuiz(input: {
  documentId: string;
  questionCount: number;
  difficulty: QuizDifficultyPreference;
}): Promise<QuizPublic> {
  return request<QuizPublic>("/api/quizzes", {
    method: "POST",
    body: JSON.stringify({
      document_id: input.documentId,
      question_count: input.questionCount,
      difficulty: input.difficulty,
    }),
  });
}

export async function listQuizzes(): Promise<QuizzesResponse> {
  return request<QuizzesResponse>("/api/quizzes");
}

export async function getQuiz(quizId: string): Promise<QuizPublic> {
  return request<QuizPublic>(`/api/quizzes/${encodeURIComponent(quizId)}`);
}

export async function submitQuizAttempt(
  quizId: string,
  answers: QuizAnswer[],
  durationSeconds: number,
): Promise<AttemptResult> {
  return request<AttemptResult>(
    `/api/quizzes/${encodeURIComponent(quizId)}/attempts`,
    {
      method: "POST",
      body: JSON.stringify({
        answers,
        duration_seconds: durationSeconds,
      }),
    },
  );
}

export async function getAttempt(attemptId: string): Promise<AttemptResult> {
  return request<AttemptResult>(
    `/api/attempts/${encodeURIComponent(attemptId)}`,
  );
}

export async function getProgress(): Promise<ProgressResponse> {
  return request<ProgressResponse>("/api/progress");
}

export type VideoJobStatus = "queued" | "processing" | "ready" | "failed";
export type LessonLevel = "beginner" | "college" | "exam";
export type SlideStyle = "illustrated" | "classroom" | "minimal";
export type VideoDurationMinutes = 2 | 5 | 8;

export type VideoSceneSummary = {
  heading: string;
  bullets: string[];
};

export type VideoJob = {
  video_id: string;
  document_id: string;
  document_filename: string | null;
  title: string | null;
  subject: string | null;
  status: VideoJobStatus;
  stage: string;
  progress: number;
  level: string;
  language: string;
  duration_minutes: number;
  style: string;
  voice: string;
  scene_count: number | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  video_url: string | null;
  download_url: string | null;
  thumbnail_url: string | null;
  captions_url: string | null;
  error_code: string | null;
  error_message: string | null;
  scenes: VideoSceneSummary[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type VideosResponse = {
  videos: VideoJob[];
};

/** Resolve a backend-relative URL (e.g. "/api/videos/x/file") for the browser. */
export function backendUrl(path: string | null | undefined): string | undefined {
  return path ? `${API_BASE_URL}${path}` : undefined;
}

export async function createVideo(input: {
  documentId: string;
  level: LessonLevel;
  language: string;
  durationMinutes: VideoDurationMinutes;
  style: SlideStyle;
  voice?: string;
}): Promise<VideoJob> {
  return request<VideoJob>("/api/videos", {
    method: "POST",
    body: JSON.stringify({
      document_id: input.documentId,
      level: input.level,
      language: input.language,
      duration_minutes: input.durationMinutes,
      style: input.style,
      ...(input.voice ? { voice: input.voice } : {}),
    }),
  });
}

export async function listVideos(): Promise<VideosResponse> {
  return request<VideosResponse>("/api/videos");
}

export async function getVideo(videoId: string): Promise<VideoJob> {
  return request<VideoJob>(`/api/videos/${encodeURIComponent(videoId)}`);
}

export function isVideoActive(job: Pick<VideoJob, "status">): boolean {
  return job.status === "queued" || job.status === "processing";
}

export const videoStageLabels: Record<string, string> = {
  queued: "Waiting to start",
  script: "Writing the lesson script",
  narration: "Recording narration",
  slides: "Rendering slides",
  assembling: "Assembling the MP4",
  done: "Ready",
  failed: "Failed",
};

/** Map a backend job to the card model used by the library and dashboard. */
export function toLibraryVideo(job: VideoJob): Video {
  return {
    id: job.video_id,
    title: job.title ?? job.document_filename ?? "Untitled lesson",
    createdAt: job.created_at,
    durationSeconds: Math.round(job.duration_seconds ?? 0),
    status: job.status === "ready" ? "ready" : job.status === "failed" ? "failed" : "processing",
    videoUrl: backendUrl(job.video_url),
    downloadUrl: backendUrl(job.download_url),
    thumbnailUrl: backendUrl(job.thumbnail_url),
    previewHref: `/videos/${job.video_id}`,
    subject: job.subject ?? job.document_filename ?? undefined,
    accent: job.style === "classroom" ? "emerald" : job.style === "minimal" ? "slate" : "indigo",
    progress: job.progress,
    stageLabel: videoStageLabels[job.stage] ?? job.stage,
    errorMessage: job.error_message ?? undefined,
  };
}
