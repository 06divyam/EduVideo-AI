"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  SettingsIcon,
} from "@/components/icons";

type Preferences = {
  level: string;
  language: string;
  duration: string;
  style: string;
  subtitles: boolean;
  autoplay: boolean;
};

type SelectOption = {
  value: string;
  label: string;
};

const defaultPreferences: Preferences = {
  level: "beginner",
  language: "English",
  duration: "5",
  style: "illustrated",
  subtitles: true,
  autoplay: false,
};

const levelOptions: SelectOption[] = [
  { value: "beginner", label: "Beginner" },
  { value: "college", label: "College" },
  { value: "exam", label: "Exam Preparation" },
];

const languageOptions: SelectOption[] = [
  "English",
  "Spanish",
  "French",
  "Hindi",
  "Arabic",
  "Portuguese",
].map((language) => ({ value: language, label: language }));

const durationOptions: SelectOption[] = [
  { value: "2", label: "2 minutes" },
  { value: "5", label: "5 minutes" },
  { value: "8", label: "8 minutes" },
];

const styleOptions: SelectOption[] = [
  { value: "illustrated", label: "Illustrated Slides" },
  { value: "classroom", label: "Classroom" },
  { value: "minimal", label: "Minimal" },
];

function SelectField({
  id,
  label,
  description,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <p className="hint mt-1">{description}</p>
      <div className="relative mt-2">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input appearance-none pr-9"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p id={`${id}-label`} className="text-sm font-medium text-slate-900">
          {label}
        </p>
        <p className="hint mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
          checked ? "bg-indigo-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsForm() {
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem("eduvideo:preferences", JSON.stringify(preferences));
    setSaved(true);
  }

  function handleReset() {
    setPreferences(defaultPreferences);
    localStorage.removeItem("eduvideo:preferences");
    setSaved(false);
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <SettingsIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Video preferences
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Defaults applied to new lessons. You can still override them on the
            create page.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SelectField
          id="default-level"
          label="Default learning level"
          description="Vocabulary and assumed background."
          value={preferences.level}
          options={levelOptions}
          onChange={(value) => update("level", value)}
        />
        <SelectField
          id="default-language"
          label="Default language"
          description="Narration and on-screen text."
          value={preferences.language}
          options={languageOptions}
          onChange={(value) => update("language", value)}
        />
        <SelectField
          id="default-duration"
          label="Default duration"
          description="Target length of the final video."
          value={preferences.duration}
          options={durationOptions}
          onChange={(value) => update("duration", value)}
        />
        <SelectField
          id="default-style"
          label="Default video style"
          description="Visual direction for slides."
          value={preferences.style}
          options={styleOptions}
          onChange={(value) => update("style", value)}
        />
      </div>

      <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
        <Toggle
          id="subtitles"
          label="Burn in subtitles"
          description="Include captions in the exported MP4."
          checked={preferences.subtitles}
          onChange={(checked) => update("subtitles", checked)}
        />
        <Toggle
          id="autoplay"
          label="Autoplay previews"
          description="Start muted previews when opening the library."
          checked={preferences.autoplay}
          onChange={(checked) => update("autoplay", checked)}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs">
          {saved ? (
            <>
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
              <span className="font-medium text-emerald-600">
                Preferences saved locally
              </span>
            </>
          ) : (
            <span className="text-slate-400">
              Changes are stored in this browser only.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleReset} className="btn-ghost">
            Reset
          </button>
          <button type="button" onClick={handleSave} className="btn-primary">
            Save preferences
          </button>
        </div>
      </div>
    </section>
  );
}
