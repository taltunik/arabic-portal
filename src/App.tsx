import { Page, Section, Callout, Button, Table, Input, Status, Divider, useState, useMemo, useEffect, useRef, useGrokTheme, type ReactNode } from "grok/canvas";
import { LESSONS, MORE, PLACEHOLDERS, SECTIONS, TOPIC_SECTION, TOPICS } from "./data";
import type { ArSeg, ContPassage, CSent, LessonDef, MSlot, Phase, Q, ReadQ, Reading, ReminderBlock, RowInfo, RSent, RTable, SectionDef, SubRule, TopicData } from "./data/types";
import { noEndings, noVowels } from "./data/build";

function shuffle<T>(arr: T[]): T[] {
  const a: T[] = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j: number = Math.floor(Math.random() * (i + 1));
    const tmp: T = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
// Every round reshuffles the options of every question; the correct answer follows its option (index is recomputed), never a fixed position.
function shuffleQ(q: Q): Q {
  if (q.multi) return { ...q, multi: q.multi.map((sl: MSlot) => { const pr: number[] = shuffle(sl.opts.map((_: string, i: number) => i)); return { ...sl, opts: pr.map((i: number) => sl.opts[i]), ans: pr.indexOf(sl.ans) }; }) };
  const perm: number[] = shuffle(q.options.map((_: string, i: number) => i));
  const notes: string[] | undefined = q.optionNotes;
  return { ...q, options: perm.map((i: number) => q.options[i]), optionNotes: notes ? perm.map((i: number) => notes[i] ?? "") : undefined, answer: perm.indexOf(q.answer) };
}
function shuffleRQ(q: ReadQ): ReadQ {
  const perm: number[] = shuffle(q.options.map((_: string, i: number) => i));
  return { ...q, options: perm.map((i: number) => q.options[i]), answer: perm.indexOf(q.answer) };
}
function pickQuestions(bank: Q[], n: number): Q[] { return shuffle(bank).slice(0, Math.min(n, bank.length)).map(shuffleQ); }

function allTopicRows(): RowInfo[] {
  const rows: RowInfo[] = [];
  TOPICS.forEach((t: TopicData) => {
    if (!t.ready || t.questions.length === 0) return;
    rows.push({ num: t.num, title: t.titleHe, status: "מוכן לתרגול", last: t.lastPracticed, upd: t.updated ?? t.lastPracticed, ready: true, id: t.id });
  });
  PLACEHOLDERS.forEach((p: { num: number; titleHe: string; lastPracticed: string }) => {
    rows.push({ num: p.num, title: p.titleHe, status: "בהכנה", last: p.lastPracticed, upd: "–", ready: false, id: "p" + String(p.num) });
  });
  rows.sort((a: RowInfo, b: RowInfo) => a.num - b.num);
  return rows;
}
function buildSummary(topicLabel: string, correct: number, total: number, missedNames: string[], words: string[], status?: string): string {
  const miss: string = missedNames.length ? missedNames.slice(0, 4).join(", ") : "אין";
  const w: string = words.length ? words.slice(0, 5).join(", ") : "אין";
  let s: string = "סיכום תרגול | נושא: " + topicLabel + " | ציון " + String(correct) + "/" + String(total) + (status ? " | " + status : "") + " | טעויות: " + miss + " | מילים: " + w;
  if (s.length > 460) s = s.slice(0, 457) + "...";
  return s;
}

// ---- Practice tracking (real rounds Tal finished; nothing is pre-filled) ----
type PracticeEntry = { date: string; ts: number; correct: number; total: number; rounds: number; mistakes: number; lastMistakes: number; manual?: boolean; manualDate?: string; history: { d: string; c: number; n: number; k: string }[] };
type Progress = Record<string, PracticeEntry>;
type PState = "done" | "review" | "none";
const PROGRESS_KEY: string = "fuskha-portal-progress-v1";
let MEM_PROGRESS: Progress = {};
function cleanProgress(raw: unknown): Progress {
  const out: Progress = {};
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  Object.keys(obj).forEach((k: string) => {
    const v = obj[k] as Partial<PracticeEntry> | null;
    if (!v || typeof v !== "object") return;
    out[k] = {
      date: typeof v.date === "string" ? v.date : "",
      ts: typeof v.ts === "number" ? v.ts : 0,
      correct: typeof v.correct === "number" ? v.correct : 0,
      total: typeof v.total === "number" ? v.total : 0,
      rounds: typeof v.rounds === "number" ? v.rounds : 0,
      mistakes: typeof v.mistakes === "number" ? v.mistakes : 0,
      lastMistakes: typeof v.lastMistakes === "number" ? v.lastMistakes : 0,
      manual: v.manual === true,
      manualDate: typeof v.manualDate === "string" ? v.manualDate : undefined,
      history: Array.isArray(v.history) ? v.history.slice(-8) : [],
    };
  });
  return out;
}
function loadProgress(): { data: Progress; ok: boolean } {
  try {
    const ls = (globalThis as unknown as { localStorage?: { getItem: (k: string) => string | null } }).localStorage;
    if (!ls) return { data: MEM_PROGRESS, ok: false };
    const s: string | null = ls.getItem(PROGRESS_KEY);
    const data: Progress = s ? cleanProgress(JSON.parse(s)) : {};
    MEM_PROGRESS = data;
    return { data, ok: true };
  } catch (e) {
    return { data: MEM_PROGRESS, ok: false };
  }
}
function saveProgress(p: Progress): boolean {
  MEM_PROGRESS = p;
  try {
    const ls = (globalThis as unknown as { localStorage?: { setItem: (k: string, v: string) => void } }).localStorage;
    if (!ls) return false;
    ls.setItem(PROGRESS_KEY, JSON.stringify(p));
    return true;
  } catch (e) {
    return false;
  }
}
const PROGRESS_INIT: { data: Progress; ok: boolean } = loadProgress();
function todayStr(): string {
  const d: Date = new Date();
  const pad = (n: number): string => (n < 10 ? "0" + String(n) : String(n));
  return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + String(d.getFullYear());
}
function practiceState(p: PracticeEntry | undefined): PState {
  if (!p || (p.rounds === 0 && !p.manual)) return "none";
  if (p.total > 0 && p.correct / p.total < 0.8) return "review";
  return "done";
}
function practiceIcon(p: PracticeEntry | undefined): string {
  const s: PState = practiceState(p);
  return s === "done" ? "✅" : s === "review" ? "⚠️" : "⬜";
}
function practiceLabel(p: PracticeEntry | undefined): string {
  const s: PState = practiceState(p);
  if (!p || s === "none") return "⬜ עדיין לא תורגל";
  const score: string = p.total > 0 ? " · " + String(p.correct) + "/" + String(p.total) : "";
  const when: string = p.rounds > 0 ? p.date : (p.manualDate ?? "");
  const manual: string = p.rounds === 0 && p.manual ? " · סומן ידנית" : "";
  return (s === "review" ? "⚠️ תורגל – כדאי לחזור" : "✅ תורגל") + (when ? " · " + when : "") + score + manual;
}
function practiceDetail(p: PracticeEntry | undefined): string {
  if (!p || practiceState(p) === "none") return "–";
  if (p.rounds === 0) return "סומן ידנית (תרגול מחוץ לפורטל)";
  return (p.rounds === 1 ? "סבב 1" : String(p.rounds) + " סבבים") + " · " + String(p.mistakes) + " טעויות בסך הכול" + (p.manual ? " · מסומן גם ידנית" : "");
}
function recordRound(prev: Progress, key: string, correct: number, total: number, adaptive: boolean): Progress {
  const old: PracticeEntry | undefined = prev[key];
  const d: string = todayStr();
  const wrong: number = Math.max(0, total - correct);
  const base: PracticeEntry = old ? { ...old, history: old.history.slice() } : { date: d, ts: 0, correct: 0, total: 0, rounds: 0, mistakes: 0, lastMistakes: 0, history: [] };
  base.rounds += 1;
  base.mistakes += wrong;
  base.date = d;
  base.ts = Date.now();
  // The status score comes from regular rounds; a reinforcement round only on mistakes does not overwrite it unless there is no score yet.
  if (!adaptive || base.total === 0) { base.correct = correct; base.total = total; base.lastMistakes = wrong; }
  base.history.push({ d, c: correct, n: total, k: adaptive ? "חיזוק" : "רגיל" });
  base.history = base.history.slice(-8);
  return { ...prev, [key]: base };
}
function progressCounts(p: Progress, ids: string[]): { done: number; review: number; none: number } {
  const c = { done: 0, review: 0, none: 0 };
  ids.forEach((id: string) => { c[practiceState(p[id])] += 1; });
  return c;
}

function Ar(props: { children: ReactNode; size?: number }): ReactNode {
  const t = useGrokTheme();
  return (
    <div lang="ar" dir="rtl" style={{ fontSize: props.size ?? 22, lineHeight: "2", color: t.text.primary, fontFamily: t.font.family, wordBreak: "break-word" }}>
      {props.children}
    </div>
  );
}

function ArP(props: { segs: ArSeg[] }): ReactNode {
  const t = useGrokTheme();
  return (
    <div lang="ar" dir="rtl" style={{ fontSize: 22, lineHeight: "2.1", color: t.text.primary, fontFamily: t.font.family }}>
      {props.segs.map((s: ArSeg, i: number) =>
        s.hi ? (
          <span key={i} style={{ fontWeight: t.weight.semibold, color: t.text.accentDeep, borderBottom: "2px solid " + t.text.accent }}>{s.text}</span>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </div>
  );
}

function Chips(props: { items: string[]; onRemove: (i: number) => void }): ReactNode {
  const t = useGrokTheme();
  if (!props.items.length) return null;
  return (
    <div dir="rtl" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {props.items.map((w: string, i: number) => (
        <button key={i} type="button" lang="ar" onClick={() => props.onRemove(i)} style={{ minHeight: 44, padding: "8px 14px", borderRadius: t.radius.full, border: "1px solid " + t.border.default, background: t.fill.accentSubtle, color: t.text.accentDeep, fontFamily: t.font.family, fontSize: 22, lineHeight: 2.2, cursor: "pointer" }}>
          {w + " ×"}
        </button>
      ))}
    </div>
  );
}

function RuleBody(props: { b: ReminderBlock }): ReactNode {
  const t = useGrokTheme();
  const b: ReminderBlock = props.b;
  const lab = (s: string): ReactNode => <div style={{ fontWeight: t.weight.semibold, fontSize: t.font.label.fontSize, color: t.text.accentDeep, marginTop: 6 }}>{s}</div>;
  const para = (s: string, k: string): ReactNode => <div key={k} style={{ fontSize: t.font.body1.fontSize, lineHeight: "1.85", color: t.text.primary }}>{s}</div>;
  const exBox = (ex: { ar: string; he: string }, ei: number): ReactNode => (
    <div key={ei} style={{ padding: "8px 10px", borderRadius: t.radius.md, background: t.bg.subtle, display: "flex", flexDirection: "column", gap: 4 }}>
      <div lang="ar" dir="rtl" style={{ fontSize: 20, lineHeight: "1.9", color: t.text.primary }}>{ex.ar}</div>
      <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>{ex.he}</div>
    </div>
  );
  const warn = (head: string, lines: string[]): ReactNode => (
    <div style={{ fontSize: t.font.body2.fontSize, lineHeight: "1.75", color: t.text.warningDeep, padding: "8px 10px", borderRadius: t.radius.md, background: t.fill.warningSubtle, border: "1px solid " + t.border.default, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontWeight: t.weight.semibold }}>{head}</div>
      {lines.map((s: string, i: number) => <div key={i}>{lines.length > 1 ? "• " + s : s}</div>)}
    </div>
  );
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: t.font.family }}>
      {b.recog || b.steps ? lab("מה זה") : null}
      {b.body.split("\n").map((p: string, i: number) => para(p, "b" + String(i)))}
      {b.recog ? lab("איך מזהים בטקסט בלי ניקוד") : null}
      {b.recog ? b.recog.split("\n").map((p: string, i: number) => para(p, "r" + String(i))) : null}
      {b.steps && b.steps.length ? lab("דרך החשיבה — צעד אחר צעד") : null}
      {b.steps && b.steps.length ? (
        <ol style={{ margin: 0, paddingInlineStart: 22, display: "flex", flexDirection: "column", gap: 4, fontSize: t.font.body1.fontSize, lineHeight: "1.8", color: t.text.primary }}>
          {b.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
        </ol>
      ) : null}
      {b.examples.length && (b.recog || b.steps) ? lab("דוגמאות") : null}
      {b.examples.map(exBox)}
      {b.contrast && b.contrast.length ? lab("זוג להשוואה") : null}
      {b.contrast && b.contrast.length ? <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, borderRadius: t.radius.md, border: "1px dashed " + t.border.default }}>{b.contrast.map(exBox)}</div> : null}
      {b.traps && b.traps.length ? warn("מלכודות נפוצות", b.traps) : null}
      {b.pitfall ? warn("שימו לב", [b.pitfall]) : null}
    </div>
  );
}
function ReminderView(props: { blocks?: ReminderBlock[]; fallback: string[]; open?: Record<number, boolean>; onToggle?: (i: number) => void }): ReactNode {
  const t = useGrokTheme();
  const blocks: ReminderBlock[] = props.blocks ?? [];
  if (blocks.length === 0) return <ReminderViewFlat fallback={props.fallback} />;
  const tog: ((i: number) => void) | undefined = props.onToggle;
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: t.font.family }}>
      {blocks.map((b: ReminderBlock, i: number) => {
        const isOpen: boolean = tog ? (props.open ?? {})[i] === true : true;
        return (
          <div key={i} style={{ border: "1px solid " + t.border.default, borderRadius: t.radius.lg, background: t.bg.elevated, overflow: "hidden" }}>
            <button type="button" className="rule-head" aria-expanded={isOpen} onClick={() => { if (tog) tog(i); }} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 48, padding: "14px", background: isOpen && tog ? t.fill.accentSubtle : t.bg.elevated, border: "none", cursor: tog ? "pointer" : "default", fontFamily: t.font.family, fontSize: t.font.body1.fontSize, lineHeight: 1.8, fontWeight: t.weight.semibold, color: t.text.primary, textAlign: "start" }}>
              <span>{b.title}</span>
              {tog ? <span style={{ fontSize: t.font.label.fontSize, color: t.text.accentDeep, whiteSpace: "nowrap" }}>{isOpen ? "סגור ▴" : "פתח ▾"}</span> : null}
            </button>
            {isOpen ? <div style={{ padding: "4px 14px 14px" }}><RuleBody b={b} /></div> : null}
          </div>
        );
      })}
    </div>
  );
}
function RuleAccordion(props: { blocks: ReminderBlock[] }): ReactNode {
  const [o, setO] = useState<Record<number, boolean>>({});
  return <ReminderView blocks={props.blocks} fallback={[]} open={o} onToggle={(i: number) => setO({ ...o, [i]: !o[i] })} />;
}
function RuleHelp(props: { rules?: ReminderBlock[] }): ReactNode {
  const t = useGrokTheme();
  const [open, setOpen] = useState<boolean>(false);
  const rules: ReminderBlock[] = props.rules ?? [];
  if (rules.length === 0) return null;
  const one: boolean = rules.length <= 2;
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <button type="button" onClick={() => setOpen(!open)} style={{ minHeight: 44, padding: "10px 14px", borderRadius: t.radius.full, border: "1px solid " + t.border.default, background: open ? t.fill.accentSubtle : t.bg.base, color: t.text.accentDeep, fontFamily: t.font.family, fontSize: t.font.body2.fontSize, cursor: "pointer" }}>
          {open ? "הסתר את הכלל" : one ? "📖 הצג את הכלל של השאלה" : "📖 הצג את חוקי הנושא"}
        </button>
      </div>
      {open && one ? rules.map((b: ReminderBlock, i: number) => (
        <div key={i} style={{ padding: 12, borderRadius: t.radius.md, border: "1px solid " + t.border.default, background: t.bg.base, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontWeight: t.weight.semibold, color: t.text.primary }}>{b.title}</div>
          <RuleBody b={b} />
        </div>
      )) : null}
      {open && !one ? <RuleAccordion blocks={rules} /> : null}
    </div>
  );
}
function ReminderViewFlat(props: { blocks?: ReminderBlock[]; fallback: string[] }): ReactNode {
  const t = useGrokTheme();
  if (props.blocks && props.blocks.length > 0) {
    return (
      <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: t.font.family }}>
        {props.blocks.map((b: ReminderBlock, i: number) => (
          <div key={i} style={{ border: "1px solid " + t.border.default, borderRadius: t.radius.lg, padding: 14, background: t.bg.elevated, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontWeight: t.weight.semibold, fontSize: t.font.heading3.fontSize, color: t.text.primary }}>{b.title}</div>
            <div style={{ fontSize: t.font.body1.fontSize, lineHeight: "1.85", color: t.text.primary }}>{b.body}</div>
            {b.examples.map((ex: { ar: string; he: string }, ei: number) => (
              <div key={ei} style={{ padding: "8px 10px", borderRadius: t.radius.md, background: t.bg.subtle, display: "flex", flexDirection: "column", gap: 4 }}>
                <div lang="ar" dir="rtl" style={{ fontSize: 20, lineHeight: "1.9", color: t.text.primary }}>{ex.ar}</div>
                <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>{ex.he}</div>
              </div>
            ))}
            {b.pitfall ? (
              <div style={{ fontSize: t.font.body2.fontSize, lineHeight: "1.75", color: t.text.warningDeep, padding: "8px 10px", borderRadius: t.radius.md, background: t.fill.warningSubtle, border: "1px solid " + t.border.default }}>
                {"שימו לב: " + b.pitfall}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 8, lineHeight: "1.8", fontSize: t.font.body1.fontSize }}>
      {props.fallback.map((line: string, i: number) => <div key={i}>{line}</div>)}
    </div>
  );
}

function QCard(props: { q: Q; index: number; chosen: number | undefined; onAnswer: (c: number) => void; rules?: ReminderBlock[] }): ReactNode {
  const t = useGrokTheme();
  const done: boolean = props.chosen !== undefined;
  const right: boolean = done && props.chosen === props.q.answer;
  return (
    <div style={{ border: "1px solid " + t.border.default, borderRadius: t.radius.lg, padding: 14, background: t.bg.elevated, display: "flex", flexDirection: "column", gap: 10, fontFamily: t.font.family }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: t.text.tertiary, fontSize: t.font.label.fontSize }}>{"שאלה " + String(props.index + 1)}</span>
        {props.q.hint ? <span style={{ color: t.text.secondary, fontSize: t.font.label.fontSize }}>{"(" + props.q.hint + ")"}</span> : null}
      </div>
      <RuleHelp rules={props.rules} />
      {props.q.target && props.q.prompt.indexOf(props.q.target) >= 0 ? (
        <Ar size={24}>
          {props.q.prompt.slice(0, props.q.prompt.indexOf(props.q.target))}
          <span style={{ fontWeight: t.weight.semibold, color: t.text.accentDeep, borderBottom: "2px solid " + t.text.accent }}>{props.q.target}</span>
          {props.q.prompt.slice(props.q.prompt.indexOf(props.q.target) + props.q.target.length)}
        </Ar>
      ) : props.q.promptIsArabic ? <Ar>{props.q.prompt}</Ar> : <div style={{ fontSize: t.font.body1.fontSize, color: t.text.primary }}>{props.q.prompt}</div>}
      {props.q.sentence ? <Ar>{props.q.sentence}</Ar> : null}
      <div className="choices" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {props.q.options.map((opt: string, oi: number) => {
          const isA: boolean = oi === props.q.answer;
          const isC: boolean = props.chosen === oi;
          let bg: string = t.bg.base;
          let bd: string = t.border.default;
          let col: string = t.text.primary;
          if (done && isA) { bg = t.fill.successSubtle; bd = t.text.success; col = t.text.successDeep; }
          else if (done && isC) { bg = t.fill.dangerSubtle; bd = t.text.danger; col = t.text.dangerDeep; }
          const hasAr: boolean = props.q.promptIsArabic || /[\u0600-\u06FF]/.test(opt);
          return (
            <button key={oi} type="button" className="choice" disabled={done} onClick={() => props.onAnswer(oi)} lang={hasAr ? "ar" : "he"} style={{ minHeight: 48, minWidth: 72, padding: "10px 14px", borderRadius: t.radius.md, border: "1.5px solid " + bd, background: bg, color: col, fontFamily: t.font.family, fontSize: hasAr ? 22 : t.font.body1.fontSize, lineHeight: hasAr ? 2.2 : 1.45, cursor: done ? "default" : "pointer", opacity: done && !isA && !isC ? 0.55 : 1, maxWidth: "100%", whiteSpace: "normal", textAlign: "center" }}>
              {opt}
            </button>
          );
        })}
      </div>
      {done ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: t.font.body1.fontSize, lineHeight: "1.75", color: t.text.primary }}>
          <div>
            <span style={{ fontWeight: t.weight.semibold, color: right ? t.text.success : t.text.danger }}>{right ? "נכון! " : "לא בדיוק. "}</span>
            {props.q.explain}
          </div>
          <MoreBox id={props.q.id} />
          {props.q.optionNotes && props.q.optionNotes.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 10, borderRadius: t.radius.md, background: t.bg.subtle, fontSize: t.font.body2.fontSize, lineHeight: "1.7", color: t.text.secondary }}>
              <div style={{ fontWeight: t.weight.semibold, color: t.text.primary }}>למה כל אפשרות:</div>
              {props.q.optionNotes.map((n: string, ni: number) => (
                <div key={ni}>{(ni === props.q.answer ? "✓ " : "✗ ") + props.q.options[ni] + " — " + n}</div>
              ))}
            </div>
          ) : null}
          <Ar size={20}>{props.q.fullSentence}</Ar>
          <div style={{ color: t.text.secondary, fontSize: t.font.subtext.fontSize }}>{"תרגום: " + props.q.translation}</div>
        </div>
      ) : null}
    </div>
  );
}

function MoreBox(props: { id: string }): ReactNode {
  const t = useGrokTheme();
  const m: string | undefined = MORE[props.id];
  if (!m) return null;
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: t.radius.md, background: t.fill.accentSubtle, border: "1px solid " + t.border.default, fontSize: t.font.body1.fontSize, lineHeight: "1.85", color: t.text.primary }}>
      <div style={{ fontWeight: t.weight.semibold, color: t.text.accentDeep }}>הסבר מלא — איך חושבים על זה</div>
      {m.split("\n").map((p: string, i: number) => <div key={i}>{p}</div>)}
    </div>
  );
}
function MultiCard(props: { q: Q; index: number; chosen: number | undefined; onAnswer: (c: number) => void; rules?: ReminderBlock[] }): ReactNode {
  const t = useGrokTheme();
  const slots: MSlot[] = props.q.multi ?? [];
  const [pick, setPick] = useState<Record<number, number>>({});
  const done: boolean = props.chosen !== undefined;
  const right: boolean = done && props.chosen === props.q.answer;
  const choose = (si: number, oi: number): void => {
    if (done || pick[si] !== undefined) return;
    const np: Record<number, number> = { ...pick, [si]: oi };
    setPick(np);
    if (slots.every((_: MSlot, k: number) => np[k] !== undefined)) props.onAnswer(slots.every((s: MSlot, k: number) => np[k] === s.ans) ? props.q.answer : props.q.answer + 1);
  };
  const segs: MSeg[] = markSegs(props.q.prompt, slots.map((s: MSlot) => [s.bare, ""]), 0);
  const okN: number = slots.filter((s: MSlot, k: number) => pick[k] === s.ans).length;
  return (
    <div style={{ border: "1px solid " + t.border.default, borderRadius: t.radius.lg, padding: 14, background: t.bg.elevated, display: "flex", flexDirection: "column", gap: 10, fontFamily: t.font.family }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: t.text.tertiary, fontSize: t.font.label.fontSize }}>{"שאלה " + String(props.index + 1)}</span>
        <span style={{ color: t.text.secondary, fontSize: t.font.label.fontSize }}>{"(נקדו את כל הסיומות במשפט — " + String(slots.length) + " מילים מסומנות)"}</span>
      </div>
      <RuleHelp rules={props.rules} />
      <div lang="ar" dir="rtl" style={{ fontSize: 24, lineHeight: "2.2", color: t.text.primary, wordBreak: "break-word" }}>
        {segs.map((g: MSeg, gi: number) => g.n > 0 ? (
          <span key={gi} style={{ fontWeight: t.weight.semibold, color: t.text.accentDeep, borderBottom: "2px solid " + t.text.accent }}>{g.text}<sup style={{ fontSize: 12, color: t.text.accent, marginInlineStart: 2 }}>{String(g.n)}</sup></span>
        ) : (
          <span key={gi}>{g.text}</span>
        ))}
      </div>
      {slots.map((s: MSlot, si: number) => {
        const picked: number | undefined = pick[si];
        return (
          <div key={si} className="choices" dir="rtl" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span lang="ar" style={{ minWidth: 96, fontSize: 22, lineHeight: 2.2, fontWeight: t.weight.semibold, color: t.text.accentDeep }}>{String(si + 1) + ". " + s.bare}</span>
            {s.opts.map((o: string, oi: number) => {
              const shown: boolean = picked !== undefined;
              let bg: string = t.bg.base;
              let bd: string = t.border.default;
              let col: string = t.text.primary;
              if (shown && oi === s.ans) { bg = t.fill.successSubtle; bd = t.text.success; col = t.text.successDeep; }
              else if (shown && oi === picked) { bg = t.fill.dangerSubtle; bd = t.text.danger; col = t.text.dangerDeep; }
              return (
                <button key={oi} type="button" className="choice" lang="ar" disabled={shown} onClick={() => choose(si, oi)} style={{ minHeight: 48, minWidth: 72, padding: "10px 14px", borderRadius: t.radius.md, border: "1.5px solid " + bd, background: bg, color: col, fontFamily: t.font.family, fontSize: 22, lineHeight: 2.2, cursor: shown ? "default" : "pointer", opacity: shown && oi !== s.ans && oi !== picked ? 0.55 : 1 }}>{o}</button>
              );
            })}
          </div>
        );
      })}
      {done ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: t.font.body1.fontSize, lineHeight: "1.75", color: t.text.primary }}>
          <div>
            <span style={{ fontWeight: t.weight.semibold, color: right ? t.text.success : t.text.danger }}>{right ? "נכון! כל הסיומות נכונות. " : "לא בדיוק: " + String(okN) + " מתוך " + String(slots.length) + " נכונות. "}</span>
            {props.q.explain}
          </div>
          <MoreBox id={props.q.id} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 10, borderRadius: t.radius.md, background: t.bg.subtle, fontSize: t.font.body2.fontSize, lineHeight: "1.7", color: t.text.secondary }}>
            <div style={{ fontWeight: t.weight.semibold, color: t.text.primary }}>הסבר לכל מילה:</div>
            {slots.map((s: MSlot, si: number) => (
              <div key={si}>{(pick[si] === s.ans ? "✓ " : "✗ ") + String(si + 1) + ". " + s.opts[s.ans] + (pick[si] !== undefined && pick[si] !== s.ans ? " (בחרת: " + s.opts[pick[si]] + ")" : "") + " — " + s.note}</div>
            ))}
          </div>
          <Ar size={20}>{props.q.fullSentence}</Ar>
          <div style={{ color: t.text.secondary, fontSize: t.font.subtext.fontSize }}>{"תרגום: " + props.q.translation}</div>
        </div>
      ) : null}
    </div>
  );
}
function RQCard(props: { q: ReadQ; index: number; chosen: number | undefined; onAnswer: (c: number) => void }): ReactNode {
  const t = useGrokTheme();
  const done: boolean = props.chosen !== undefined;
  const right: boolean = done && props.chosen === props.q.answer;
  return (
    <div style={{ border: "1px solid " + t.border.default, borderRadius: t.radius.lg, padding: 14, background: t.bg.elevated, display: "flex", flexDirection: "column", gap: 10, fontFamily: t.font.family }}>
      <span style={{ color: t.text.tertiary, fontSize: t.font.label.fontSize }}>{"שאלת קריאה " + String(props.index + 1)}</span>
      <div style={{ fontSize: t.font.body1.fontSize, color: t.text.primary }}>{props.q.prompt}</div>
      <div className="choices" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {props.q.options.map((opt: string, oi: number) => {
          const isA: boolean = oi === props.q.answer;
          const isC: boolean = props.chosen === oi;
          let bg: string = t.bg.base;
          let bd: string = t.border.default;
          let col: string = t.text.primary;
          if (done && isA) { bg = t.fill.successSubtle; bd = t.text.success; col = t.text.successDeep; }
          else if (done && isC) { bg = t.fill.dangerSubtle; bd = t.text.danger; col = t.text.dangerDeep; }
          return (
            <button key={oi} type="button" className="choice" disabled={done} onClick={() => props.onAnswer(oi)} style={{ minHeight: 48, padding: "10px 14px", borderRadius: t.radius.md, border: "1.5px solid " + bd, background: bg, color: col, fontFamily: t.font.family, fontSize: t.font.body1.fontSize, lineHeight: 1.5, cursor: done ? "default" : "pointer", opacity: done && !isA && !isC ? 0.55 : 1, maxWidth: "100%", whiteSpace: "normal", textAlign: "center" }}>
              {opt}
            </button>
          );
        })}
      </div>
      {done ? (
        <div style={{ fontSize: t.font.body1.fontSize, lineHeight: "1.75" }}>
          <span style={{ fontWeight: t.weight.semibold, color: right ? t.text.success : t.text.danger }}>{right ? "נכון! " : "לא בדיוק. "}</span>
          {props.q.explain}
        </div>
      ) : null}
    </div>
  );
}

type MSeg = { text: string; n: number; note: string };
function markSegs(ar: string, m: string[][] | undefined, base: number): MSeg[] {
  const out: MSeg[] = [];
  let rest: string = ar;
  let k: number = base;
  (m ?? []).forEach((pair: string[]) => {
    const w: string = pair[0];
    const at: number = rest.indexOf(w);
    if (at < 0) return;
    if (at > 0) out.push({ text: rest.slice(0, at), n: 0, note: "" });
    k += 1;
    out.push({ text: w, n: k, note: pair[1] ?? "" });
    rest = rest.slice(at + w.length);
  });
  if (rest) out.push({ text: rest, n: 0, note: "" });
  return out;
}

function ReadingView(props: { r: Reading }): ReactNode {
  const t = useGrokTheme();
  const [openHe, setOpenHe] = useState<Record<number, boolean>>({});
  const [openM, setOpenM] = useState<Record<number, boolean>>({});
  const allOpen: boolean = props.r.paras.every((_: RSent[], i: number) => openHe[i] === true && openM[i] === true);
  const setAll = (v: boolean): void => {
    const o: Record<number, boolean> = {};
    props.r.paras.forEach((_: RSent[], i: number) => { o[i] = v; });
    setOpenHe(o); setOpenM({ ...o });
  };
  const small = (label: string, onClick: () => void): ReactNode => (
    <button type="button" onClick={onClick} style={{ minHeight: 44, padding: "10px 14px", borderRadius: t.radius.full, border: "1px solid " + t.border.default, background: t.bg.base, color: t.text.primary, fontFamily: t.font.family, fontSize: t.font.body2.fontSize, cursor: "pointer" }}>{label}</button>
  );
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: t.font.family }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{small(allOpen ? "הסתר את כל התרגומים וההסברים" : "פתח את כל התרגומים וההסברים", () => setAll(!allOpen))}</div>
      {props.r.paras.map((p: RSent[], pi: number) => {
        let k: number = 0;
        const sentSegs: MSeg[][] = p.map((s: RSent) => {
          const segs: MSeg[] = markSegs(s.ar, s.m, k);
          k += segs.filter((g: MSeg) => g.n > 0).length;
          return segs;
        });
        const notes: MSeg[] = [];
        sentSegs.forEach((segs: MSeg[]) => segs.forEach((g: MSeg) => { if (g.n > 0) notes.push(g); }));
        return (
          <div key={pi} style={{ border: "1px solid " + t.border.default, borderRadius: t.radius.lg, padding: 14, background: t.bg.elevated, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ color: t.text.tertiary, fontSize: t.font.label.fontSize }}>{"פסקה " + String(pi + 1)}</div>
            <div lang="ar" dir="rtl" style={{ fontSize: 22, lineHeight: "2.2", color: t.text.primary, wordBreak: "break-word" }}>
              {sentSegs.map((segs: MSeg[], si: number) => (
                <span key={si}>
                  {segs.map((g: MSeg, gi: number) => g.n > 0 ? (
                    <span key={gi} style={{ fontWeight: t.weight.semibold, color: t.text.accentDeep, borderBottom: "2px solid " + t.text.accent }}>{g.text}<sup style={{ fontSize: 12, color: t.text.accent, marginInlineStart: 2 }}>{String(g.n)}</sup></span>
                  ) : (
                    <span key={gi}>{g.text}</span>
                  ))}
                  {" "}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {small(openHe[pi] ? "הסתר תרגום" : "תרגום הפסקה", () => setOpenHe({ ...openHe, [pi]: !openHe[pi] }))}
              {notes.length ? small(openM[pi] ? "הסתר הסברים" : "הסבר המבנים המסומנים (" + String(notes.length) + ")", () => setOpenM({ ...openM, [pi]: !openM[pi] })) : null}
            </div>
            {openHe[pi] ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: t.radius.md, background: t.bg.subtle }}>
                {p.map((s: RSent, si: number) => (
                  <div key={si} style={{ fontSize: t.font.body1.fontSize, lineHeight: "1.8", color: t.text.secondary }}>{s.he}</div>
                ))}
              </div>
            ) : null}
            {openM[pi] ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: t.radius.md, background: t.bg.subtle, fontSize: t.font.body2.fontSize, lineHeight: "1.75", color: t.text.primary }}>
                {notes.map((g: MSeg) => (
                  <div key={g.n}>
                    <span lang="ar" style={{ fontSize: 22, lineHeight: 2.2, fontWeight: t.weight.semibold, color: t.text.accentDeep }}>{String(g.n) + ". " + g.text}</span>
                    <span>{" — " + g.note}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ContReadingView(props: { p: ContPassage; idx: number; endings?: boolean }): ReactNode {
  const t = useGrokTheme();
  const strip = (s: string): string => (props.endings ? noEndings(s) : noVowels(s));
  const [rev, setRev] = useState<number>(0);
  const [selfOk, setSelfOk] = useState<Record<number, boolean>>({});
  const words: string[][] = props.p.sents.map((s: CSent) => s.v.split(" "));
  const starts: number[] = [];
  let acc: number = 0;
  words.forEach((w: string[]) => { starts.push(acc); acc += w.length; });
  const total: number = acc;
  const curS: number = starts.findIndex((st: number, i: number) => rev < st + words[i].length);
  const answered: number = Object.keys(selfOk).length;
  const okCount: number = Object.keys(selfOk).filter((k: string) => selfOk[Number(k)] === true).length;
  const small = (label: string, onClick: () => void, on?: boolean): ReactNode => (
    <button type="button" onClick={onClick} style={{ minHeight: 44, padding: "10px 14px", borderRadius: t.radius.full, border: "1px solid " + (on ? t.text.accent : t.border.default), background: on ? t.fill.accentSubtle : t.bg.base, color: on ? t.text.accentDeep : t.text.primary, fontFamily: t.font.family, fontSize: t.font.body2.fontSize, cursor: "pointer" }}>{label}</button>
  );
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: t.font.family, border: "1px solid " + t.border.default, borderRadius: t.radius.lg, padding: 14, background: t.bg.elevated }}>
      <div style={{ color: t.text.tertiary, fontSize: t.font.label.fontSize }}>{"קטע " + String(props.idx + 1)}</div>
      <Ar size={24}>{props.p.title}</Ar>
      <div style={{ fontSize: t.font.body2.fontSize, lineHeight: "1.7", color: t.text.secondary }}>{props.p.intro}</div>
      <div style={{ padding: 12, borderRadius: t.radius.md, background: t.bg.subtle, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontWeight: t.weight.semibold, fontSize: t.font.label.fontSize, color: t.text.secondary }}>{props.endings ? "שלב 1 — קראו בקול והוסיפו בראש את הסיומות החסרות" : "שלב 1 — קראו בקול את הקטע בלי ניקוד"}</div>
        <div lang="ar" dir="rtl" style={{ fontSize: 24, lineHeight: "2.3", color: t.text.primary, wordBreak: "break-word" }}>{props.p.sents.map((s: CSent) => strip(s.v)).join(" ")}</div>
      </div>
      <div style={{ fontWeight: t.weight.semibold, fontSize: t.font.label.fontSize, color: t.text.secondary }}>שלב 2 — חשפו את הניקוד המלא ובדקו את עצמכם</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {small("חשוף מילה הבאה", () => setRev(Math.min(total, rev + 1)))}
        {small("חשוף משפט שלם", () => { if (curS >= 0) setRev(starts[curS] + words[curS].length); })}
        {small("חשוף הכול", () => setRev(total))}
        {small("התחל מחדש", () => { setRev(0); setSelfOk({}); })}
        <span style={{ color: t.text.tertiary, fontSize: t.font.label.fontSize }}>{"נחשפו " + String(rev) + "/" + String(total) + " מילים"}</span>
      </div>
      {props.p.sents.map((s: CSent, si: number) => {
        const n: number = words[si].length;
        const shownN: number = Math.max(0, Math.min(n, rev - starts[si]));
        if (shownN === 0) return null;
        const full: boolean = shownN === n;
        const segs: MSeg[] = full ? markSegs(s.v, s.m, 0) : [];
        const notes: MSeg[] = segs.filter((g: MSeg) => g.n > 0);
        return (
          <div key={si} style={{ border: "1px solid " + t.border.default, borderRadius: t.radius.md, padding: 12, background: t.bg.base, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: t.text.tertiary, fontSize: t.font.label.fontSize }}>{"משפט " + String(si + 1)}</div>
            {full ? (
              <div lang="ar" dir="rtl" style={{ fontSize: 23, lineHeight: "2.2", color: t.text.primary, wordBreak: "break-word" }}>
                {segs.map((g: MSeg, gi: number) => g.n > 0 ? (
                  <span key={gi} style={{ fontWeight: t.weight.semibold, color: t.text.accentDeep, borderBottom: "2px solid " + t.text.accent }}>{g.text}<sup style={{ fontSize: 12, color: t.text.accent, marginInlineStart: 2 }}>{String(g.n)}</sup></span>
                ) : (
                  <span key={gi}>{g.text}</span>
                ))}
              </div>
            ) : (
              <div lang="ar" dir="rtl" style={{ fontSize: 23, lineHeight: "2.2", color: t.text.primary, wordBreak: "break-word" }}>
                <span>{words[si].slice(0, shownN).join(" ")}</span>
                <span style={{ color: t.text.tertiary }}>{" " + strip(words[si].slice(shownN).join(" "))}</span>
              </div>
            )}
            {full ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: t.font.body1.fontSize, lineHeight: "1.8", color: t.text.secondary }}>{"תרגום: " + s.he}</div>
                {notes.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 10, borderRadius: t.radius.md, background: t.bg.subtle, fontSize: t.font.body2.fontSize, lineHeight: "1.75" }}>
                    <div style={{ fontWeight: t.weight.semibold }}>החלטות הניקוד במשפט:</div>
                    {notes.map((g: MSeg) => (
                      <div key={g.n}>
                        <span lang="ar" style={{ fontSize: 22, lineHeight: 2.2, fontWeight: t.weight.semibold, color: t.text.accentDeep }}>{String(g.n) + ". " + g.text}</span>
                        <span>{" — " + g.note}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: t.font.label.fontSize, color: t.text.secondary }}>בדיקה עצמית:</span>
                  {small("✓ קראתי נכון", () => setSelfOk({ ...selfOk, [si]: true }), selfOk[si] === true)}
                  {small("✗ טעיתי", () => setSelfOk({ ...selfOk, [si]: false }), selfOk[si] === false)}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {answered > 0 ? (
        <Status tone={okCount === answered ? "success" : "warning"}>{"בדיקה עצמית: קראתי נכון " + String(okCount) + " מתוך " + String(answered) + " משפטים (" + String(props.p.sents.length) + " בקטע)"}</Status>
      ) : null}
      {props.p.gloss.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontWeight: t.weight.semibold }}>מילון הקטע</div>
          <Table columns={["מילה / ביטוי", "פירוש"]} align={["start", "start"]} rows={props.p.gloss.map((g: string[]) => [<span lang="ar" dir="rtl" style={{ fontSize: 22, lineHeight: 2.2 }}>{g[0]}</span>, g[1]])} />
        </div>
      ) : null}
    </div>
  );
}

type WordEntry = { id: string; w: string; topic: string; date: string; ts: number; meaning: string; known: boolean; right?: number; wrong?: number };
const WORDS_KEY: string = "fuskha-portal-words-v1";
let MEM_WORDS: WordEntry[] = [];
let WORD_SEQ: number = 0;
function cleanWords(raw: unknown): WordEntry[] {
  const out: WordEntry[] = [];
  if (!Array.isArray(raw)) return out;
  raw.forEach((v: unknown, i: number) => {
    if (!v || typeof v !== "object") return;
    const o = v as Partial<WordEntry>;
    if (typeof o.w !== "string" || !o.w.trim()) return;
    const ts: number = typeof o.ts === "number" ? o.ts : 0;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : "w" + String(ts) + "-i" + String(i),
      w: o.w.trim(),
      topic: typeof o.topic === "string" ? o.topic : "",
      date: typeof o.date === "string" ? o.date : "",
      ts: ts,
      meaning: typeof o.meaning === "string" ? o.meaning : "",
      known: o.known === true,
      right: typeof o.right === "number" ? o.right : undefined,
      wrong: typeof o.wrong === "number" ? o.wrong : undefined,
    });
  });
  return out;
}
function loadWords(): { data: WordEntry[]; ok: boolean } {
  try {
    const ls = (globalThis as unknown as { localStorage?: { getItem: (k: string) => string | null } }).localStorage;
    if (!ls) return { data: MEM_WORDS, ok: false };
    const raw: string | null = ls.getItem(WORDS_KEY);
    return { data: raw ? cleanWords(JSON.parse(raw)) : [], ok: true };
  } catch (e) {
    return { data: MEM_WORDS, ok: false };
  }
}
function saveWords(list: WordEntry[]): boolean {
  MEM_WORDS = list;
  try {
    const ls = (globalThis as unknown as { localStorage?: { setItem: (k: string, v: string) => void } }).localStorage;
    if (!ls) return false;
    ls.setItem(WORDS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}
const WORDS_INIT: { data: WordEntry[]; ok: boolean } = loadWords();
function addWordEntry(list: WordEntry[], w: string, topic: string, meaning?: string): WordEntry[] {
  const word: string = w.trim();
  if (!word || list.some((x: WordEntry) => x.w === word && x.topic === topic)) return list;
  WORD_SEQ += 1;
  const now: number = Date.now();
  return list.concat([{ id: "w" + String(now) + "-" + String(WORD_SEQ), w: word, topic: topic, date: todayStr(), ts: now, meaning: meaning ?? "", known: false }]);
}
function mergeWords(cur: WordEntry[], incoming: WordEntry[]): { list: WordEntry[]; n: number } {
  const list: WordEntry[] = cur.slice();
  let n: number = 0;
  incoming.forEach((x: WordEntry) => {
    const i: number = list.findIndex((y: WordEntry) => y.id === x.id || (y.w === x.w && y.topic === x.topic));
    if (i < 0) { list.push(x); n += 1; }
    else if (x.ts > list[i].ts) { list[i] = x; n += 1; }
  });
  return { list: list, n: n };
}
function topicName(id: string): string {
  if (id === "mixed") return "תרגול מעורב";
  if (id === "manual") return "הוספה ידנית";
  const tp: TopicData | undefined = TOPICS.find((x: TopicData) => x.id === id);
  return tp ? String(tp.num) + ". " + tp.titleHe : id || "–";
}
function buildWordsExport(list: WordEntry[]): string {
  const learn: WordEntry[] = list.filter((x: WordEntry) => !x.known);
  const known: WordEntry[] = list.filter((x: WordEntry) => x.known);
  const line = (x: WordEntry): string => "• " + x.w + " — " + (x.meaning || "?") + " (" + topicName(x.topic) + ", " + (x.date || "–") + ")";
  const out: string[] = ["המילים שלא ידעתי — " + String(list.length) + " מילים (" + todayStr() + ")"];
  if (learn.length) { out.push(""); out.push("לשינון (" + String(learn.length) + "):"); learn.forEach((x: WordEntry) => out.push(line(x))); }
  if (known.length) { out.push(""); out.push("כבר ידועות (" + String(known.length) + "):"); known.forEach((x: WordEntry) => out.push(line(x))); }
  return out.join("\n");
}

function sectionOfTopic(id: string): string {
  if (TOPIC_SECTION[id]) return TOPIC_SECTION[id];
  const ca: SectionDef | undefined = SECTIONS.find((s: SectionDef) => s.catchAll);
  return ca ? ca.id : SECTIONS[0].id;
}
function dateKey(d: string): number {
  const p: string[] = d.split(".");
  return p.length === 3 ? Number(p[2]) * 10000 + Number(p[1]) * 100 + Number(p[0]) : 0;
}

function WordsView(props: { words: WordEntry[]; onChange: (next: WordEntry[]) => void }): ReactNode {
  const t = useGrokTheme();
  const [wFilter, setWFilter] = useState<string>("learn");
  const [editId, setEditId] = useState<string>("");
  const [editDraft, setEditDraft] = useState<string>("");
  const [confirmDel, setConfirmDel] = useState<string>("");
  const [newW, setNewW] = useState<string>("");
  const [newM, setNewM] = useState<string>("");
  const [showExport, setShowExport] = useState<boolean>(false);
  const [copyMsg, setCopyMsg] = useState<string>("");
  const [fc, setFc] = useState<{ ids: string[]; i: number; show: boolean; right: number; missed: string[]; dir: string } | null>(null);
  const words: WordEntry[] = props.words;
  const learn: WordEntry[] = words.filter((x: WordEntry) => !x.known);
  const known: WordEntry[] = words.filter((x: WordEntry) => x.known);
  const withMeaning: WordEntry[] = learn.filter((x: WordEntry) => x.meaning.trim() !== "");
  const shown: WordEntry[] = (wFilter === "learn" ? learn : wFilter === "known" ? known : words).slice().sort((a: WordEntry, b: WordEntry) => b.ts - a.ts);
  const upd = (id: string, patch: Partial<WordEntry>): void => props.onChange(words.map((x: WordEntry) => (x.id === id ? { ...x, ...patch, ts: Date.now() } : x)));
  const del = (id: string): void => {
    if (confirmDel !== id) { setConfirmDel(id); return; }
    setConfirmDel("");
    props.onChange(words.filter((x: WordEntry) => x.id !== id));
  };
  const addManual = (): void => {
    if (!newW.trim()) return;
    props.onChange(addWordEntry(words, newW, "manual", newM.trim()));
    setNewW(""); setNewM("");
  };
  const saveEdit = (id: string): void => { upd(id, { meaning: editDraft.trim() }); setEditId(""); setEditDraft(""); };
  const exportText: string = buildWordsExport(words);
  const copyAll = (): void => {
    setShowExport(true);
    const fail: string = "ההעתקה האוטומטית לא זמינה כאן — סמנו את הטקסט שבתיבה למטה והעתיקו ידנית.";
    try {
      const nav = (globalThis as unknown as { navigator?: { clipboard?: { writeText: (s: string) => Promise<void> } } }).navigator;
      if (nav && nav.clipboard) nav.clipboard.writeText(exportText).then(() => setCopyMsg("הועתק! אפשר להדביק בצ׳אט, במסמך או בהודעה."), () => setCopyMsg(fail));
      else setCopyMsg(fail);
    } catch (e) {
      setCopyMsg(fail);
    }
  };
  const startFc = (dir: string, only?: string[]): void => {
    const base: WordEntry[] = only ? learn.filter((x: WordEntry) => only.indexOf(x.id) >= 0) : learn;
    const pool: WordEntry[] = dir === "he" ? base.filter((x: WordEntry) => x.meaning.trim() !== "") : base;
    if (!pool.length) return;
    setFc({ ids: shuffle(pool).map((x: WordEntry) => x.id), i: 0, show: false, right: 0, missed: [], dir: dir });
  };
  const answerFc = (ok: boolean, markKnown?: boolean): void => {
    if (!fc) return;
    const id: string = fc.ids[fc.i];
    const cur: WordEntry | undefined = words.find((x: WordEntry) => x.id === id);
    if (cur) {
      const patch: Partial<WordEntry> = ok ? { right: (cur.right ?? 0) + 1 } : { wrong: (cur.wrong ?? 0) + 1 };
      if (markKnown) patch.known = true;
      upd(id, patch);
    }
    setFc({ ...fc, i: fc.i + 1, show: false, right: fc.right + (ok ? 1 : 0), missed: ok ? fc.missed : fc.missed.concat([id]) });
  };
  const card = { padding: 12, borderRadius: t.radius.md, border: "1px solid " + t.border.default, background: t.bg.subtle, display: "flex", flexDirection: "column" as const, gap: 8 };
  const small = { fontSize: t.font.subtext.fontSize, color: t.text.secondary };
  const fcWord: WordEntry | undefined = fc && fc.i < fc.ids.length ? words.find((x: WordEntry) => x.id === fc.ids[fc.i]) : undefined;

  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: t.font.family }}>
      <Callout lead="איך זה עובד" tone="info">
        <div style={{ lineHeight: "1.7", fontSize: t.font.body1.fontSize }}>
          כל מילה שרושמים בתיבה ״מילים שלא ידעתי״ בתוך נושא (או בתרגול מעורב) נשמרת כאן אוטומטית, עם הנושא והתאריך. כאן אפשר להוסיף פירוש, לסמן מילה כ״ידועה״, למחוק, לשנן בכרטיסיות ולהעתיק את כל הרשימה. הרשימה נשמרת בדפדפן ונכללת בקוד הגיבוי.
        </div>
      </Callout>
      <div style={{ fontSize: t.font.heading3.fontSize, fontWeight: t.weight.semibold }}>{String(words.length) + " מילים · לשינון " + String(learn.length) + " · ידועות " + String(known.length)}</div>

      <div style={card}>
        <div style={{ fontWeight: t.weight.semibold }}>🃏 כרטיסיות — בוחן עצמי</div>
        {fc && fcWord ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={small}>{"כרטיס " + String(fc.i + 1) + " מתוך " + String(fc.ids.length) + " · ידעתי " + String(fc.right) + " · עוד לא " + String(fc.missed.length)}</div>
            <div style={{ padding: 18, borderRadius: t.radius.md, background: t.bg.elevated, border: "1px solid " + t.border.default, textAlign: "center" }}>
              {fc.dir === "ar"
                ? <div lang="ar" dir="rtl" style={{ fontSize: 32, lineHeight: 2.2 }}>{fcWord.w}</div>
                : <div style={{ fontSize: 22 }}>{fcWord.meaning}</div>}
              {fc.show ? (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed " + t.border.default }}>
                  {fc.dir === "ar"
                    ? <div style={{ fontSize: 20 }}>{fcWord.meaning || "(עוד אין פירוש — אפשר להוסיף ברשימה למטה)"}</div>
                    : <div lang="ar" dir="rtl" style={{ fontSize: 28 }}>{fcWord.w}</div>}
                  <div style={small}>{topicName(fcWord.topic) + " · " + (fcWord.date || "–")}</div>
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {fc.show ? (
                <>
                  <Button label="ידעתי ✓" variant="primary" onClick={() => answerFc(true)} />
                  <Button label="עוד לא ✗" onClick={() => answerFc(false)} />
                  <Button label="ידעתי — ולהעביר ל״ידועות״" onClick={() => answerFc(true, true)} />
                </>
              ) : (
                <Button label="הצג תשובה" variant="primary" onClick={() => setFc({ ...fc, show: true })} />
              )}
              <Button label="סיים" variant="quiet" onClick={() => setFc(null)} />
            </div>
          </div>
        ) : fc ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: t.font.heading3.fontSize }}>{"סיום! ידעתי " + String(fc.right) + " מתוך " + String(fc.ids.length)}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {fc.missed.length ? <Button label={"שוב רק את מה שלא ידעתי (" + String(fc.missed.length) + ")"} variant="primary" onClick={() => startFc(fc.dir, fc.missed)} /> : null}
              <Button label="סבב חדש" onClick={() => startFc(fc.dir)} />
              <Button label="סגור" variant="quiet" onClick={() => setFc(null)} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={small}>הכרטיסיות כוללות רק מילים שעוד לא סומנו כידועות, בסדר אקראי. מראים את המילה, מנסים להיזכר, ולוחצים ״הצג תשובה״.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Button label={"ערבית ← פירוש (" + String(learn.length) + ")"} variant="primary" disabled={learn.length === 0} onClick={() => startFc("ar")} />
              <Button label={"פירוש ← ערבית (" + String(withMeaning.length) + ")"} disabled={withMeaning.length === 0} onClick={() => startFc("he")} />
            </div>
            {learn.length > 0 && withMeaning.length < learn.length ? <div style={small}>{"ל־" + String(learn.length - withMeaning.length) + " מילים עוד אין פירוש — הוסיפו פירוש כדי שיופיעו גם בכיוון פירוש ← ערבית."}</div> : null}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: t.weight.semibold }}>➕ הוספה ידנית</div>
        <Input label="מילה (בערבית)" value={newW} onChange={setNewW} placeholder="למשל: فَرَضِيَّة" />
        <Input label="פירוש (לא חובה)" value={newM} onChange={setNewM} placeholder="למשל: השערה" />
        <div><Button label="הוסף לרשימה" onClick={addManual} disabled={!newW.trim()} /></div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button label={"לשינון (" + String(learn.length) + ")"} variant={wFilter === "learn" ? "primary" : "quiet"} onClick={() => setWFilter("learn")} />
        <Button label={"ידועות (" + String(known.length) + ")"} variant={wFilter === "known" ? "primary" : "quiet"} onClick={() => setWFilter("known")} />
        <Button label={"הכל (" + String(words.length) + ")"} variant={wFilter === "all" ? "primary" : "quiet"} onClick={() => setWFilter("all")} />
      </div>
      {shown.length === 0 ? (
        <div style={{ color: t.text.secondary }}>{words.length === 0 ? "עוד אין מילים. בכל נושא, אחרי השאלות, יש תיבה ״מילים שלא ידעתי״ — מה שרושמים שם יופיע כאן." : "אין מילים בסינון הזה."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map((x: WordEntry) => (
            <div key={x.id} style={card}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span lang="ar" dir="rtl" style={{ fontSize: 26, lineHeight: 2.2 }}>{x.w}</span>
                <span style={small}>{topicName(x.topic) + " · " + (x.date || "–") + (x.known ? " · ✓ ידועה" : "") + (x.right || x.wrong ? " · כרטיסיות ✓" + String(x.right ?? 0) + " ✗" + String(x.wrong ?? 0) : "")}</span>
              </div>
              {editId === x.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Input label="פירוש" value={editDraft} onChange={setEditDraft} placeholder="כתבו את הפירוש" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button label="שמור" variant="primary" onClick={() => saveEdit(x.id)} />
                    <Button label="ביטול" variant="quiet" onClick={() => { setEditId(""); setEditDraft(""); }} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: t.font.body1.fontSize, color: x.meaning ? t.text.primary : t.text.secondary }}>{x.meaning ? "פירוש: " + x.meaning : "עוד אין פירוש"}</div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {editId === x.id ? null : <Button label={x.meaning ? "ערוך פירוש" : "הוסף פירוש"} onClick={() => { setEditId(x.id); setEditDraft(x.meaning); }} />}
                <Button label={x.known ? "החזר לשינון" : "סמן כידועה ✓"} onClick={() => upd(x.id, { known: !x.known })} />
                <Button label={confirmDel === x.id ? "לאשר מחיקה?" : "מחק"} variant="quiet" onClick={() => del(x.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: t.weight.semibold }}>📋 ייצוא</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button label="העתק את כל הרשימה" variant="primary" disabled={words.length === 0} onClick={copyAll} />
          <Button label={showExport ? "הסתר טקסט" : "הצג כטקסט"} onClick={() => setShowExport(!showExport)} />
        </div>
        {copyMsg ? <div style={{ fontSize: t.font.subtext.fontSize }}>{copyMsg}</div> : null}
        {showExport ? <div style={{ whiteSpace: "pre-wrap", userSelect: "text", padding: 10, borderRadius: t.radius.md, background: t.bg.elevated, border: "1px solid " + t.border.default, lineHeight: "1.8" }}>{exportText}</div> : null}
      </div>
    </div>
  );
}

export default function App() {
  const t = useGrokTheme();
  const rows: RowInfo[] = useMemo(() => allTopicRows(), []);
  const readyTopics: TopicData[] = TOPICS.filter((tp: TopicData) => tp.ready && tp.questions.length > 0);

  const [phase, setPhase] = useState<Phase>("home");
  const [topicId, setTopicId] = useState<string>("");
  const [isMixed, setIsMixed] = useState<boolean>(false);
  const [sessionQs, setSessionQs] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [readAnswers, setReadAnswers] = useState<Record<string, number>>({});
  const [showHe, setShowHe] = useState<boolean>(false);
  const [wordDraft, setWordDraft] = useState<string>("");
  const [unknownWords, setUnknownWords] = useState<string[]>([]);
  const [isAdaptive, setIsAdaptive] = useState<boolean>(false);
  const [sessionRQs, setSessionRQs] = useState<ReadQ[]>([]);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [openRules, setOpenRules] = useState<Record<number, boolean>>({});
  const [showTables, setShowTables] = useState<boolean>(false);
  const [showGloss, setShowGloss] = useState<boolean>(false);
  const [showBrief, setShowBrief] = useState<boolean>(false);
  const [quizRules, setQuizRules] = useState<boolean>(false);
  const [round, setRound] = useState<number>(0);
  const [levelLabel, setLevelLabel] = useState<string>("");
  const [progress, setProgress] = useState<Progress>(PROGRESS_INIT.data);
  const [storageOk, setStorageOk] = useState<boolean>(PROGRESS_INIT.ok);
  const [pFilter, setPFilter] = useState<string>("all");
  const [confirmReset, setConfirmReset] = useState<string>("");
  const [showBackup, setShowBackup] = useState<boolean>(false);
  const [backupDraft, setBackupDraft] = useState<string>("");
  const [backupMsg, setBackupMsg] = useState<string>("");
  const recordedRound = useRef<number>(-1);
  const [section, setSection] = useState<string>("");
  const [mixPool, setMixPool] = useState<string[]>([]);
  const [words, setWords] = useState<WordEntry[]>(WORDS_INIT.data);
  const [wordsOk, setWordsOk] = useState<boolean>(WORDS_INIT.ok);
  const commitWords = (next: WordEntry[]): void => { setWords(next); setWordsOk(saveWords(next)); };
  const openSection = (id: string): void => { setSection(id); setPFilter("all"); setConfirmReset(""); };
  const commitProgress = (next: Progress): void => { setProgress(next); setStorageOk(saveProgress(next)); };

  const topic: TopicData | undefined = readyTopics.find((x: TopicData) => x.id === topicId);

  const startTopic = (id: string, mixed: boolean, pool?: string[]): void => {
    setIsMixed(mixed); setIsAdaptive(false); setAnswers({}); setReadAnswers({}); setShowHe(false); setUnknownWords([]); setWordDraft(""); setShowKey(false); setSessionRQs([]);
    setOpenRules({}); setShowTables(false); setShowGloss(false); setShowBrief(false); setQuizRules(false); setLevelLabel(""); setRound((r: number) => r + 1);
    if (mixed) {
      setTopicId("mixed");
      const usePool: string[] = pool ?? mixPool;
      setMixPool(usePool);
      const bank: Q[] = [];
      readyTopics.forEach((tp: TopicData) => { if (usePool.length === 0 || usePool.indexOf(tp.id) >= 0) tp.questions.forEach((qq: Q) => bank.push(qq)); });
      setSessionQs(pickQuestions(bank, 10));
      setPhase("reminder");
    } else {
      const tp: TopicData | undefined = readyTopics.find((x: TopicData) => x.id === id);
      if (!tp) return;
      setTopicId(id);
      setSection(sectionOfTopic(id));
      const parts: { prefix: string; n: number }[] | undefined = tp.parts;
      setSessionQs(parts ? parts.reduce((accQ: Q[], p: { prefix: string; n: number }) => accQ.concat(pickQuestions(tp.questions.filter((qq: Q) => qq.id.indexOf(p.prefix) === 0), p.n)), []) : pickQuestions(tp.questions, 10));
      setSessionRQs(tp.readingQs.map(shuffleRQ));
      setPhase("reminder");
    }
  };

  const onAnswer = (qid: string, choice: number): void => {
    setAnswers((prev: Record<string, number>) => (prev[qid] !== undefined ? prev : { ...prev, [qid]: choice }));
  };
  const onReadAnswer = (qid: string, choice: number): void => {
    setReadAnswers((prev: Record<string, number>) => (prev[qid] !== undefined ? prev : { ...prev, [qid]: choice }));
  };
  const addWord = (): void => {
    const w: string = wordDraft.trim();
    if (!w) return;
    if (unknownWords.indexOf(w) >= 0) { setWordDraft(""); return; }
    setUnknownWords((prev: string[]) => prev.concat([w]));
    setWordDraft("");
    commitWords(addWordEntry(words, w, isMixed ? "mixed" : topicId));
  };
  const removeWord = (i: number): void => {
    const rw: string | undefined = unknownWords[i];
    const rk: string = isMixed ? "mixed" : topicId;
    if (rw !== undefined) {
      const kept: WordEntry[] = words.filter((x: WordEntry) => !(x.w === rw && x.topic === rk && !x.known && !x.meaning));
      if (kept.length !== words.length) commitWords(kept);
    }
    setUnknownWords((prev: string[]) => prev.filter((_: string, idx: number) => idx !== i));
  };

  const quizDone: boolean = sessionQs.length > 0 && sessionQs.every((qq: Q) => answers[qq.id] !== undefined);
  const readDone: boolean = !topic || isMixed ? true : sessionRQs.every((qq: ReadQ) => readAnswers[qq.id] !== undefined);
  const wrongQs: Q[] = sessionQs.filter((qq: Q) => answers[qq.id] !== undefined && answers[qq.id] !== qq.answer);
  const correctCount: number = sessionQs.filter((qq: Q) => answers[qq.id] === qq.answer).length;
  const missedSubRuleIds: string[] = [];
  wrongQs.forEach((qq: Q) => { if (missedSubRuleIds.indexOf(qq.subRuleId) < 0) missedSubRuleIds.push(qq.subRuleId); });
  const subRuleName = (id: string): string => {
    for (let i = 0; i < readyTopics.length; i++) {
      const sr: SubRule | undefined = readyTopics[i].subRules.find((s: SubRule) => s.id === id);
      if (sr) return sr.nameHe;
    }
    return id;
  };
  const missedNames: string[] = missedSubRuleIds.map(subRuleName);
  const topicLabel: string = isMixed ? "מעורב" : topic ? topic.titleHe.slice(0, 40) : "";
  const progressKey: string = isMixed ? "mixed" : topicId;
  useEffect(() => {
    if (!quizDone || !progressKey || recordedRound.current === round) return;
    recordedRound.current = round;
    commitProgress(recordRound(progress, progressKey, correctCount, sessionQs.length, isAdaptive));
  }, [quizDone, round]);
  const topicIds: string[] = readyTopics.map((tp: TopicData) => tp.id);
  const pc: { done: number; review: number; none: number } = progressCounts(progress, topicIds);
  const overallLine: string = "תורגלו " + String(pc.done + pc.review) + " מתוך " + String(topicIds.length) + " · לחזרה " + String(pc.review) + " · לא תורגלו " + String(pc.none);
  const curEntry: PracticeEntry | undefined = progressKey ? progress[progressKey] : undefined;
  const statusForSummary: string = isMixed
    ? "סטטוס: תרגול מעורב, סבב " + String(curEntry ? curEntry.rounds : 0) + " · " + overallLine
    : "סטטוס: " + practiceLabel(curEntry) + (curEntry && curEntry.rounds ? " · סבבים " + String(curEntry.rounds) + " · טעויות מצטבר " + String(curEntry.mistakes) : "") + " · " + overallLine;
  const summaryText: string = buildSummary(topicLabel, correctCount, sessionQs.length, missedNames, unknownWords, statusForSummary);

  const startAdaptive = (): void => {
    const pool: Q[] = [];
    let source: Q[] = [];
    if (isMixed) readyTopics.forEach((tp: TopicData) => { if (mixPool.length === 0 || mixPool.indexOf(tp.id) >= 0) tp.questions.forEach((qq: Q) => source.push(qq)); });
    else if (topic) source = topic.questions;
    wrongQs.forEach((qq: Q) => pool.push(qq));
    source.forEach((qq: Q) => {
      if (missedSubRuleIds.indexOf(qq.subRuleId) >= 0 && pool.findIndex((p: Q) => p.id === qq.id) < 0) pool.push(qq);
    });
    setSessionQs(pickQuestions(pool.length ? pool : source, 10));
    if (topic && !isMixed) setSessionRQs(topic.readingQs.map(shuffleRQ));
    setAnswers({}); setReadAnswers({}); setShowHe(false); setShowKey(false); setIsAdaptive(true); setQuizRules(false); setRound((r: number) => r + 1); setPhase("quiz");
  };
  const rulesFor = (qq: Q): ReminderBlock[] | undefined => {
    const owner: TopicData | undefined = readyTopics.find((tp: TopicData) => tp.questions.some((x: Q) => x.id === qq.id));
    if (!owner || !owner.reminderBlocks || owner.reminderBlocks.length === 0) return undefined;
    const hit: ReminderBlock[] = owner.reminderBlocks.filter((b: ReminderBlock) => (b.srs ?? []).indexOf(qq.subRuleId) >= 0);
    return hit.length ? hit : owner.reminderBlocks;
  };
  const curLevels: { label: string; prefix: string; n: number }[] = !isMixed && topic && topic.levels ? topic.levels : [];
  const levelCount = (p: string): number => (topic ? topic.questions.filter((qq: Q) => qq.id.indexOf(p) === 0).length : 0);
  const startLevel = (lv: { label: string; prefix: string; n: number }): void => {
    if (!topic) return;
    setSessionQs(pickQuestions(topic.questions.filter((qq: Q) => qq.id.indexOf(lv.prefix) === 0), lv.n));
    setAnswers({}); setReadAnswers({}); setLevelLabel(lv.label); setQuizRules(false); setRound((r: number) => r + 1); setPhase("quiz");
  };
  const linkTo: { id: string; label: string } | undefined = !isMixed && topic ? topic.link : undefined;
  const allBlocks: ReminderBlock[] = !isMixed && topic && topic.reminderBlocks ? topic.reminderBlocks : [];
  const toggleRule = (i: number): void => setOpenRules((prev: Record<number, boolean>) => ({ ...prev, [i]: !prev[i] }));
  const setAllRules = (v: boolean): void => {
    const o: Record<number, boolean> = {};
    allBlocks.forEach((_: ReminderBlock, i: number) => { o[i] = v; });
    setOpenRules(o);
  };

  const goHome = (): void => {
    setPhase("home"); setTopicId(""); setIsMixed(false); setIsAdaptive(false); setSessionQs([]); setAnswers({}); setReadAnswers({});
  };
  const markManual = (id: string): void => {
    const old: PracticeEntry | undefined = progress[id];
    const base: PracticeEntry = old ? { ...old, history: old.history.slice() } : { date: "", ts: 0, correct: 0, total: 0, rounds: 0, mistakes: 0, lastMistakes: 0, history: [] };
    base.manual = true; base.manualDate = todayStr(); base.ts = Date.now();
    commitProgress({ ...progress, [id]: base });
  };
  const unmark = (id: string): void => {
    const old: PracticeEntry | undefined = progress[id];
    if (!old) return;
    if (old.rounds > 0 && confirmReset !== id) { setConfirmReset(id); return; }
    const next: Progress = { ...progress };
    delete next[id];
    setConfirmReset("");
    commitProgress(next);
  };
  const exportCode: string = JSON.stringify({ v: 2, progress: progress, words: words });
  const importBackup = (): void => {
    try {
      const parsed: unknown = JSON.parse(backupDraft.trim());
      const isV2: boolean = !!parsed && typeof parsed === "object" && (parsed as { v?: unknown }).v === 2;
      const incoming: Progress = cleanProgress(isV2 ? (parsed as { progress?: unknown }).progress : parsed);
      const inWords: WordEntry[] = isV2 ? cleanWords((parsed as { words?: unknown }).words) : [];
      const next: Progress = { ...progress };
      let n: number = 0;
      Object.keys(incoming).forEach((k: string) => { if (!next[k] || incoming[k].ts > next[k].ts) { next[k] = incoming[k]; n += 1; } });
      commitProgress(next);
      const mw: { list: WordEntry[]; n: number } = mergeWords(words, inWords);
      if (mw.n) commitWords(mw.list);
      setBackupDraft("");
      setBackupMsg("שוחזרו " + String(n) + " נושאים ו־" + String(mw.n) + " מילים מהקוד.");
    } catch (e) {
      setBackupMsg("הקוד לא תקין — העתיקו אותו שוב במלואו.");
    }
  };
  const filterRow = (st: PState): boolean => pFilter === "all" || (pFilter === "done" ? st !== "none" : pFilter === "none" ? st === "none" : st === "review");
  const shownRows: RowInfo[] = rows.filter((r: RowInfo) => filterRow(practiceState(progress[r.id])));

  if (phase === "home") {
    const navBar: ReactNode = (
      <div className="nav-bar" dir="rtl" style={{ display: "flex", flexWrap: "wrap", gap: 6, fontFamily: t.font.family }}>
        <Button label="🏠 בית" variant={section === "" ? "primary" : "quiet"} onClick={() => openSection("")} />
        {SECTIONS.map((s: SectionDef) => (
          <Button key={s.id} label={s.icon + " " + s.titleHe} variant={section === s.id ? "primary" : "quiet"} onClick={() => openSection(s.id)} />
        ))}
      </div>
    );
    const storageNote: ReactNode = (
      <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: t.font.family }}>
        <div style={{ fontSize: t.font.subtext.fontSize, color: storageOk && wordsOk ? t.text.secondary : t.text.primary }}>{storageOk && wordsOk ? "השמירה פעילה בדפדפן הזה — סטטוס התרגול והמילים שלא ידעתי נשמרים גם אחרי רענון. במכשיר או דפדפן אחר הכל מתחיל ריק; להעברה השתמשו בקוד הגיבוי." : "שימו לב: הדפדפן לא מאפשר שמירה קבועה כאן, אז הסטטוס והמילים נשמרים רק עד שסוגרים או מרעננים. כדי לא לאבד — העתיקו את קוד הגיבוי."}</div>
        <div><Button label={showBackup ? "הסתר קוד גיבוי" : "גיבוי / העברה בין מכשירים"} onClick={() => setShowBackup(!showBackup)} /></div>
        {showBackup ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>הקוד כולל את סטטוס התרגול ואת המילים שלא ידעתי. העתיקו אותו ושמרו (או שלחו לעוזר). במכשיר אחר הדביקו אותו בשדה למטה ולחצו ״שחזר״. גם קוד ישן (רק סטטוס תרגול) עדיין עובד.</div>
            <div className="backup-code" dir="ltr" style={{ padding: 10, borderRadius: t.radius.md, border: "1px solid " + t.border.default, background: t.bg.subtle, fontSize: 16, lineHeight: 1.6, userSelect: "text", wordBreak: "break-all", fontFamily: "monospace" }}>{exportCode}</div>
            <Input label="הדבקת קוד גיבוי" value={backupDraft} onChange={setBackupDraft} placeholder="הדביקו כאן את הקוד" />
            <div><Button label="שחזר מהקוד" onClick={importBackup} /></div>
            {backupMsg ? <div style={{ fontSize: t.font.subtext.fontSize }}>{backupMsg}</div> : null}
          </div>
        ) : null}
      </div>
    );
    const secIds = (sid: string): string[] => readyTopics.filter((tp: TopicData) => sectionOfTopic(tp.id) === sid).sort((a: TopicData, b: TopicData) => a.num - b.num).map((tp: TopicData) => tp.id);
    const secLine = (ids: string[]): string => {
      const c: { done: number; review: number; none: number } = progressCounts(progress, ids);
      return "תורגלו " + String(c.done + c.review) + " מתוך " + String(ids.length) + (c.review ? " · לחזרה " + String(c.review) : "") + " · לא תורגלו " + String(c.none);
    };
    const wordsLine: string = String(words.length) + " מילים · לשינון " + String(words.filter((x: WordEntry) => !x.known).length) + " · ידועות " + String(words.filter((x: WordEntry) => x.known).length);
    const sec: SectionDef | undefined = SECTIONS.find((s: SectionDef) => s.id === section);

    if (!sec) {
      return (
        <Page title="פורטל תרגול ערבית – פוסחא" summary="בחרו חלק: דקדוק פוסחא, שיעורים עם דור, אוצר מילים מהמכללה, קריאה וניקוד, או המילים שלא ידעתי." width="column">
          <Section heading="ניווט">{navBar}</Section>
          <Section heading="החלקים בפורטל">
            <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: t.font.family }}>
              <div style={{ fontSize: t.font.heading3.fontSize, fontWeight: t.weight.semibold }}>{"בסך הכל: " + overallLine}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
                {SECTIONS.map((s: SectionDef) => {
                  const ids: string[] = s.kind === "topics" ? secIds(s.id) : [];
                  return (
                    <div key={s.id} style={{ padding: 14, borderRadius: t.radius.md, border: "1px solid " + t.border.default, background: t.bg.subtle, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: t.font.heading3.fontSize, fontWeight: t.weight.semibold }}>{s.icon + " " + s.titleHe}</div>
                      <div style={{ fontSize: t.font.body2.fontSize, lineHeight: "1.7", flex: 1 }}>{s.desc}</div>
                      <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>{s.kind === "words" ? wordsLine : (ids.length ? secLine(ids) : "עוד אין נושאים")}</div>
                      <div><Button label="כניסה" variant="primary" onClick={() => openSection(s.id)} /></div>
                    </div>
                  );
                })}
              </div>
              <Callout lead="איך זה עובד" tone="info">
                <div style={{ lineHeight: "1.7", fontSize: t.font.body1.fontSize }}>
                  נושא ← חוקים לפי בחירה (אפשר לדלג ישר לתרגול; בכל שאלה יש כפתור שפותח את הכלל שלה) ← 10 שאלות (סדר התשובות מתערבב בכל סבב) ← קטע קריאה מעמיק עם תרגום לכל פסקה, הסבר המבנים, מילון ושאלות ← מילים שלא ידעתי ← סבב חיזוק ← סיכום לשליחה.
                </div>
              </Callout>
              <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>✅ תורגל · ⚠️ כדאי לחזור (ציון אחרון מתחת ל־80%) · ⬜ עוד לא תורגל</div>
              <div><Button label="תרגול מעורב מכל הנושאים" onClick={() => startTopic("mixed", true, [])} /></div>
              {progress["mixed"] && progress["mixed"].rounds ? <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>{"תרגול מעורב: " + String(progress["mixed"].rounds) + " סבבים · אחרון " + progress["mixed"].date + " · " + String(progress["mixed"].correct) + "/" + String(progress["mixed"].total) + " (לא נספר כתרגול של נושא מסוים)"}</div> : null}
            </div>
          </Section>
          <Section heading="שמירה וגיבוי">{storageNote}</Section>
        </Page>
      );
    }

    if (sec.kind === "words") {
      return (
        <Page title="פורטל תרגול ערבית – פוסחא" summary={sec.icon + " " + sec.titleHe + " — " + wordsLine} width="column">
          <Section heading="ניווט">{navBar}</Section>
          <Section heading={sec.icon + " " + sec.titleHe}>
            <WordsView words={words} onChange={commitWords} />
          </Section>
          <Section heading="שמירה וגיבוי">{storageNote}</Section>
        </Page>
      );
    }

    const ids: string[] = secIds(sec.id);
    const secTopics: TopicData[] = ids.map((id: string) => readyTopics.find((tp: TopicData) => tp.id === id)).filter((tp: TopicData | undefined): tp is TopicData => !!tp);
    const spc: { done: number; review: number; none: number } = progressCounts(progress, ids);
    const secRows: RowInfo[] = rows.filter((r: RowInfo) => ids.indexOf(r.id) >= 0);
    const secShown: RowInfo[] = secRows.filter((r: RowInfo) => filterRow(practiceState(progress[r.id])));
    const lessons: LessonDef[] = sec.byLesson ? LESSONS.filter((l: LessonDef) => l.section === sec.id && ids.indexOf(l.topicId) >= 0).sort((a: LessonDef, b: LessonDef) => dateKey(b.date) - dateKey(a.date)) : [];
    const looseTopics: TopicData[] = secTopics.filter((tp: TopicData) => !lessons.some((l: LessonDef) => l.topicId === tp.id));
    return (
      <Page title="פורטל תרגול ערבית – פוסחא" summary={sec.icon + " " + sec.titleHe + " — " + secLine(ids)} width="column">
        <Section heading="ניווט">{navBar}</Section>
        <Section heading={sec.icon + " " + sec.titleHe}>
          <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: t.font.family }}>
            <div style={{ fontSize: t.font.body1.fontSize, lineHeight: "1.7" }}>{sec.desc}</div>
            {sec.byLesson ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {lessons.map((l: LessonDef) => (
                  <div key={l.topicId} style={{ padding: 14, borderRadius: t.radius.md, border: "1px solid " + t.border.default, background: t.bg.subtle, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: t.font.heading3.fontSize, fontWeight: t.weight.semibold }}>{"📅 שיעור " + l.date + " · " + l.teacher}</div>
                    <div style={{ fontSize: t.font.body1.fontSize }}>{l.titleHe}</div>
                    <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>{practiceIcon(progress[l.topicId]) + " " + practiceLabel(progress[l.topicId])}</div>
                    <div><Button label="לתרגול השיעור" variant="primary" onClick={() => startTopic(l.topicId, false)} /></div>
                  </div>
                ))}
                {sec.emptyNote ? <Callout lead="שיעורים הבאים" tone="info"><div style={{ lineHeight: "1.7" }}>{sec.emptyNote}</div></Callout> : null}
              </div>
            ) : null}
            {looseTopics.length ? (
              <div className="topic-pills" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {looseTopics.map((tp: TopicData) => (
                  <Button key={tp.id} label={practiceIcon(progress[tp.id]) + " " + String(tp.num) + ". " + tp.titleHe.slice(0, 28)} onClick={() => startTopic(tp.id, false)} />
                ))}
              </div>
            ) : null}
            {!sec.byLesson ? <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>{"ליד כל נושא: ✅ תורגל · ⚠️ כדאי לחזור · ⬜ עוד לא תורגל — " + secLine(ids)}</div> : null}
            {sec.mixed && ids.length > 1 ? <div><Button label={"תרגול מעורב — " + sec.titleHe} variant="primary" onClick={() => startTopic("mixed", true, ids)} /></div> : null}
          </div>
        </Section>
        <Section heading={"נושאים שכיסיתי ונושאים שלא — " + sec.titleHe}>
          <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: t.font.family }}>
            <div style={{ fontSize: t.font.heading3.fontSize, fontWeight: t.weight.semibold }}>{secLine(ids)}</div>
            <div style={{ fontSize: t.font.body2.fontSize, lineHeight: "1.8", padding: 10, borderRadius: t.radius.md, background: t.bg.subtle }}>
              <div><b>מקרא:</b></div>
              <div>✅ תורגל — סיימתי סבב בפורטל (או סימנתי ידנית), הציון האחרון 80% ומעלה.</div>
              <div>⚠️ תורגל – כדאי לחזור — הציון בסבב הרגיל האחרון מתחת ל־80%.</div>
              <div>⬜ עדיין לא תורגל — אין סבב שמור ואין סימון ידני.</div>
              <div style={{ color: t.text.secondary }}>הסטטוס נשמר אוטומטית כשמסיימים לענות על כל שאלות הסבב (כולל סבב לפי רמה וסבב חיזוק). ״סמן כתורגל״ — לנושא שתרגלתי מחוץ לפורטל, למשל עם דור. ״עודכן״ = מתי התוכן של הנושא נבנה או עודכן, לא מתי תרגלתי.</div>
            </div>
            <div className="filters" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Button label={"הכל (" + String(secRows.length) + ")"} variant={pFilter === "all" ? "primary" : "quiet"} onClick={() => setPFilter("all")} />
              <Button label={"תורגלו (" + String(spc.done + spc.review) + ")"} variant={pFilter === "done" ? "primary" : "quiet"} onClick={() => setPFilter("done")} />
              <Button label={"לא תורגלו (" + String(spc.none) + ")"} variant={pFilter === "none" ? "primary" : "quiet"} onClick={() => setPFilter("none")} />
              <Button label={"לחזרה (" + String(spc.review) + ")"} variant={pFilter === "review" ? "primary" : "quiet"} onClick={() => setPFilter("review")} />
            </div>
            {secShown.length ? (
              <Table columns={["#", "נושא", "סטטוס תרגול", "סבבים וטעויות", "סימון ידני", "עודכן"]} align={["start", "start", "start", "start", "start", "start"]} rows={secShown.map((r: RowInfo) => {
                const pe: PracticeEntry | undefined = progress[r.id];
                const st: PState = practiceState(pe);
                const cell: { text: string; tone?: "success" | "warning" } = st === "done" ? { text: practiceLabel(pe), tone: "success" } : st === "review" ? { text: practiceLabel(pe), tone: "warning" } : { text: practiceLabel(pe) };
                const btn: ReactNode = st === "none"
                  ? <Button label="סמן כתורגל" onClick={() => markManual(r.id)} />
                  : <Button label={confirmReset === r.id ? "לאשר מחיקת התרגולים?" : "בטל"} onClick={() => unmark(r.id)} />;
                return [String(r.num), r.title, cell, practiceDetail(pe), btn, r.upd];
              })} />
            ) : (
              <div style={{ color: t.text.secondary }}>אין נושאים בסינון הזה.</div>
            )}
          </div>
        </Section>
        <Section heading="שמירה וגיבוי">{storageNote}</Section>
      </Page>
    );
  }

  const reminderLines: string[] = isMixed
    ? [mixPool.length ? "תרגול מעורב מנושאי " + (SECTIONS.find((s: SectionDef) => s.id === section) ?? SECTIONS[0]).titleHe + "." : "תרגול מעורב מכל הנושאים המוכנים.", "אחרי כל תשובה: הסבר מורחב + משפט מלא + תרגום + הערות לאפשרויות.", "בסוף: סבב חיזוק לפי טעויות."]
    : topic ? topic.reminder : [];
  const reminderBlocks: ReminderBlock[] | undefined = isMixed ? undefined : topic ? topic.reminderBlocks : undefined;

  if (phase === "reminder") {
    return (
      <Page title="פורטל תרגול ערבית – פוסחא" summary={topicLabel} width="column">
        <Section heading={"תזכורת — " + (isMixed ? "מעורב" : topicLabel)} actions={<Button label="לפורטל" onClick={goHome} />}>
          {!isMixed && topic ? <div dir="rtl" style={{ fontSize: t.font.body2.fontSize, fontWeight: t.weight.semibold }}>{"מצב הנושא: " + practiceLabel(progress[topic.id]) + (progress[topic.id] && progress[topic.id].rounds ? " · " + practiceDetail(progress[topic.id]) : "")}</div> : null}
          <Callout lead="החוקים פתוחים לפי בחירה">
            <div style={{ fontSize: t.font.body2.fontSize, lineHeight: "1.7" }}>אפשר להתחיל מיד בתרגול. החוקים למטה סגורים — פותחים רק את מה שרוצים לחזור עליו. גם בתוך כל שאלה יש כפתור שפותח את הכלל שלה, ובמהלך התרגול יש כפתור ״חזרה על הכללים״.</div>
          </Callout>
          <div dir="rtl" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button label={(curLevels.length ? "כל הרמות" : "התחל תרגול") + " (" + String(sessionQs.length) + " שאלות)"} variant="primary" onClick={() => setPhase("quiz")} />
            {curLevels.map((lv: { label: string; prefix: string; n: number }) => (
              <Button key={lv.prefix} label={lv.label + " (" + String(Math.min(lv.n, levelCount(lv.prefix))) + " שאלות)"} onClick={() => startLevel(lv)} />
            ))}
            {linkTo ? <Button label={linkTo.label} onClick={() => startTopic(linkTo.id, false)} /> : null}
          </div>
        </Section>
        <Section heading="חוקים וחזרה על הכללים">
          <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: t.font.family }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {allBlocks.length ? <Button label="הצג חוקים (פתח הכול)" onClick={() => setAllRules(true)} /> : null}
              {allBlocks.length ? <Button label="סגור את כל החוקים" onClick={() => setAllRules(false)} /> : null}
              {!isMixed && topic && topic.tables && topic.tables.length ? <Button label={showTables ? "הסתר טבלאות סיומות" : "טבלאות סיומות"} onClick={() => setShowTables(!showTables)} /> : null}
              {!isMixed && topic && topic.gloss && topic.gloss.length ? <Button label={showGloss ? "הסתר מילון" : "מילון"} onClick={() => setShowGloss(!showGloss)} /> : null}
              {!isMixed && topic && topic.brief && topic.brief.length ? <Button label={showBrief ? "הסתר תקציר מהיר" : "תקציר מהיר"} onClick={() => setShowBrief(!showBrief)} /> : null}
            </div>
            {allBlocks.length ? <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>{"לחצו על כותרת של כלל כדי לפתוח או לסגור אותו (" + String(allBlocks.length) + " כללים)."}</div> : null}
            <ReminderView blocks={reminderBlocks} fallback={reminderLines} open={openRules} onToggle={toggleRule} />
            {showBrief && !isMixed && topic && topic.brief ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontWeight: t.weight.semibold }}>תקציר מהיר</div>
                <ReminderView blocks={topic.brief} fallback={[]} />
              </div>
            ) : null}
          </div>
        </Section>
        {showTables && !isMixed && topic && topic.tables ? topic.tables.map((tb: RTable, ti: number) => (
          <Section key={"tb" + String(ti)} heading={tb.title}>
            <Table columns={tb.columns} align={tb.columns.map((): "start" => "start")} rows={tb.rows.map((r: string[]) => r.map((c: string) => (/[\u05D0-\u05EA]/.test(c) ? c : <span lang="ar" dir="rtl" style={{ fontSize: 22, lineHeight: 2.2 }}>{c}</span>)))} />
          </Section>
        )) : null}
        {showGloss && !isMixed && topic && topic.gloss && topic.gloss.length ? (
          <Section heading="מילון — מילים וביטויים מהשאלות">
            <Table columns={["מילה / ביטוי", "פירוש"]} align={["start", "start"]} rows={topic.gloss.map((g: string[]) => [<span lang="ar" dir="rtl" style={{ fontSize: 22, lineHeight: 2.2 }}>{g[0]}</span>, g[1]])} />
          </Section>
        ) : null}
        <Section heading="מוכנים?">
          <Button label={"התחל תרגול (" + String(sessionQs.length) + " שאלות)"} variant="primary" onClick={() => setPhase("quiz")} />
        </Section>
      </Page>
    );
  }

  if (phase === "quiz") {
    return (
      <Page title="פורטל תרגול ערבית – פוסחא" summary={topicLabel + (isAdaptive ? " · חיזוק" : "")} width="column">
        <Section heading={(isAdaptive ? "סבב חיזוק · " : "") + (isMixed ? "מעורב" : topicLabel) + (levelLabel && !isAdaptive ? " · " + levelLabel : "")} actions={<Button label="לפורטל" onClick={goHome} />}>
          <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: t.font.family }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ color: t.text.secondary, fontSize: t.font.subtext.fontSize }}>{"ענית על " + String(Object.keys(answers).length) + "/" + String(sessionQs.length) + " · נכון: " + String(correctCount)}</span>
              {allBlocks.length ? <Button label={quizRules ? "סגור את החוקים" : "חזרה על הכללים"} onClick={() => setQuizRules(!quizRules)} /> : null}
            </div>
            {quizRules && allBlocks.length ? <ReminderView blocks={allBlocks} fallback={[]} open={openRules} onToggle={toggleRule} /> : null}
            {sessionQs.map((qq: Q, qi: number) => qq.multi ? (
              <MultiCard key={qq.id + "-" + String(qi) + "-" + String(round)} q={qq} index={qi} chosen={answers[qq.id]} onAnswer={(c: number) => onAnswer(qq.id, c)} rules={rulesFor(qq)} />
            ) : (
              <QCard key={qq.id + "-" + String(qi) + "-" + String(round)} q={qq} index={qi} chosen={answers[qq.id]} onAnswer={(c: number) => onAnswer(qq.id, c)} rules={rulesFor(qq)} />
            ))}
            <Divider />
            <div style={{ fontWeight: t.weight.semibold }}>מילים שלא ידעתי</div>
            <Input label="מילה / ביטוי" value={wordDraft} onChange={setWordDraft} placeholder="לדוגמה: ثَرًى" />
            <Button label="הוסף לרשימה" onClick={addWord} />
            <Chips items={unknownWords} onRemove={removeWord} />
            {quizDone ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Status tone="success">{"סיימתם (" + String(correctCount) + "/" + String(sessionQs.length) + ")"}</Status>
                {!isMixed && topic ? (
                  <Button label="המשך לפסקת קריאה" variant="primary" onClick={() => setPhase("reading")} />
                ) : (
                  <Button label="לסיכום" variant="primary" onClick={() => setPhase("summary")} />
                )}
              </div>
            ) : null}
          </div>
        </Section>
      </Page>
    );
  }

  if (phase === "reading" && topic && !isMixed) {
    const endMode: boolean = topic.contMode === "endings";
    return (
      <Page title="פורטל תרגול ערבית – פוסחא" summary={"קריאה · " + topicLabel} width="column">
        <Section heading={topic.cont && endMode ? "פסקה לניקוד סופי — " + String(topic.cont.length) + " קטעים" : topic.cont ? "קריאה רציפה — " + String(topic.cont.length) + " קטעים" : topic.reading ? "קטע קריאה — " + topic.reading.title : "פסקת קריאה"} actions={<Button label="לפורטל" onClick={goHome} />}>
          {topic.cont && endMode ? (
            <Callout lead="איך מתרגלים ניקוד סופי בקטע">התנועות שבתוך המילים כבר כתובות — חסרות רק הסיומות. קראו בקול והחליטו לכל מילה מה התפקיד שלה ומה הסיומת. אחר כך חשפו מילה אחר מילה או משפט אחר משפט, והשוו. אחרי כל משפט מופיעים ההסברים לסיומות החשובות.</Callout>
          ) : topic.cont ? (
            <Callout lead="איך מתרגלים קריאה רציפה">קראו בקול את כל הקטע בלי ניקוד. אחר כך חשפו מילה אחר מילה או משפט אחר משפט, והשוו: התנועות שבתוך המילה (לפי שורש ומשקל) והסיומת (לפי התפקיד). אחרי כל משפט סמנו אם קראתם נכון.</Callout>
          ) : (
            <Callout lead="איך לקרוא">המבנים של הנושא מסומנים בקו ובמספר. קראו פסקה, נסו להבין לבד, ואז פתחו את התרגום ואת הסבר המבנים של אותה פסקה.</Callout>
          )}
          {topic.cont ? (
            <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {topic.cont.map((cp: ContPassage, ci: number) => <ContReadingView key={ci} p={cp} idx={ci} endings={endMode} />)}
            </div>
          ) : topic.reading ? (
            <ReadingView r={topic.reading} />
          ) : (
            <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: t.font.family }}>
              <ArP segs={topic.readingAr ?? []} />
              <Button label={showHe ? "הסתר תרגום" : "הצג תרגום"} onClick={() => setShowHe(!showHe)} />
              {showHe ? <div style={{ fontSize: t.font.body1.fontSize, lineHeight: "1.8", color: t.text.secondary, padding: 12, background: t.bg.subtle, borderRadius: t.radius.md }}>{topic.readingHe ?? ""}</div> : null}
            </div>
          )}
        </Section>
        {topic.reading && topic.reading.gloss.length ? (
          <Section heading="מילון הקטע">
            <Table columns={["מילה / ביטוי", "פירוש"]} align={["start", "start"]} rows={topic.reading.gloss.map((g: string[]) => [<span lang="ar" dir="rtl" style={{ fontSize: 22, lineHeight: 2.2 }}>{g[0]}</span>, g[1]])} />
          </Section>
        ) : null}
        <Section heading="שאלות על הקטע">
          <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: t.font.family }}>
            {sessionRQs.map((qq: ReadQ, qi: number) => (
              <RQCard key={qq.id} q={qq} index={qi} chosen={readAnswers[qq.id]} onAnswer={(c: number) => onReadAnswer(qq.id, c)} />
            ))}
            <Button label={showKey ? "הסתר מפתח תשובות" : "מפתח תשובות לשאלות הקטע"} onClick={() => setShowKey(!showKey)} />
            {showKey ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: t.radius.md, background: t.bg.subtle, fontSize: t.font.body2.fontSize, lineHeight: "1.75" }}>
                {topic.readingQs.map((qq: ReadQ, qi: number) => (
                  <div key={qq.id}>{String(qi + 1) + ". " + qq.options[qq.answer] + " — " + qq.explain}</div>
                ))}
              </div>
            ) : null}
            <Divider />
            <div style={{ fontWeight: t.weight.semibold }}>מילים שלא ידעתי</div>
            <Input label="מילה מהפסקה" value={wordDraft} onChange={setWordDraft} placeholder="מילה לא מוכרת" />
            <Button label="הוסף" onClick={addWord} />
            <Chips items={unknownWords} onRemove={removeWord} />
            {readDone ? <Button label="לסיכום ולסבב חיזוק" variant="primary" onClick={() => setPhase("summary")} /> : null}
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page title="פורטל תרגול ערבית – פוסחא" summary="סיכום תרגול" width="column">
      <Section heading="סיכום" actions={<Button label="לפורטל" onClick={goHome} />}>
        <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: t.font.family }}>
          <div style={{ fontSize: t.font.heading3.fontSize, fontWeight: t.weight.semibold }}>{"ציון: " + String(correctCount) + " מתוך " + String(sessionQs.length)}</div>
          <div style={{ fontSize: t.font.body2.fontSize, lineHeight: "1.7" }}>{(isMixed ? "תרגול מעורב נשמר" : "נשמר במעקב: " + practiceLabel(curEntry)) + " · " + overallLine}</div>
          {missedNames.length ? (
            <Callout lead="כללים לחיזוק" tone="warning"><div style={{ lineHeight: "1.7" }}>{missedNames.join(" · ")}</div></Callout>
          ) : (
            <Callout lead="כל הכבוד" tone="success">לא היו טעויות בסבב הזה.</Callout>
          )}
          {unknownWords.length ? <div><div style={{ fontWeight: t.weight.semibold, marginBottom: 6 }}>מילים לשינון</div><Chips items={unknownWords} onRemove={removeWord} /></div> : null}
          {wrongQs.length > 0 ? <Button label="סבב חיזוק לפי הטעויות" variant="primary" onClick={startAdaptive} /> : null}
          <Divider />
          <div style={{ fontWeight: t.weight.semibold }}>שלחו סיכום לעוזר</div>
          <div style={{ fontSize: t.font.subtext.fontSize, color: t.text.secondary }}>אפשר גם להעתיק ולשלוח בצ׳אט.</div>
          <div style={{ padding: 12, borderRadius: t.radius.md, border: "1px solid " + t.border.default, background: t.bg.subtle, fontSize: t.font.body2.fontSize, lineHeight: "1.7", userSelect: "text", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{summaryText}</div>
          <Button label="תרגול נוסף באותו נושא" onClick={() => startTopic(isMixed ? "mixed" : topicId, isMixed)} />
          <Button label="חזרה לפורטל" onClick={goHome} />
        </div>
      </Section>
    </Page>
  );
}

