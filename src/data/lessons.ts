import type { LessonDef } from "./types";

const LESSONS_BASE: LessonDef[] = [
  { topicId: "dor-vocab", section: "dor", date: "22.10.2026", teacher: "דור", titleHe: "אוצר מילים, ביטויים ופתגמים מהשיעור" },
  { topicId: "college-1", section: "college", date: "30.10.2026", teacher: "קצי חג׳ יחיא", titleHe: "שיטות מחקר וניסוח שאלת מחקר — 32 מילים, מילות יחס קבועות וקטע קריאה" },
];
export const LESSONS: LessonDef[] = LESSONS_BASE.concat([
  { topicId: "dor-lesson-2", section: "dor", date: "03.11.2026", teacher: "דור", titleHe: "שיעור 2 — מילים, סביל (נוּרִית/נוּרָת), שורשים, חזרה על שיעור 1, וקטע «محاضرة عن شعب صغير»" },
]);
