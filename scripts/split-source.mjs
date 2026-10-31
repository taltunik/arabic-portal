// Regenerates src/data/* and src/App.tsx from scripts/fixtures/portal-canvas.tsx.
// Topic object literals are copied byte-for-byte. Do not reformat them.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConstStatement, extractConstValue, helpersUsed, splitTopLevelObjects, topicMeta } from "./lib/scan.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "scripts/fixtures/portal-canvas.tsx"), "utf8");

function write(rel, text) {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith("\n") ? text : text + "\n");
}

function exportedStatement(statement) {
  return statement.replace(/^const /, "export const ");
}

const typeStart = src.indexOf("type SubRule");
const shuffleAt = src.indexOf("function shuffle");
if (typeStart < 0 || shuffleAt < 0) throw new Error("type block not found");
const types = src
  .slice(typeStart, shuffleAt)
  .trim()
  .replace(/^type /gm, "export type ");

write(
  "src/data/types.ts",
  types +
    `

export type SectionDef = { id: string; titleHe: string; icon: string; desc: string; kind: "topics" | "words"; byLesson?: boolean; catchAll?: boolean; mixed?: boolean; emptyNote?: string };
export type LessonDef = { topicId: string; section: string; date: string; teacher: string; titleHe: string };
`,
);

const mqAt = src.indexOf("function mq");
const moreComment = src.indexOf("// Expanded explanation");
if (mqAt < 0 || moreComment < 0) throw new Error("helper block not found");
const helperBody = src
  .slice(mqAt, moreComment)
  .trim()
  .replace(/^function /gm, "export function ");
write(
  "src/data/build.ts",
  `import type { CSent, MSlot, Q, ReadQ, RSent } from "./types";

${helperBody}
`,
);

write("src/data/more.ts", exportedStatement(extractConstStatement(src, "MORE")) + "\n");
write(
  "src/data/read-blocks.ts",
  `import type { ReminderBlock } from "./types";

${exportedStatement(extractConstStatement(src, "READ_BLOCKS"))}
`,
);
write(
  "src/data/end-blocks.ts",
  `import type { ReminderBlock } from "./types";

${exportedStatement(extractConstStatement(src, "END_BLOCKS"))}
`,
);
write(
  "src/data/end-tables.ts",
  `import type { RTable } from "./types";

${exportedStatement(extractConstStatement(src, "END_TABLES"))}
`,
);
write("src/data/placeholders.ts", exportedStatement(extractConstStatement(src, "PLACEHOLDERS")) + "\n");

const sectionComment = src.indexOf("// להוספת חלק חדש");
const lessonType = src.indexOf("type LessonDef");
if (sectionComment < 0 || lessonType < 0) throw new Error("sections block not found");
const sectionChunk = src
  .slice(sectionComment, lessonType)
  .trim()
  .replace(/^const /gm, "export const ");
write(
  "src/data/sections.ts",
  `import type { SectionDef } from "./types";

${sectionChunk}
`,
);
write(
  "src/data/lessons.ts",
  `import type { LessonDef } from "./types";

${exportedStatement(extractConstStatement(src, "LESSONS"))}
`,
);

const topicObjs = splitTopLevelObjects(extractConstValue(src, "TOPICS"));
const college = extractConstValue(src, "COLLEGE_TOPIC");
const allTopics = topicObjs.map((obj) => ({ obj, ...topicMeta(obj) }));
allTopics.push({ obj: college, ...topicMeta(college) });

const seen = new Set();
const imports = [];
const names = [];
for (const topic of allTopics) {
  if (seen.has(topic.id)) throw new Error("duplicate topic id " + topic.id);
  seen.add(topic.id);
  const file = String(topic.num).padStart(2, "0") + "-" + topic.id + ".ts";
  const helpers = helpersUsed(topic.obj);
  const helperImport = helpers.length ? `import { ${helpers.join(", ")} } from "../build";\n` : "";
  const shared = [
    ["END_BLOCKS", "../end-blocks"],
    ["END_TABLES", "../end-tables"],
    ["READ_BLOCKS", "../read-blocks"],
  ].filter(([name]) => new RegExp("\\b" + name + "\\b").test(topic.obj));
  const sharedImport = shared.map(([name, from]) => `import { ${name} } from "${from}";\n`).join("");
  const varName = topic.id.replace(/-/g, "_");
  write(
    "src/data/topics/" + file,
    `import type { TopicData } from "../types";
${helperImport}${sharedImport}
// נושא ${topic.num}: ${topic.id}
// גוף הנושא הועתק כלשונו מהמקור. אפשר לערוך כאן, ואז לרשום את הקובץ ב-src/data/index.ts.
export const topic: TopicData = ${topic.obj};
`,
  );
  imports.push(`import { topic as ${varName} } from "./topics/${file.replace(/\.ts$/, "")}";`);
  names.push(varName);
}

const mutStart = src.indexOf("// The stored option order");
const mutEnd = src.indexOf("function allTopicRows");
if (mutStart < 0 || mutEnd < 0) throw new Error("mutation block not found");
const mutations = src.slice(mutStart, mutEnd).trim();

write(
  "src/data/index.ts",
  `import type { Q, TopicData } from "./types";
import { READ_BLOCKS } from "./read-blocks";
import { END_BLOCKS } from "./end-blocks";
import { END_TABLES } from "./end-tables";
${imports.join("\n")}

// סדר הנושאים זהה למקור. נושא חדש: קובץ בתיקייה topics, שורת import, ושורה במערך.
// אחרי הטעינה רצים אותם עיבודים כמו בפורטל המקורי.
export const TOPICS: TopicData[] = [
  ${names.join(",\n  ")},
];

${mutations}

export { MORE } from "./more";
export { SECTIONS, TOPIC_SECTION } from "./sections";
export { LESSONS } from "./lessons";
export { PLACEHOLDERS } from "./placeholders";
`,
);

const uiStart = src.indexOf("function allTopicRows");
let ui = src.slice(uiStart);
const cutA = ui.indexOf("type SectionDef");
const cutB = ui.indexOf("function sectionOfTopic");
if (uiStart < 0 || cutA < 0 || cutB < 0) throw new Error("ui splice markers missing");
ui = ui.slice(0, cutA) + ui.slice(cutB);

const shuffleSrc = src.slice(shuffleAt, mqAt).trim();
write(
  "src/App.tsx",
  `import { Page, Section, Callout, Button, Table, Input, Status, Divider, useState, useMemo, useEffect, useRef, useGrokTheme, type ReactNode } from "grok/canvas";
import { LESSONS, MORE, PLACEHOLDERS, SECTIONS, TOPIC_SECTION, TOPICS } from "./data";
import type { ArSeg, ContPassage, CSent, LessonDef, MSlot, Phase, Q, ReadQ, Reading, ReminderBlock, RowInfo, RSent, RTable, SectionDef, SubRule, TopicData } from "./data/types";
import { noEndings, noVowels } from "./data/build";

${shuffleSrc}

${ui}
`,
);

console.log("topics", allTopics.length);
console.log(allTopics.map((t) => String(t.num).padStart(2, "0") + " " + t.id).join("\n"));
