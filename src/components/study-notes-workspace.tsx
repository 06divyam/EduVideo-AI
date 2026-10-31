"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CheckCircleIcon,
  FileTextIcon,
  InfoIcon,
  SparklesIcon,
} from "@/components/icons";
import {
  ApiError,
  generateStudyNotes,
  getStudyNotes,
  listDocuments,
  type DocumentListItem,
  type StudyNotesResponse,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

export function StudyNotesWorkspace() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [documentsState, setDocumentsState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<StudyNotesResponse | null>(null);
  const [notesState, setNotesState] = useState<"idle" | "loading" | "ready">(
    "idle",
  );
  const [notesError, setNotesError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Bumped by the retry button to re-run the documents request.
  const [documentsReloadKey, setDocumentsReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      try {
        const result = await listDocuments();
        if (cancelled) {
          return;
        }
        const firstId = result.documents[0]?.document_id ?? null;
        setDocuments(result.documents);
        setDocumentsState("ready");
        setSelectedId((current) => current ?? firstId);
        if (firstId) {
          setNotesState((current) =>
            current === "idle" ? "loading" : current,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setDocumentsState("error");
          setDocumentsError(errorMessage(error));
        }
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [documentsReloadKey]);

  function retryDocuments() {
    setDocumentsState("loading");
    setDocumentsError(null);
    setDocumentsReloadKey((key) => key + 1);
  }

  function selectDocument(documentId: string) {
    if (documentId === selectedId) {
      return;
    }

    setSelectedId(documentId);
    setNotes(null);
    setNotesError(null);
    setNotesState("loading");
  }

  // Fetch notes whenever the selection changes; ignore stale responses if
  // the user switches documents before the request finishes.
  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let cancelled = false;

    getStudyNotes(selectedId).then(
      (result) => {
        if (!cancelled) {
          setNotes(result);
          setNotesState("ready");
        }
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }
        if (
          !(error instanceof ApiError && error.code === "study_notes_not_found")
        ) {
          setNotesError(errorMessage(error));
        }
        setNotesState("ready");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedDocument =
    documents.find((document) => document.document_id === selectedId) ?? null;

  async function handleGenerate() {
    if (!selectedId) {
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const result = await generateStudyNotes(selectedId);
      setNotes(result);
      setNotesState("ready");
      setNotesError(null);
      setDocuments((current) =>
        current.map((document) =>
          document.document_id === selectedId
            ? { ...document, has_study_notes: true }
            : document,
        ),
      );
    } catch (error) {
      setGenerateError(errorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  if (documentsState === "loading") {
    return (
      <section className="card p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
          Loading your uploaded lessons…
        </div>
      </section>
    );
  }

  if (documentsState === "error") {
    return (
      <section className="card p-6">
        <div className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-4">
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Could not load lessons
            </p>
            <p className="mt-1 text-xs leading-relaxed text-rose-800">
              {documentsError}
            </p>
            <button
              type="button"
              onClick={retryDocuments}
              className="btn-secondary mt-3 px-3 py-2 text-xs"
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (documents.length === 0) {
    return (
      <section className="card p-8 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400">
          <BookOpenIcon className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-slate-900">
          No study material yet
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
          Upload a PDF on the create page first. Once it is processed, Gemini can
          turn it into topic-wise study notes.
        </p>
        <Link href="/create" className="btn-primary mt-5">
          <FileTextIcon className="h-4 w-4" />
          Upload a PDF
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Lessons</h2>
            <span className="badge bg-slate-100 text-slate-500">
              {documents.length}
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {documents.map((document) => {
              const active = document.document_id === selectedId;

              return (
                <button
                  key={document.document_id}
                  type="button"
                  onClick={() => selectDocument(document.document_id)}
                  aria-pressed={active}
                  className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                    active
                      ? "border-brand-300 bg-brand-50/70"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? "bg-white text-brand-600 ring-1 ring-inset ring-brand-200"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <FileTextIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-900">
                        {document.filename}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {document.page_count}{" "}
                        {document.page_count === 1 ? "page" : "pages"} ·{" "}
                        {document.text_length.toLocaleString()} chars
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {document.has_study_notes ? (
                          <span className="badge bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                            Notes ready
                          </span>
                        ) : (
                          <span className="badge bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                            No notes
                          </span>
                        )}
                        {document.has_quiz ? (
                          <span className="badge bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            Quiz ready
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card p-4">
          <div className="flex items-center gap-2">
            <InfoIcon className="h-4 w-4 text-slate-400" />
            <p className="text-xs font-semibold text-slate-700">
              Generated from your PDF
            </p>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            Notes are created by Gemini using only the extracted text from the
            selected document. Nothing is generated from sample content.
          </p>
        </section>
      </aside>

      <div className="space-y-4">
        <section className="card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-900">
                    {notes?.notes.title ?? "Smart study notes"}
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    {selectedDocument?.filename} ·{" "}
                    {selectedDocument
                      ? formatDate(selectedDocument.created_at)
                      : ""}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="btn-primary shrink-0"
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Generating notes…
                </>
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  {notes ? "Regenerate notes" : "Generate notes"}
                </>
              )}
            </button>
          </div>

          {generateError ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-3.5"
            >
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-semibold text-rose-900">
                  Notes could not be generated
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-rose-800">
                  {generateError}
                </p>
              </div>
            </div>
          ) : null}

          {notesState === "loading" ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
              Loading saved notes…
            </div>
          ) : notesError ? (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-3.5">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-xs leading-relaxed text-rose-800">
                {notesError}
              </p>
            </div>
          ) : notes ? (
            <div className="mt-6 space-y-6">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">
                  Summary
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  {notes.notes.summary}
                </p>
              </div>

              <div className="space-y-4">
                {notes.notes.topics.map((topic, index) => (
                  <article
                    key={`${topic.name}-${index}`}
                    className="rounded-lg border border-slate-200 p-4 sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-medium tabular-nums text-slate-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {topic.name}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                          {topic.explanation}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {topic.definitions.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            Important definitions
                          </p>
                          <dl className="mt-2 space-y-2">
                            {topic.definitions.map((definition, defIndex) => (
                              <div key={`${definition.term}-${defIndex}`}>
                                <dt className="text-xs font-semibold text-slate-900">
                                  {definition.term}
                                </dt>
                                <dd className="text-xs leading-relaxed text-slate-600">
                                  {definition.definition}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ) : null}

                      {topic.examples.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            Examples
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {topic.examples.map((example, exampleIndex) => (
                              <li
                                key={`${example}-${exampleIndex}`}
                                className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-600"
                              >
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                                {example}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    {topic.key_points.length > 0 ? (
                      <div className="mt-4 rounded-md bg-slate-50/70 p-3">
                        <p className="text-xs font-medium text-slate-500">
                          Key points
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {topic.key_points.map((point, pointIndex) => (
                            <li
                              key={`${point}-${pointIndex}`}
                              className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"
                            >
                              <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              {notes.notes.revision_notes.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
                  <p className="text-xs font-medium text-amber-700">
                    Short revision notes
                  </p>
                  <ul className="mt-2 space-y-2">
                    {notes.notes.revision_notes.map((note, index) => (
                      <li
                        key={`${note}-${index}`}
                        className="flex items-start gap-2 text-xs leading-relaxed text-amber-900"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                <Link
                  href={`/quiz?document=${notes.document_id}`}
                  className="btn-primary"
                >
                  <SparklesIcon className="h-4 w-4" />
                  Practice with a quiz
                </Link>
                <Link href="/create" className="btn-secondary">
                  Create a video from this lesson
                </Link>
                <span className="text-[11px] text-slate-400">
                  Notes saved {formatDate(notes.created_at)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <SparklesIcon className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-900">
                No study notes for this lesson yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                Generate topic-wise explanations, definitions, examples, key
                points, and short revision notes from the extracted PDF text.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
