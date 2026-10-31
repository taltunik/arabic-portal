import type { Q, TopicData } from "./types";
import { READ_BLOCKS } from "./read-blocks";
import { END_BLOCKS } from "./end-blocks";
import { END_TABLES } from "./end-tables";
import { topic as an_lan } from "./topics/01-an-lan";
import { topic as jazm } from "./topics/02-jazm";
import { topic as la_types } from "./topics/03-la-types";
import { topic as inna } from "./topics/05-inna";
import { topic as kana } from "./topics/06-kana";
import { topic as passive } from "./topics/11-passive";
import { topic as tamyiz_hal } from "./topics/25-tamyiz-hal";
import { topic as dor_vocab } from "./topics/22-dor-vocab";
import { topic as an_anna } from "./topics/04-an-anna";
import { topic as mubtada } from "./topics/07-mubtada";
import { topic as amr } from "./topics/12-amr";
import { topic as irab } from "./topics/13-irab";
import { topic as muthanna } from "./topics/15-muthanna";
import { topic as idafa } from "./topics/17-idafa";
import { topic as shart } from "./topics/20-shart";
import { topic as mawsul } from "./topics/19-mawsul";
import { topic as rabt } from "./topics/24-rabt";
import { topic as fail_maful } from "./topics/16-fail-maful";
import { topic as jam } from "./topics/14-jam";
import { topic as abwab } from "./topics/08-abwab";
import { topic as masdar } from "./topics/09-masdar";
import { topic as weak } from "./topics/10-weak";
import { topic as naat } from "./topics/18-naat";
import { topic as adad } from "./topics/21-adad";
import { topic as amthal } from "./topics/23-amthal";
import { topic as qiraa } from "./topics/26-qiraa";
import { topic as nikud } from "./topics/27-nikud";
import { topic as college_1 } from "./topics/28-college-1";

// סדר הנושאים זהה למקור. נושא חדש: קובץ בתיקייה topics, שורת import, ושורה במערך.
// אחרי הטעינה רצים אותם עיבודים כמו בפורטל המקורי.
export const TOPICS: TopicData[] = [
  an_lan,
  jazm,
  la_types,
  inna,
  kana,
  passive,
  tamyiz_hal,
  dor_vocab,
  an_anna,
  mubtada,
  amr,
  irab,
  muthanna,
  idafa,
  shart,
  mawsul,
  rabt,
  fail_maful,
  jam,
  abwab,
  masdar,
  weak,
  naat,
  adad,
  amthal,
  qiraa,
  nikud,
  college_1,
];

// The stored option order of the original 80 questions is varied per question (deterministic by id), so the correct answer is spread over all positions even before the per-round shuffle.
const ORIGINAL_TOPIC_IDS: string[] = ["an-lan", "jazm", "la-types", "inna", "kana", "passive", "tamyiz-hal", "dor-vocab"];
function varyStored(q: Q): Q {
  let h: number = 7;
  for (let i = 0; i < q.id.length; i++) h = (h * 31 + q.id.charCodeAt(i)) % 9973;
  const t: number = h % q.options.length;
  if (t === q.answer) return q;
  const o: string[] = q.options.slice();
  const x: string = o[t]; o[t] = o[q.answer]; o[q.answer] = x;
  const n: string[] | undefined = q.optionNotes ? q.optionNotes.slice() : undefined;
  if (n) { const y: string = n[t]; n[t] = n[q.answer]; n[q.answer] = y; }
  return { ...q, options: o, optionNotes: n, answer: t };
}
TOPICS.forEach((t: TopicData) => { if (ORIGINAL_TOPIC_IDS.indexOf(t.id) >= 0) t.questions = t.questions.map(varyStored); });
// Topic 26 uses the detailed rule set; its earlier short blocks stay available as a quick summary.
TOPICS.forEach((t: TopicData) => {
  if (t.id === "qiraa" && READ_BLOCKS.length) { t.brief = t.reminderBlocks; t.reminderBlocks = READ_BLOCKS.concat(END_BLOCKS); if (END_TABLES.length) t.tables = END_TABLES; }
  if (t.id === "qiraa" && TOPICS.some((x: TopicData) => x.id === "nikud")) t.link = { id: "nikud", label: "מעבר לתרגול ניקוד סופי ייעודי (נושא 27)" };
  if (t.id === "nikud") t.link = { id: "qiraa", label: "מעבר לקריאה נכונה (נושא 26)" };
});

export { MORE } from "./more";
export { SECTIONS, TOPIC_SECTION } from "./sections";
export { LESSONS } from "./lessons";
export { PLACEHOLDERS } from "./placeholders";
