// Compares the split data files with scripts/fixtures/portal-canvas.tsx:
// 1) topic/question literals are still byte-for-byte in the data files
// 2) evaluated topics, questions, ids and strings match the original module
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { extractConstValue, splitTopLevelObjects, topicMeta } from "./lib/scan.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = join(root, "scripts/fixtures/portal-canvas.tsx");
const src = readFileSync(fixturePath, "utf8");
const cache = join(root, "scripts/.cache");
mkdirSync(cache, { recursive: true });

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const topicObjs = splitTopLevelObjects(extractConstValue(src, "TOPICS")).map((obj) => ({ obj, ...topicMeta(obj) }));
topicObjs.push({ obj: extractConstValue(src, "COLLEGE_TOPIC"), ...topicMeta(extractConstValue(src, "COLLEGE_TOPIC")) });
if (topicObjs.length !== 28) fail("expected 28 topics in the fixture, got " + topicObjs.length);

for (const topic of topicObjs) {
  const file = join(root, "src/data/topics", String(topic.num).padStart(2, "0") + "-" + topic.id + ".ts");
  const text = readFileSync(file, "utf8");
  if (!text.includes(topic.obj)) fail("topic literal drifted: " + topic.id);
}

const literalFiles = [
  ["MORE", "src/data/more.ts"],
  ["READ_BLOCKS", "src/data/read-blocks.ts"],
  ["END_BLOCKS", "src/data/end-blocks.ts"],
  ["END_TABLES", "src/data/end-tables.ts"],
  ["SECTIONS", "src/data/sections.ts"],
  ["LESSONS", "src/data/lessons.ts"],
  ["PLACEHOLDERS", "src/data/placeholders.ts"],
  ["TOPIC_SECTION", "src/data/sections.ts"],
];
for (const [name, rel] of literalFiles) {
  const literal = extractConstValue(src, name);
  const text = readFileSync(join(root, rel), "utf8");
  if (!text.includes(literal)) fail("literal drifted: " + name);
}

const mqAt = src.indexOf("function mq");
const moreComment = src.indexOf("// Expanded explanation");
const helperSlice = src.slice(mqAt, moreComment).trim();
const buildText = readFileSync(join(root, "src/data/build.ts"), "utf8").replace(/^export function /gm, "function ");
if (!buildText.includes(helperSlice)) fail("question helpers drifted");

const origEntry = join(cache, "orig.tsx");
const newEntry = join(cache, "new-entry.ts");
writeFileSync(origEntry, src + "\nexport const __DATA__ = { TOPICS, MORE, SECTIONS, LESSONS, TOPIC_SECTION, PLACEHOLDERS };\n");
writeFileSync(
  newEntry,
  `import { TOPICS, MORE, SECTIONS, LESSONS, TOPIC_SECTION, PLACEHOLDERS } from "../../src/data/index.ts";
export const __DATA__ = { TOPICS, MORE, SECTIONS, LESSONS, TOPIC_SECTION, PLACEHOLDERS };
`,
);

const origOut = join(cache, "orig.mjs");
const newOut = join(cache, "new.mjs");
await esbuild.build({
  entryPoints: [origEntry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: origOut,
  jsx: "automatic",
  alias: { "grok/canvas": join(root, "scripts/verify-stub.ts") },
  logLevel: "silent",
});
await esbuild.build({
  entryPoints: [newEntry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: newOut,
  logLevel: "silent",
});

const oldMod = await import(pathToFileURL(origOut).href + "?t=" + Date.now());
const newMod = await import(pathToFileURL(newOut).href + "?t=" + Date.now());
const oldData = oldMod.__DATA__;
const newData = newMod.__DATA__;

function diff(a, b, path) {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") {
    return path + " " + JSON.stringify(a) + " !== " + JSON.stringify(b);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return path + " array mismatch";
  if (Array.isArray(a)) {
    if (a.length !== b.length) return path + " length " + a.length + " !== " + b.length;
    for (let i = 0; i < a.length; i++) {
      const d = diff(a[i], b[i], path + "[" + i + "]");
      if (d) return d;
    }
    return null;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const d = diff(a[k], b[k], path + "." + k);
    if (d) return d;
  }
  return null;
}

const oldIds = oldData.TOPICS.map((t) => t.id);
const newById = new Map(newData.TOPICS.map((t) => [t.id, t]));
for (const oldTopic of oldData.TOPICS) {
  const got = newById.get(oldTopic.id);
  if (!got) fail("missing original topic " + oldTopic.id);
  const d = diff(oldTopic, got, "TOPICS." + oldTopic.id);
  if (d) fail(d);
}
const extraTopics = newData.TOPICS.filter((t) => oldIds.indexOf(t.id) < 0);
if (extraTopics.length !== 1 || extraTopics[0].id !== "dor-lesson-2") {
  fail("expected one added topic dor-lesson-2, got " + extraTopics.map((t) => t.id).join(","));
}
if (extraTopics[0].questions.length !== 32) fail("dor-lesson-2 questions " + extraTopics[0].questions.length);
if (!extraTopics[0].readingQs || extraTopics[0].readingQs.length !== 6) fail("dor-lesson-2 reading questions");
const dorIndex = newData.TOPICS.findIndex((t) => t.id === "dor-vocab");
if (newData.TOPICS[dorIndex + 1].id !== "dor-lesson-2") fail("dor-lesson-2 must follow dor-vocab in the index");

for (const key of ["MORE", "SECTIONS", "PLACEHOLDERS"]) {
  const d = diff(oldData[key], newData[key], key);
  if (d) fail(d);
}
for (const lesson of oldData.LESSONS) {
  const got = newData.LESSONS.find((l) => l.topicId === lesson.topicId);
  const d = diff(lesson, got, "LESSONS." + lesson.topicId);
  if (d) fail(d);
}
const lesson2 = newData.LESSONS.find((l) => l.topicId === "dor-lesson-2");
if (!lesson2 || lesson2.section !== "dor" || lesson2.date !== "03.11.2026") fail("missing Dor lesson 2 entry");
for (const key of Object.keys(oldData.TOPIC_SECTION)) {
  if (newData.TOPIC_SECTION[key] !== oldData.TOPIC_SECTION[key]) fail("TOPIC_SECTION changed for " + key);
}
if (newData.TOPIC_SECTION["dor-lesson-2"] !== "dor") fail("dor-lesson-2 is not in the Dor section");

const qCount = newData.TOPICS.reduce((n, t) => n + t.questions.length, 0);
const readCount = newData.TOPICS.reduce((n, t) => n + (t.readingQs ? t.readingQs.length : 0), 0);
const ids = newData.TOPICS.map((t) => t.id);
if (new Set(ids).size !== ids.length) fail("duplicate topic ids");
if (newData.TOPICS.length !== 29) fail("expected 29 topics, got " + newData.TOPICS.length);
if (qCount !== 400) fail("expected 400 questions, got " + qCount);
if (readCount !== 152) fail("expected 152 reading questions, got " + readCount);
if (newData.SECTIONS.length !== 5) fail("expected 5 sections");

const samples = [
  newData.TOPICS[0].titleHe,
  newData.TOPICS[0].questions[0].prompt,
  newData.TOPICS[0].questions[0].options[newData.TOPICS[0].questions[0].answer],
  newData.TOPICS.find((t) => t.id === "qiraa").titleHe,
  newData.TOPICS.find((t) => t.id === "nikud").questions[0].fullSentence,
  newData.TOPICS.find((t) => t.id === "college-1").reading.title,
  newData.MORE.nqa1.slice(0, 40),
];
for (const sample of samples) {
  if (!src.includes(sample)) fail("sample missing from fixture: " + sample);
}

console.log("ok topics=" + newData.TOPICS.length + " questions=" + qCount + " readingQs=" + readCount + " more=" + Object.keys(newData.MORE).length + " sections=" + newData.SECTIONS.length);
console.log("ids " + ids.join(", "));
