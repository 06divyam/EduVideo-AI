"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  FileTextIcon,
  UploadIcon,
  XIcon,
} from "@/components/icons";
import {
  ApiError,
  createVideo,
  getHealth,
  uploadPdf,
  type LessonLevel,
  type SlideStyle,
  type UploadedDocument,
  type VideoDurationMinutes,
} from "@/lib/api";
import { formatFileSize } from "@/lib/format";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIN_NOTES_LENGTH = 40;

type Feedback = {
  tone: "success" | "warning" | "error";
  title: string;
  message: string;
};

const feedbackStyles = {
  success: {
    container: "border-emerald-200 bg-emerald-50",
    icon: "text-emerald-600",
    title: "text-emerald-900",
    message: "text-emerald-800",
  },
  warning: {
    container: "border-amber-200 bg-amber-50",
    icon: "text-amber-600",
    title: "text-amber-900",
    message: "text-amber-800",
  },
  error: {
    container: "border-rose-200 bg-rose-50",
    icon: "text-rose-600",
    title: "text-rose-900",
    message: "text-rose-800",
  },
} as const;

const learningLevels = [
  {
    value: "beginner",
    label: "Beginner",
    description: "Plain language, no prerequisites",
  },
  {
    value: "college",
    label: "College",
    description: "Assumes introductory knowledge",
  },
  {
    value: "exam",
    label: "Exam Preparation",
    description: "Focused on testable ideas",
  },
];

const languages = [
  "English",
  "Spanish",
  "French",
  "Hindi",
  "Arabic",
  "Portuguese",
];

const durations = [
  { value: "2", label: "2 min", description: "Quick overview" },
  { value: "5", label: "5 min", description: "Standard lesson" },
  { value: "8", label: "8 min", description: "Deep dive" },
];

const styles = [
  {
    value: "illustrated",
    label: "Illustrated",
    description: "Slides with simple shapes",
  },
  {
    value: "classroom",
    label: "Classroom",
    description: "Chalkboard-style layout",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Type-first, no decoration",
  },
];

// What the backend does after "Generate video" (shown in the sidebar).
const pipelineSteps = [
  "Extract text from the PDF",
  "Gemini writes the lesson script",
  "Murf narrates the whole lesson",
  "Slides are rendered and timed to the narration",
  "FFmpeg builds the MP4 with captions",
];

function validatePdf(file: File) {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return "Please choose a PDF file.";
  }

  if (file.size === 0) {
    return "This file is empty. Choose another PDF.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "This PDF is larger than 20 MB. Choose a smaller file.";
  }

  return null;
}

export function CreateVideoForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [level, setLevel] = useState("beginner");
  const [language, setLanguage] = useState("English");
  const [duration, setDuration] = useState("5");
  const [style, setStyle] = useState("illustrated");
  const [fileError, setFileError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "starting" | "done" | "unavailable" | "error"
  >("idle");
  // Languages the backend can render slides for (null until /health loads).
  const [slideLanguages, setSlideLanguages] = useState<string[] | null>(null);
  const busy = status === "loading" || status === "starting";

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const health = await getHealth();
        if (!cancelled) {
          setSlideLanguages(health.slide_languages);
        }
      } catch {
        // Leave every language selectable; the backend validates on submit.
      }
    }

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);
  const [progress, setProgress] = useState(0);
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const levelLabel = learningLevels.find((item) => item.value === level)?.label;
  const durationLabel = durations.find(
    (item) => item.value === duration,
  )?.label;
  const styleLabel = styles.find((item) => item.value === style)?.label;
  const sourceLabel = file
    ? file.name
    : notes.trim().length > 0
      ? "Pasted notes"
      : "Not added yet";

  function selectFile(candidate: File) {
    if (busy) {
      return;
    }

    const error = validatePdf(candidate);

    if (error) {
      setFile(null);
      setFileError(error);
      return;
    }

    setFile(candidate);
    setFileError(null);
    setSourceError(null);
    setStatus("idle");
    setProgress(0);
    setDocument(null);
    setFeedback(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const candidate = event.target.files?.[0];

    if (candidate) {
      selectFile(candidate);
    }

    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const candidate = event.dataTransfer.files?.[0];

    if (candidate) {
      selectFile(candidate);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function clearFile() {
    if (busy) {
      return;
    }

    setFile(null);
    setFileError(null);
    setProgress(0);
    setDocument(null);
    setFeedback(null);
    setStatus("idle");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleNotesChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setNotes(value);

    if (value.trim().length >= MIN_NOTES_LENGTH) {
      setSourceError(null);
    }

    setStatus("idle");
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file && notes.trim().length < MIN_NOTES_LENGTH) {
      setSourceError(
        `Add a PDF or paste at least ${MIN_NOTES_LENGTH} characters of notes.`,
      );
      setStatus("idle");
      setFeedback(null);
      return;
    }

    setSourceError(null);
    setFeedback(null);

    if (!file) {
      setStatus("unavailable");
      setFeedback({
        tone: "warning",
        title: "Upload a PDF to generate a video",
        message:
          "Note-only lessons are not supported yet. Upload a PDF and the backend will build the narrated video from it.",
      });
      return;
    }

    // Reuse the uploaded document when retrying with the same PDF.
    let uploaded = document;

    if (!uploaded) {
      setStatus("loading");
      setProgress(0);

      try {
        uploaded = await uploadPdf(file, { onProgress: setProgress });
        setDocument(uploaded);
      } catch (error) {
        setStatus("error");
        setFeedback({
          tone: "error",
          title: "PDF could not be processed",
          message:
            error instanceof ApiError
              ? error.message
              : "The PDF could not be processed. Please try again.",
        });
        return;
      }
    }

    setStatus("starting");

    try {
      const job = await createVideo({
        documentId: uploaded.document_id,
        level: level as LessonLevel,
        language,
        durationMinutes: Number(duration) as VideoDurationMinutes,
        style: style as SlideStyle,
      });
      router.push(`/videos/${job.video_id}`);
    } catch (error) {
      setStatus("error");
      setFeedback({
        tone: "error",
        title: "Video could not be started",
        message:
          error instanceof ApiError
            ? error.message
            : "The video could not be started. Please try again.",
      });
    }
  }

  const notesLength = notes.trim().length;

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <div className="space-y-4">
        {/* Step 1: source */}
        <section className="card p-5 sm:p-6" aria-labelledby="source-heading">
          <StepHeading number={1} id="source-heading" title="Upload a PDF">
            Lecture notes, textbook chapters, and study guides work best.
          </StepHeading>

          <div
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-4 rounded-lg border border-dashed transition-colors ${
              isDragging
                ? "border-brand-500 bg-brand-50"
                : file
                  ? "border-slate-200 bg-white"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400"
            }`}
          >
            <input
              ref={fileInputRef}
              id="pdf-upload"
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Upload a PDF file"
              tabIndex={-1}
              onChange={handleFileChange}
              className="sr-only"
            />

            {file ? (
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                    <FileTextIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(file.size)} ·{" "}
                      {status === "loading" ? (
                        progress === 100 ? (
                          "Extracting text…"
                        ) : (
                          `Uploading ${progress}%`
                        )
                      ) : document ? (
                        <span className="text-emerald-700">Text extracted</span>
                      ) : (
                        "Ready to upload"
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="btn-ghost px-2.5 py-1.5 text-xs"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={clearFile}
                    disabled={busy}
                    aria-label="Remove selected PDF"
                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                {status === "loading" ? (
                  <div
                    className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label="Upload progress"
                  >
                    <div
                      className="h-1 rounded-full bg-brand-600 transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <UploadIcon className="h-6 w-6 text-slate-400" />
                <p className="mt-3 text-sm font-medium text-slate-900">
                  Drop a PDF here, or
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary mt-3"
                >
                  Choose file
                </button>
                <p className="mt-3 text-xs text-slate-500">PDF only, up to 20 MB</p>
              </div>
            )}
          </div>

          {fileError ? <FieldError>{fileError}</FieldError> : null}

          {document ? (
            <details className="disclosure mt-3 rounded-md border border-slate-200">
              <summary className="px-3.5 py-2.5 text-sm">
                <span className="text-slate-700">
                  Extracted text
                  <span className="ml-2 text-xs text-slate-500">
                    {document.page_count}{" "}
                    {document.page_count === 1 ? "page" : "pages"} ·{" "}
                    {document.text_length.toLocaleString()} characters
                  </span>
                </span>
                <ChevronDownIcon className="disclosure-chevron h-4 w-4 text-slate-400 transition-transform" />
              </summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 bg-slate-50 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-slate-600">
                {document.text}
              </pre>
            </details>
          ) : null}

          <details className="disclosure mt-3">
            <summary className="py-1 text-sm text-slate-600 hover:text-slate-900">
              <span>Or paste notes instead</span>
              <ChevronDownIcon className="disclosure-chevron h-4 w-4 text-slate-400 transition-transform" />
            </summary>
            <div className="mt-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="notes" className="label">
                  Notes
                </label>
                <span
                  className={`text-xs tabular-nums ${
                    notesLength >= MIN_NOTES_LENGTH
                      ? "text-emerald-700"
                      : "text-slate-400"
                  }`}
                >
                  {notesLength} / {MIN_NOTES_LENGTH} min
                </span>
              </div>
              <p className="hint mt-0.5">
                Video generation currently needs a PDF; notes alone are not
                supported yet.
              </p>
              <textarea
                id="notes"
                value={notes}
                onChange={handleNotesChange}
                rows={5}
                placeholder="Paste a summary, lecture notes, or the key concepts to cover…"
                aria-invalid={Boolean(sourceError)}
                aria-describedby={sourceError ? "notes-error" : undefined}
                className={`input mt-2 resize-y ${
                  sourceError
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
                    : ""
                }`}
              />
            </div>
          </details>

          {sourceError ? (
            <FieldError id="notes-error">{sourceError}</FieldError>
          ) : null}
        </section>

        {/* Step 2: options */}
        <section className="card p-5 sm:p-6" aria-labelledby="options-heading">
          <StepHeading number={2} id="options-heading" title="Lesson options" />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="label">Length</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {durations.map((item) => (
                  <label
                    key={item.value}
                    className="option px-2 py-2 text-center"
                    title={item.description}
                  >
                    <input
                      type="radio"
                      name="duration"
                      value={item.value}
                      checked={duration === item.value}
                      onChange={() => setDuration(item.value)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-medium text-slate-900">
                      {item.label}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {item.description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="language" className="label">
                Language
              </label>
              <div className="relative mt-2">
                <select
                  id="language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="input appearance-none pr-9"
                >
                  {languages.map((item) => {
                    const unavailable =
                      slideLanguages !== null &&
                      !slideLanguages.includes(item);

                    return (
                      <option key={item} value={item} disabled={unavailable}>
                        {unavailable ? `${item} (not available)` : item}
                      </option>
                    );
                  })}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <p className="hint mt-1.5">Narration and on-screen text.</p>
            </div>
          </div>

          <details className="disclosure mt-5 border-t border-slate-200 pt-4">
            <summary className="text-sm">
              <span className="text-slate-700">
                More options
                <span className="ml-2 text-xs text-slate-500">
                  {levelLabel} · {styleLabel} slides
                </span>
              </span>
              <ChevronDownIcon className="disclosure-chevron h-4 w-4 text-slate-400 transition-transform" />
            </summary>

            <fieldset className="mt-4">
              <legend className="label">Learning level</legend>
              <p className="hint mt-0.5">
                Controls vocabulary and how much background the lesson assumes.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {learningLevels.map((item) => (
                  <label key={item.value} className="option p-3">
                    <input
                      type="radio"
                      name="learning-level"
                      value={item.value}
                      checked={level === item.value}
                      onChange={() => setLevel(item.value)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-medium text-slate-900">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                      {item.description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="label">Slide style</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {styles.map((item) => (
                  <label key={item.value} className="option p-3">
                    <input
                      type="radio"
                      name="video-style"
                      value={item.value}
                      checked={style === item.value}
                      onChange={() => setStyle(item.value)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-medium text-slate-900">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                      {item.description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </details>
        </section>

        {/* Step 3: generate */}
        <section className="card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {file
                ? `${durationLabel} ${language} lesson from ${file.name}.`
                : "Add a PDF to generate a video."}
            </p>
            <button type="submit" disabled={busy} className="btn-primary shrink-0">
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {status === "starting"
                    ? "Starting video…"
                    : progress === 100
                      ? "Extracting text…"
                      : `Uploading ${progress}%`}
                </>
              ) : (
                "Generate video"
              )}
            </button>
          </div>

          {feedback ? (
            <div
              role={feedback.tone === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`mt-4 flex items-start gap-3 rounded-md border p-3.5 ${feedbackStyles[feedback.tone].container}`}
            >
              {feedback.tone === "success" ? (
                <CheckCircleIcon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${feedbackStyles[feedback.tone].icon}`}
                />
              ) : (
                <AlertTriangleIcon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${feedbackStyles[feedback.tone].icon}`}
                />
              )}
              <div>
                <p
                  className={`text-sm font-medium ${feedbackStyles[feedback.tone].title}`}
                >
                  {feedback.title}
                </p>
                <p
                  className={`mt-0.5 text-sm leading-relaxed ${feedbackStyles[feedback.tone].message}`}
                >
                  {feedback.message}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <section className="card p-5">
          <h2 className="section-title">Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ["Source", sourceLabel],
              ["Length", durationLabel],
              ["Language", language],
              ["Level", levelLabel],
              ["Style", styleLabel],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">{label}</dt>
                <dd
                  className="max-w-[60%] truncate text-right font-medium text-slate-900"
                  title={value}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="px-1">
          <h2 className="text-xs font-medium text-slate-500">
            What happens next
          </h2>
          <ol className="mt-2 space-y-1.5">
            {pipelineSteps.map((step, index) => (
              <li key={step} className="flex gap-2 text-xs leading-relaxed text-slate-500">
                <span className="w-3 shrink-0 tabular-nums text-slate-400">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            One video is generated at a time.{" "}
            <Link href="/settings" className="text-brand-600 hover:underline">
              Check service status
            </Link>
          </p>
        </section>
      </aside>
    </form>
  );
}

function StepHeading({
  number,
  id,
  title,
  children,
}: {
  number: number;
  id: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-medium tabular-nums text-white">
        {number}
      </span>
      <div>
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {children ? <p className="hint mt-0.5">{children}</p> : null}
      </div>
    </div>
  );
}

function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-700"
    >
      <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}
