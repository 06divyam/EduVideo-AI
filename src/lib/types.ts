export type VideoStatus = "processing" | "ready" | "failed";

export type VideoAccent =
  | "indigo"
  | "violet"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "slate";

export type Video = {
  id: string;
  title: string;
  createdAt: string;
  durationSeconds: number;
  status: VideoStatus;
  videoUrl?: string;
  thumbnailUrl?: string;
  subject?: string;
  accent?: VideoAccent;
  isSample?: boolean;
};

export type LessonScene = {
  id: string;
  title: string;
  explanation: string;
  visualDescription: string;
};

export type Lesson = {
  title: string;
  summary: string;
  scenes: LessonScene[];
};

export type QuizQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};
