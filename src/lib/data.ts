import type { Video } from "@/lib/types";

export const sampleVideos: Video[] = [
  {
    id: "photosynthesis",
    title: "Photosynthesis: From Sunlight to Sugar",
    subject: "Biology",
    createdAt: "2026-10-29T14:32:00.000Z",
    durationSeconds: 612,
    status: "ready",
    accent: "emerald",
    isSample: true,
  },
  {
    id: "french-revolution",
    title: "The French Revolution in 10 Minutes",
    subject: "History",
    createdAt: "2026-10-28T09:15:00.000Z",
    durationSeconds: 725,
    status: "ready",
    accent: "indigo",
    isSample: true,
  },
  {
    id: "eigenvectors",
    title: "Linear Algebra: Eigenvectors Explained",
    subject: "Mathematics",
    createdAt: "2026-10-26T16:48:00.000Z",
    durationSeconds: 548,
    status: "ready",
    accent: "violet",
    isSample: true,
  },
  {
    id: "cell-division",
    title: "Cell Division: Mitosis vs Meiosis",
    subject: "Biology",
    createdAt: "2026-10-24T11:05:00.000Z",
    durationSeconds: 660,
    status: "ready",
    accent: "blue",
    isSample: true,
  },
  {
    id: "macroeconomics",
    title: "Introduction to Macroeconomics",
    subject: "Economics",
    createdAt: "2026-10-23T08:40:00.000Z",
    durationSeconds: 395,
    status: "processing",
    accent: "amber",
    isSample: true,
  },
  {
    id: "newtons-laws",
    title: "Newton's Laws of Motion",
    subject: "Physics",
    createdAt: "2026-10-21T13:20:00.000Z",
    durationSeconds: 815,
    status: "ready",
    accent: "rose",
    isSample: true,
  },
  {
    id: "water-cycle",
    title: "The Water Cycle for Beginners",
    subject: "Earth Science",
    createdAt: "2026-10-19T10:10:00.000Z",
    durationSeconds: 425,
    status: "ready",
    accent: "cyan",
    isSample: true,
  },
  {
    id: "shakespeare",
    title: "Shakespeare: Reading Between the Lines",
    subject: "Literature",
    createdAt: "2026-10-18T15:55:00.000Z",
    durationSeconds: 540,
    status: "failed",
    accent: "slate",
    isSample: true,
  },
];

export const recentVideos = sampleVideos.slice(0, 3);

const readySeconds = sampleVideos
  .filter((video) => video.status === "ready")
  .reduce((total, video) => total + video.durationSeconds, 0);

export const dashboardStats = {
  videos: sampleVideos.length,
  learningHours: Math.round((readySeconds / 3600) * 10) / 10,
  documents: 12,
};
