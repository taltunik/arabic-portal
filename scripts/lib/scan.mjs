// Bracket scanner that keeps string literals intact (the portal source has no template strings).

export function extractBalanced(src, openIdx) {
  const pairs = { "{": "}", "[": "]", "(": ")" };
  const open = src[openIdx];
  const close = pairs[open];
  if (!close) throw new Error("not a bracket at " + openIdx);
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") i += 2;
        else i++;
      }
      i++;
      continue;
    }
    if (c === "'") {
      i++;
      while (i < src.length && src[i] !== "'") {
        if (src[i] === "\\") i += 2;
        else i++;
      }
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
    i++;
  }
  throw new Error("unbalanced " + open + " from " + openIdx);
}

export function indexOfConst(src, name) {
  const marker = "const " + name;
  const i = src.indexOf(marker);
  if (i < 0) throw new Error("missing const " + name);
  return i;
}

export function extractConstValue(src, name) {
  const i = indexOfConst(src, name);
  const eq = src.indexOf("=", i);
  let j = eq + 1;
  while (j < src.length && /\s/.test(src[j])) j++;
  return extractBalanced(src, j);
}

export function extractConstStatement(src, name) {
  const i = indexOfConst(src, name);
  const eq = src.indexOf("=", i);
  let j = eq + 1;
  while (j < src.length && /\s/.test(src[j])) j++;
  const val = extractBalanced(src, j);
  const end = j + val.length;
  const semi = src.indexOf(";", end);
  if (semi < 0) throw new Error("missing semicolon after " + name);
  return src.slice(i, semi + 1);
}

export function splitTopLevelObjects(arraySrc) {
  if (arraySrc[0] !== "[") throw new Error("expected array");
  const items = [];
  let i = 1;
  while (i < arraySrc.length) {
    const c = arraySrc[i];
    if (c === '"') {
      i++;
      while (i < arraySrc.length && arraySrc[i] !== '"') {
        if (arraySrc[i] === "\\") i += 2;
        else i++;
      }
      i++;
      continue;
    }
    if (c === "/" && arraySrc[i + 1] === "/") {
      while (i < arraySrc.length && arraySrc[i] !== "\n") i++;
      continue;
    }
    if (c === "]") break;
    if (c === "{") {
      const obj = extractBalanced(arraySrc, i);
      items.push(obj);
      i += obj.length;
      continue;
    }
    i++;
  }
  return items;
}

export function topicMeta(obj) {
  const head = obj.slice(0, 600);
  const id = head.match(/id:\s*"([^"]+)"/);
  const num = head.match(/num:\s*(\d+)/);
  if (!id || !num) throw new Error("topic id/num not in head: " + head.slice(0, 120));
  return { id: id[1], num: Number(num[1]) };
}

export function helpersUsed(obj) {
  return ["mq", "rq", "pa", "pb", "pm", "rs", "cs"].filter((name) => new RegExp("\\b" + name + "\\s*\\(").test(obj));
}
