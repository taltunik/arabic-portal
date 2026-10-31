export type SubRule = { id: string; nameHe: string };
export type ReminderBlock = { title: string; body: string; examples: { ar: string; he: string }[]; pitfall?: string; recog?: string; steps?: string[]; contrast?: { ar: string; he: string }[]; traps?: string[]; srs?: string[] };
export type MSlot = { opts: string[]; ans: number; note: string; bare: string };
export type Q = {
  id: string; subRuleId: string; prompt: string; promptIsArabic: boolean; sentence?: string; hint?: string;
  options: string[]; answer: number; explain: string; optionNotes?: string[]; fullSentence: string; translation: string; target?: string; multi?: MSlot[];
};
export type ReadQ = { id: string; prompt: string; options: string[]; answer: number; explain: string };
export type ArSeg = { text: string; hi?: boolean };
export type RSent = { ar: string; he: string; m?: string[][] };
export type Reading = { title: string; paras: RSent[][]; gloss: string[][] };
export type CSent = { v: string; he: string; m?: string[][] };
export type ContPassage = { title: string; intro: string; sents: CSent[]; gloss: string[][] };
export type RTable = { title: string; columns: string[]; rows: string[][] };
export type TopicData = {
  id: string; num: number; titleHe: string; ready: boolean; lastPracticed: string; updated?: string;
  reminder: string[]; reminderBlocks?: ReminderBlock[]; subRules: SubRule[]; gloss?: string[][];
  questions: Q[]; readingAr?: ArSeg[]; readingHe?: string; reading?: Reading; readingQs: ReadQ[];
  parts?: { prefix: string; n: number }[]; tables?: RTable[]; cont?: ContPassage[];
  levels?: { label: string; prefix: string; n: number }[]; contMode?: string; brief?: ReminderBlock[]; link?: { id: string; label: string };
};
export type Phase = "home" | "reminder" | "quiz" | "reading" | "summary";
export type RowInfo = { num: number; title: string; status: string; last: string; upd: string; ready: boolean; id: string };

export type SectionDef = { id: string; titleHe: string; icon: string; desc: string; kind: "topics" | "words"; byLesson?: boolean; catchAll?: boolean; mixed?: boolean; emptyNote?: string };
export type LessonDef = { topicId: string; section: string; date: string; teacher: string; titleHe: string };
