"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  LayersIcon,
  MicIcon,
  PlayIcon,
  PresentationIcon,
  SparklesIcon,
  UploadIcon,
  VideoIcon,
  XIcon,
} from "@/components/icons";
import { ApiError, uploadPdf, type UploadedDocument } from "@/lib/api";
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
    label: "Illustrated Slides",
    description: "Friendly visuals and diagrams",
    icon: ImageIcon,
  },
  {
    value: "classroom",
    label: "Classroom",
    description: "Structured chalkboard-style lesson",
    icon: PresentationIcon,
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Clean, type-first slides",
    icon: LayersIcon,
  },
];

const pipeline = [
  {
    title: "Source",
    description: "PDF text is extracted or notes are cleaned.",
    icon: FileTextIcon,
  },
  {
    title: "Script",
    description: "Gemini writes a beginner-friendly lesson.",
    icon: SparklesIcon,
  },
  {
    title: "Narration",
    description: "A local TTS engine voices each scene.",
    icon: MicIcon,
  },
  {
    title: "Slides",
    description: "Pillow renders the lesson visuals.",
    icon: ImageIcon,
  },
  {
    title: "MP4",
    description: "FFmpeg combines audio, slides, and subtitles.",
    icon: VideoIcon,
  },
];

const deliverables = [
  "Editable scene-by-scene lesson script",
  "Narrated voiceover with subtitles",
  "Downloadable MP4 lesson video",
  "Five quiz questions with explanations",
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
    "idle" | "loading" | "done" | "unavailable" | "error"
  >("idle");
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
    if (status === "loading") {
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
    if (status === "loading") {
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
        title: "Notes saved, extraction not connected",
        message:
          "PDF upload and text extraction work today. Note-only lessons will run once the Gemini pipeline is connected.",
      });
      return;
    }

    setStatus("loading");
    setProgress(0);
    setDocument(null);

    try {
      const result = await uploadPdf(file, { onProgress: setProgress });

      setDocument(result);
      setStatus("done");
      setFeedback({
        tone: "success",
        title: "PDF text extracted",
        message: `Read ${result.page_count} ${
          result.page_count === 1 ? "page" : "pages"
        } and ${result.text_length.toLocaleString()} characters from ${
          result.filename
        }. Lesson generation is the next backend step.`,
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "The PDF could not be processed. Please try again.";

      setStatus("error");
      setFeedback({
        tone: "error",
        title: "PDF could not be processed",
        message,
      });
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                <FileTextIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Source material
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Upload a PDF, paste notes, or use both for extra context.
                </p>
              </div>
            </div>

            <div
              onDragEnter={handleDragOver}
              onDragOver={handleDragOver}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`mt-5 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-300 bg-slate-50/60 hover:border-indigo-400 hover:bg-indigo-50/40"
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
                <div className="w-full max-w-md">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                      <FileTextIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(file.size)} ·{" "}
                        {status === "loading"
                          ? progress === 100
                            ? "Extracting text..."
                            : `Uploading ${progress}%`
                          : status === "done"
                            ? "PDF extracted"
                            : "PDF ready"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      disabled={status === "loading"}
                      aria-label="Remove selected PDF"
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {status === "loading" ? (
                    <div className="mt-3" aria-live="polite">
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-1.5 rounded-full bg-indigo-600 transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-right text-[11px] text-slate-500">
                        {progress}%
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">
                      {status === "done"
                        ? "Extracted text is shown below. Drop another PDF to replace it."
                        : "Drop another PDF to replace it, or remove it to paste notes."}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                    <UploadIcon className="h-6 w-6" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-slate-900">
                    Drag and drop your PDF here
                  </p>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                    PDF only, up to 20 MB. Lecture notes, textbook chapters, and
                    study guides work best.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary mt-4"
                  >
                    <UploadIcon className="h-4 w-4" />
                    Browse Files
                  </button>
                </>
              )}
            </div>

            {fileError ? (
              <p
                role="alert"
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600"
              >
                <AlertTriangleIcon className="h-3.5 w-3.5" />
                {fileError}
              </p>
            ) : null}

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                or
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="notes" className="label">
                  Paste your notes
                </label>
                <span
                  className={`text-xs ${
                    notes.trim().length >= MIN_NOTES_LENGTH
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }`}
                >
                  {notes.trim().length} characters
                </span>
              </div>
              <p className="hint mt-1">
                Use this instead of a PDF, or add extra context. Minimum{" "}
                {MIN_NOTES_LENGTH} characters.
              </p>
              <textarea
                id="notes"
                value={notes}
                onChange={handleNotesChange}
                rows={6}
                placeholder="Paste a summary, lecture notes, or the key concepts you want the lesson to cover..."
                aria-invalid={Boolean(sourceError)}
                aria-describedby={sourceError ? "notes-error" : undefined}
                className={`input mt-2 resize-y ${
                  sourceError
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
                    : ""
                }`}
              />
              {sourceError ? (
                <p
                  id="notes-error"
                  role="alert"
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600"
                >
                  <AlertTriangleIcon className="h-3.5 w-3.5" />
                  {sourceError}
                </p>
              ) : null}
            </div>
          </section>

          {document ? (
            <section className="card p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                    <FileTextIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Extracted text
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {document.filename}
                    </p>
                  </div>
                </div>
                <span className="badge w-fit bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                  PDF processed
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs">
                <div>
                  <dt className="text-slate-500">Pages</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {document.page_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Characters</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {document.text_length.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">File size</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatFileSize(document.size_bytes)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 rounded-xl border border-slate-200 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Preview
                </p>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-600">
                  {document.text}
                </pre>
              </div>

              <p className="mt-3 text-[11px] text-slate-400">
                Document {document.document_id.slice(0, 8)}… is stored in the
                backend for the next pipeline stage.
              </p>
            </section>
          ) : null}

          <section className="card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100">
                <SparklesIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Lesson settings
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Shape the tone, pace, and look of the generated lesson.
                </p>
              </div>
            </div>

            <fieldset className="mt-5">
              <legend className="label">Learning level</legend>
              <p className="hint mt-1">
                Controls vocabulary and how much background the lesson assumes.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {learningLevels.map((item) => (
                  <label
                    key={item.value}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-indigo-300 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/70 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
                  >
                    <input
                      type="radio"
                      name="learning-level"
                      value={item.value}
                      checked={level === item.value}
                      onChange={() => setLevel(item.value)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                      {item.description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="language" className="label">
                  Language
                </label>
                <p className="hint mt-1">Narration and on-screen text.</p>
                <div className="relative mt-2">
                  <select
                    id="language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="input appearance-none pr-9"
                  >
                    {languages.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <fieldset>
                <legend className="label">Video duration</legend>
                <p className="hint mt-1">Target length of the final MP4.</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {durations.map((item) => (
                    <label
                      key={item.value}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-center transition-colors hover:border-indigo-300 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/70 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
                    >
                      <input
                        type="radio"
                        name="duration"
                        value={item.value}
                        checked={duration === item.value}
                        onChange={() => setDuration(item.value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-slate-900">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {item.description}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <fieldset className="mt-5">
              <legend className="label">Video style</legend>
              <p className="hint mt-1">
                Choose the visual direction for the generated slides.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {styles.map((item) => {
                  const Icon = item.icon;

                  return (
                    <label
                      key={item.value}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-indigo-300 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/70 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
                    >
                      <input
                        type="radio"
                        name="video-style"
                        value={item.value}
                        checked={style === item.value}
                        onChange={() => setStyle(item.value)}
                        className="sr-only"
                      />
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-semibold text-slate-900">
                          {item.label}
                        </span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                        {item.description}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Ready to build your lesson?
                </p>
                <p className="hint mt-0.5">
                  {file
                    ? "PDFs are sent to the local FastAPI backend for text extraction. Lesson generation is still pending."
                    : "Notes stay in this browser until note-based generation is connected."}
                </p>
              </div>
              <button
                type="submit"
                disabled={status === "loading"}
                className="btn-primary shrink-0"
              >
                {status === "loading" ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {progress === 100
                      ? "Extracting text..."
                      : `Uploading ${progress}%`}
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4" />
                    {file ? "Extract PDF Text" : "Generate Lesson"}
                  </>
                )}
              </button>
            </div>

            {feedback ? (
              <div
                role={feedback.tone === "error" ? "alert" : "status"}
                aria-live="polite"
                className={`mt-4 flex items-start gap-3 rounded-xl border p-3.5 ${feedbackStyles[feedback.tone].container}`}
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
                    className={`text-sm font-semibold ${feedbackStyles[feedback.tone].title}`}
                  >
                    {feedback.title}
                  </p>
                  <p
                    className={`mt-0.5 text-xs leading-relaxed ${feedbackStyles[feedback.tone].message}`}
                  >
                    {feedback.message}
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Lesson at a glance
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Source</dt>
                <dd
                  className="max-w-[60%] truncate text-right font-medium text-slate-900"
                  title={sourceLabel}
                >
                  {sourceLabel}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Level</dt>
                <dd className="text-right font-medium text-slate-900">
                  {levelLabel}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Language</dt>
                <dd className="text-right font-medium text-slate-900">
                  {language}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Duration</dt>
                <dd className="text-right font-medium text-slate-900">
                  {durationLabel}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Style</dt>
                <dd className="text-right font-medium text-slate-900">
                  {styleLabel}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <InfoIcon className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-semibold text-slate-900">
                Extraction connected
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              PDF upload and text extraction run on the local FastAPI service.
              Gemini lesson generation, local TTS, and FFmpeg rendering are not
              connected yet.
            </p>
            <Link
              href="/settings"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
            >
              View configuration status
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </section>
        </aside>
      </form>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              How your material becomes a video
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Every step is handled by the backend pipeline.
            </p>
          </div>
          <span className="badge bg-slate-100 text-slate-500">Preview</span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {pipeline.map((step, index) => {
            const Icon = step.icon;

            return (
              <div
                key={step.title}
                className="relative rounded-xl border border-slate-200 bg-slate-50/60 p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-indigo-600 ring-1 ring-inset ring-slate-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-900">
                  {step.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  {step.description}
                </p>
                {index < pipeline.length - 1 ? (
                  <ArrowRightIcon className="absolute -right-3.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-300 md:block" />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-5 text-white">
            <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative flex h-full flex-col justify-between">
              <span className="badge w-fit bg-white/15 text-white ring-1 ring-inset ring-white/20">
                Lesson preview
              </span>
              <div>
                <p className="text-xs font-medium text-indigo-200">
                  {levelLabel} · {language} · {durationLabel}
                </p>
                <p className="mt-1 text-lg font-semibold leading-snug">
                  Your narrated lesson will appear here
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-1.5 w-2/3 rounded-full bg-white/20">
                  <div className="h-1.5 w-1/3 rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" />
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-inset ring-white/20">
                  <PlayIcon className="ml-0.5 h-4 w-4" />
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              What you get
            </h3>
            <ul className="mt-3 space-y-2">
              {deliverables.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"
                >
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
