"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  FileTextIcon,
  InfoIcon,
  MicIcon,
  QuizIcon,
  SettingsIcon,
  VideoIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { getHealth, type HealthResponse } from "@/lib/api";

const toneStyles: Record<string, { dot: string; text: string }> = {
  emerald: { dot: "bg-emerald-500", text: "text-emerald-700" },
  amber: { dot: "bg-amber-500", text: "text-amber-700" },
  rose: { dot: "bg-rose-500", text: "text-rose-700" },
  slate: { dot: "bg-slate-400", text: "text-slate-600" },
};

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthState, setHealthState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getHealth();
        if (!cancelled) {
          setHealth(result);
          setHealthState("ready");
        }
      } catch {
        if (!cancelled) {
          setHealthState("error");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const geminiReady = health?.gemini_configured === true;
  const geminiDetail =
    healthState === "loading"
      ? "Checking…"
      : healthState === "error"
        ? "Backend unreachable"
        : geminiReady
          ? `${health?.gemini_model ?? "Gemini"} ready`
          : "GEMINI_API_KEY missing";

  const ttsReady = health?.tts_configured === true;
  const ffmpegReady = health?.ffmpeg_available === true;
  const pending = healthState === "loading";
  const unreachable = healthState === "error";

  const providers = [
    {
      name: "PDF extraction",
      detail: "PyMuPDF ready",
      tone: "emerald",
      icon: FileTextIcon,
    },
    {
      name: "Gemini API",
      detail: geminiDetail,
      tone: geminiReady
        ? "emerald"
        : healthState === "loading"
          ? "slate"
          : "amber",
      icon: FileTextIcon,
    },
    {
      name: "Study notes & quizzes",
      detail: geminiReady ? "Live" : "Waiting for Gemini",
      tone: geminiReady ? "emerald" : "amber",
      icon: QuizIcon,
    },
    {
      name: "Text-to-speech",
      detail: pending
        ? "Checking…"
        : unreachable
          ? "Backend unreachable"
          : ttsReady
            ? `${health?.tts_provider === "murf" ? "Murf" : "Gemini"} (${health?.tts_model ?? "TTS"}) ready`
            : health?.tts_provider === "murf"
              ? "MURF_API_KEY missing"
              : "GEMINI_API_KEY missing",
      tone: ttsReady ? "emerald" : pending ? "slate" : "amber",
      icon: MicIcon,
    },
    {
      name: "FFmpeg renderer",
      detail: pending
        ? "Checking…"
        : unreachable
          ? "Backend unreachable"
          : ffmpegReady
            ? "Available"
            : "ffmpeg not installed",
      tone: ffmpegReady ? "emerald" : pending ? "slate" : "rose",
      icon: VideoIcon,
    },
    {
      name: "SQLite database",
      detail: "Initialized",
      tone: "emerald",
      icon: SettingsIcon,
    },
  ] as const;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Workspace settings"
        description="Review application details, AI provider status, and the defaults used when creating new lessons."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SettingsForm />

          <section className="card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
                <AlertTriangleIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  API configuration
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Secrets belong in the backend environment, never in the
                  browser.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Gemini API key is not configured
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Add <code className="font-mono">GEMINI_API_KEY</code> to the
                backend environment before generating lessons. A missing key
                must surface a clear error instead of fallback content.
              </p>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
              <p className="text-slate-500"># backend/.env</p>
              <p>GEMINI_API_KEY=your_key_here</p>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-xs leading-relaxed text-slate-500">
                The frontend cannot read or verify backend secrets. Provider
                checks are static placeholders; the FastAPI service is connected
                for PDF extraction only.
              </p>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Application information
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Product</dt>
                <dd className="text-right font-medium text-slate-900">
                  EduVideo AI
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Tagline</dt>
                <dd className="text-right font-medium text-slate-900">
                  Turn your notes into knowledge.
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Version</dt>
                <dd className="text-right font-medium text-slate-900">0.1.0</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Build phase</dt>
                <dd className="text-right">
                  <span className="badge bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/15">
                    Phase 2 · PDF extraction
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Theme</dt>
                <dd className="text-right font-medium text-slate-900">
                  Education only
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              AI provider status
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Static summary; only PDF extraction is live.
            </p>
            <ul className="mt-4 space-y-2">
              {providers.map((provider) => {
                const Icon = provider.icon;
                const tone = toneStyles[provider.tone];

                return (
                  <li
                    key={provider.name}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-inset ring-slate-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900">
                        {provider.name}
                      </p>
                      <p className={`text-[11px] ${tone.text}`}>
                        {provider.detail}
                      </p>
                    </div>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`}
                      aria-hidden="true"
                    />
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
              {ffmpegReady ? (
                <>
                  Video rendering is enabled. Slide languages:{" "}
                  {health?.slide_languages.join(", ")}.
                </>
              ) : (
                <>
                  Install FFmpeg with{" "}
                  <code className="font-mono">brew install ffmpeg</code> to
                  enable video rendering.
                </>
              )}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
