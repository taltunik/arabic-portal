import type { CSent, MSlot, Q, ReadQ, RSent } from "./types";

export function mq(id: string, sr: string, prompt: string, options: string[], answer: number, explain: string, notes: string[], translation: string, full?: string): Q {
  const isAr: boolean = !/[\u0590-\u05FF]/.test(prompt);
  const fs: string = full ?? (prompt.indexOf("___") >= 0 ? prompt.replace("___", options[answer]) : prompt);
  return { id: id, subRuleId: sr, prompt: prompt, promptIsArabic: isAr, options: options, answer: answer, explain: explain, optionNotes: notes, fullSentence: fs, translation: translation };
}
export function rq(id: string, prompt: string, options: string[], answer: number, explain: string): ReadQ {
  return { id: id, prompt: prompt, options: options, answer: answer, explain: explain };
}
export function rs(ar: string, he: string, m?: string[][]): RSent { return { ar: ar, he: he, m: m }; }
// Reading practice helpers: unvowelled text is derived from the vowelled source, so prompts can never leak harakat.
const HARAKAT_RE: RegExp = /[\u064B-\u0652\u0670]/g;
export function noVowels(s: string): string { return s.replace(HARAKAT_RE, ""); }
export function noEnding(w: string): string {
  const mm: RegExpMatchArray | null = w.match(/^([\s\S]*?)([^\u0621-\u0652\u0670]*)$/);
  let core: string = mm ? mm[1] : w;
  const tail: string = mm ? mm[2] : "";
  if (/(\u064B\u0627|\u0627\u064B)$/.test(core)) core = core.slice(0, core.length - 2);
  const mk: RegExpMatchArray | null = core.match(/[\u064B-\u0652]+$/);
  if (mk) core = core.slice(0, core.length - mk[0].length) + (mk[0].indexOf("\u0651") >= 0 ? "\u0651" : "");
  return core + tail;
}
export function noEndings(s: string): string { return s.split(" ").map(noEnding).join(" "); }
export function pa(id: string, sr: string, full: string, options: string[], answer: number, explain: string, notes: string[], translation: string): Q {
  const q: Q = mq(id, sr, noVowels(full), options, answer, explain, notes, translation, full);
  return { ...q, promptIsArabic: true, hint: "חלק א׳ · בלי ניקוד: איך הוגים את המילה המסומנת?", target: noVowels(options[answer]) };
}
export function pb(id: string, sr: string, full: string, options: string[], answer: number, explain: string, notes: string[], translation: string, bare?: string): Q {
  const shown: string = bare ?? noEnding(options[answer]);
  const q: Q = mq(id, sr, noEndings(full.replace(options[answer], shown)), options, answer, explain, notes, translation, full);
  return { ...q, promptIsArabic: true, hint: "חלק ב׳ · ניקוד סופי: מה הסיומת של המילה המסומנת?", target: noEnding(shown) };
}
export function cs(v: string, he: string, m?: string[][]): CSent { return { v: v, he: he, m: m }; }
// Multi-ending question: each slot is [option1, option2, option3, optional bare form]; the prompt strips the endings of the whole sentence.
export function pm(id: string, sr: string, full: string, slots: string[][], ans: number[], snotes: string[], explain: string, translation: string): Q {
  let shown: string = full;
  const ms: MSlot[] = slots.map((sl: string[], i: number) => {
    const opts: string[] = sl.slice(0, 3);
    const bare: string = sl[3] ? sl[3] : noEnding(opts[ans[i]]);
    shown = shown.replace(opts[ans[i]], bare);
    return { opts: opts, ans: ans[i], note: snotes[i] ?? "", bare: noEnding(bare) };
  });
  return { id: id, subRuleId: sr, prompt: noEndings(shown), promptIsArabic: true, hint: "נקדו את כל הסיומות המסומנות", options: ["✓"], answer: 0, explain: explain, fullSentence: full, translation: translation, multi: ms };
}
