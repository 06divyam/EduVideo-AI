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

  const missingKeys = [
    !pending && !unreachable && !geminiReady ? "GEMINI_API_KEY" : null,
    !pending && !unreachable && !ttsReady
      ? health?.tts_provider === "gemini"
        ? "GEMINI_API_KEY"
        : "MURF_API_KEY"
      : null,
  ].filter((key, index, all): key is string => key !== null && all.indexOf(key) === index);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Service status, lesson defaults, and backend configuration."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="card overflow-hidden" aria-labelledby="status-heading">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
              <h2 id="status-heading" className="section-title">
                Service status
              </h2>
              <span className="text-xs text-slate-500">
                {pending ? "Checking…" : unreachable ? "Backend unreachable" : "Live from /health"}
              </span>
            </div>
            <ul className="divide-y divide-slate-200">
              {providers.map((provider) => {
                const Icon = provider.icon;
                const tone = toneStyles[provider.tone];

                return (
                  <li key={provider.name} className="flex items-center gap-3 px-5 py-3">
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <p className="min-w-0 flex-1 text-sm text-slate-900">
                      {provider.name}
                    </p>
                    <p className={`flex items-center gap-2 text-xs ${tone.text}`}>
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`}
                        aria-hidden="true"
                      />
                      {provider.detail}
                    </p>
                  </li>
                );
              })}
            </ul>
            {unreachable ? (
              <p className="border-t border-slate-200 bg-rose-50 px-5 py-3 text-xs leading-relaxed text-rose-800">
                Start the backend with{" "}
                <code className="font-mono">
                  cd backend &amp;&amp; .venv/bin/uvicorn main:app --reload --port 8000
                </code>
              </p>
            ) : ffmpegReady ? (
              <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
                Slide languages: {health?.slide_languages.join(", ")}
              </p>
            ) : !pending ? (
              <p className="border-t border-slate-200 bg-amber-50 px-5 py-3 text-xs text-amber-800">
                Install FFmpeg with <code className="font-mono">brew install ffmpeg</code>{" "}
                to enable video rendering.
              </p>
            ) : null}
          </section>

          <SettingsForm />

          <section className="card p-5 sm:p-6" aria-labelledby="config-heading">
            <h2 id="config-heading" className="section-title">
              Backend configuration
            </h2>
            <p className="hint mt-0.5">
              API keys live in <code className="font-mono">backend/.env</code>{" "}
              and are never sent to the browser.
            </p>

            {missingKeys.length > 0 ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3.5"
              >
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-900">
                  Missing {missingKeys.join(" and ")}. Add{" "}
                  {missingKeys.length > 1 ? "them" : "it"} to the backend
                  environment and restart the server.
                </p>
              </div>
            ) : null}

            <pre className="mt-4 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs leading-relaxed text-slate-700">
              <span className="text-slate-400"># backend/.env</span>
              {"\nGEMINI_API_KEY=…        # lesson scripts"}
              {"\nTTS_PROVIDER=murf       # murf or gemini"}
              {"\nMURF_API_KEY=…"}
              {"\nMURF_VOICE_ID=en-US-natalie"}
            </pre>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="section-title">About</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              {[
                ["Product", "EduVideo AI"],
                ["Version", "0.1.0"],
                ["Lesson scripts", health?.gemini_model ?? "—"],
                [
                  "Narration",
                  health
                    ? `${health.tts_provider === "murf" ? "Murf" : "Gemini"} · ${health.tts_model}`
                    : "—",
                ],
                ["Scope", "Education only"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="truncate text-right font-medium text-slate-900" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-500">
            <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Status is read from the backend&apos;s{" "}
              <code className="font-mono">/health</code> endpoint each time
              this page loads.
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}
