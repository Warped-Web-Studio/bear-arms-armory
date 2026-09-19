import "server-only";
import { inflateRawSync } from "node:zlib";

// A spreadsheet is a zip of XML. Reading it directly keeps the dependency
// footprint at zero and lets every limit below be explicit and auditable.
export const MAX_WORKBOOK_BYTES = 3_500_000;
const MAX_ENTRIES = 512;
const MAX_ENTRY_BYTES = 40_000_000;
const MAX_TOTAL_BYTES = 80_000_000;
const MAX_SHARED_STRINGS = 200_000;
export const MAX_SHEET_ROWS = 5000;
export const MAX_SHEET_COLUMNS = 64;

// Every message here is shown to the client, so it must be plain language.
export class SpreadsheetError extends Error {}
function fail(message: string): never {
  throw new SpreadsheetError(message);
}

const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const LEGACY_XLS =
  "This looks like an older Excel file (.xls). Open it in Excel, choose File → Save As, pick “Excel Workbook (.xlsx)”, then upload the new file.";
const NOT_A_WORKBOOK =
  "This file isn’t an Excel workbook. Upload a .xlsx spreadsheet.";
const DAMAGED = "This spreadsheet couldn’t be read. It may be damaged.";

type ZipEntry = { name: string; read: () => Buffer };

function readZip(buffer: Buffer): Map<string, ZipEntry> {
  // The end-of-central-directory record sits in the last 22 bytes plus an
  // optional comment of up to 64 KB.
  const from = Math.max(0, buffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= from; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail(NOT_A_WORKBOOK);
  const total = buffer.readUInt16LE(eocd + 10);
  const directory = buffer.readUInt32LE(eocd + 16);
  if (total > MAX_ENTRIES)
    fail("This spreadsheet is too complex to read. Simplify it and try again.");
  if (directory === 0xffffffff)
    fail(
      "This spreadsheet uses an unsupported format. Save it again as .xlsx.",
    );
  const entries = new Map<string, ZipEntry>();
  let cursor = directory;
  let budget = MAX_TOTAL_BYTES;
  for (let i = 0; i < total; i++) {
    if (
      cursor + 46 > buffer.length ||
      buffer.readUInt32LE(cursor) !== 0x02014b50
    )
      fail(DAMAGED);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const uncompressed = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const offset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    if (compressed === 0xffffffff || uncompressed === 0xffffffff)
      fail(
        "This spreadsheet is too large to read. Split it into smaller files.",
      );
    if (uncompressed > MAX_ENTRY_BYTES)
      fail("This spreadsheet is too large to read.");
    entries.set(name, {
      name,
      read() {
        // Charge the shared budget on read so an unread entry can't exhaust it,
        // and a highly compressed one can't expand past the cap.
        if (uncompressed > budget)
          fail("This spreadsheet is too large to read.");
        budget -= uncompressed;
        if (
          offset + 30 > buffer.length ||
          buffer.readUInt32LE(offset) !== 0x04034b50
        )
          fail(DAMAGED);
        const start =
          offset +
          30 +
          buffer.readUInt16LE(offset + 26) +
          buffer.readUInt16LE(offset + 28);
        const end = start + compressed;
        if (end > buffer.length) fail(DAMAGED);
        const body = buffer.subarray(start, end);
        try {
          if (method === 0) return Buffer.from(body);
          if (method === 8)
            return inflateRawSync(body, { maxOutputLength: uncompressed || 1 });
        } catch {
          fail(DAMAGED);
        }
        fail("This spreadsheet uses an unsupported compression format.");
      },
    });
  }
  return entries;
}

// No DTD means no entity expansion and no external references. The five
// predefined entities and numeric character references are all that remain.
function parseXml(entry: ZipEntry | undefined): string {
  if (!entry) return "";
  const text = entry.read().toString("utf8");
  if (/<!(DOCTYPE|ENTITY)/i.test(text))
    fail("This spreadsheet contains unsupported content and was not read.");
  return text;
}

export function decodeXmlText(value: string) {
  return value
    .replace(/_x005F_x([0-9A-Fa-f]{4})_/g, "_x$1_")
    .replace(/_x000D_/g, "")
    .replace(/&#x([0-9A-Fa-f]{1,6});/g, (whole, hex) =>
      safeCodePoint(parseInt(hex, 16), whole),
    )
    .replace(/&#(\d{1,7});/g, (whole, digits) =>
      safeCodePoint(Number(digits), whole),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
function safeCodePoint(code: number, whole: string) {
  if (!Number.isFinite(code) || code < 0x20 || code > 0x10ffff) return "";
  if (code >= 0xd800 && code <= 0xdfff) return whole;
  return String.fromCodePoint(code);
}

function sharedStrings(xml: string) {
  const values: string[] = [];
  for (const match of xml.matchAll(
    /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si\s*\/>/g,
  )) {
    if (values.length >= MAX_SHARED_STRINGS) break;
    const body = (match[1] || "").replace(/<rPh[\s\S]*?<\/rPh>/g, "");
    values.push(
      [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
        .map((text) => decodeXmlText(text[1]))
        .join(""),
    );
  }
  return values;
}

export function columnIndex(reference: string) {
  let index = 0;
  for (const letter of reference.replace(/\d+$/, "").toUpperCase()) {
    if (letter < "A" || letter > "Z") return -1;
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

function readSheet(xml: string, strings: string[]) {
  const rows: string[][] = [];
  let truncated = false;
  for (const rowMatch of xml.matchAll(
    /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>|<row\s[^>]*\/>/g,
  )) {
    if (rows.length >= MAX_SHEET_ROWS) {
      truncated = true;
      break;
    }
    const cells: string[] = [];
    let next = 0;
    for (const cellMatch of (rowMatch[1] || "").matchAll(
      /<c\s([^>]*?)\/>|<c\s([^>]*?)>([\s\S]*?)<\/c>/g,
    )) {
      const attributes = cellMatch[1] ?? cellMatch[2] ?? "";
      const body = cellMatch[3] ?? "";
      const reference = /\br="([A-Za-z]+\d+)"/.exec(attributes)?.[1];
      const at = reference ? columnIndex(reference) : next;
      if (at < 0 || at >= MAX_SHEET_COLUMNS) continue;
      next = at + 1;
      while (cells.length <= at) cells.push("");
      cells[at] = cellValue(attributes, body, strings);
    }
    rows.push(cells);
  }
  while (rows.length && rows[rows.length - 1].every((cell) => !cell))
    rows.pop();
  return { rows, truncated };
}

// Formulas are never evaluated. Only the value Excel already cached is read.
function cellValue(attributes: string, body: string, strings: string[]) {
  const type = /\bt="([^"]*)"/.exec(attributes)?.[1] || "n";
  if (type === "inlineStr")
    return [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXmlText(text[1]))
      .join("")
      .trim();
  const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1];
  if (raw === undefined) return "";
  const value = decodeXmlText(raw).trim();
  if (type === "s") {
    const index = Number(value);
    return Number.isInteger(index) && index >= 0 && index < strings.length
      ? strings[index]
      : "";
  }
  if (type === "e") return "";
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return value;
}

function firstSheetPath(entries: Map<string, ZipEntry>) {
  const workbook = parseXml(entries.get("xl/workbook.xml"));
  const sheet = [...workbook.matchAll(/<sheet\s([^>]*?)\/?>/g)].find(
    (match) => !/\bstate="(hidden|veryHidden)"/.test(match[1]),
  );
  const id = sheet && /\br:id="([^"]+)"/.exec(sheet[1])?.[1];
  if (id) {
    const rels = parseXml(entries.get("xl/_rels/workbook.xml.rels"));
    const target = [...rels.matchAll(/<Relationship\s([^>]*?)\/?>/g)]
      .map((match) => match[1])
      .find((attributes) => new RegExp(`\\bId="${id}"`).test(attributes));
    const path = target && /\bTarget="([^"]+)"/.exec(target)?.[1];
    if (path) {
      const resolved = path.startsWith("/")
        ? path.slice(1)
        : `xl/${path.replace(/^\.\//, "")}`;
      if (entries.has(resolved)) return resolved;
    }
  }
  return [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort()[0];
}

export type Workbook = { rows: string[][]; truncated: boolean };

export function readWorkbook(buffer: Buffer): Workbook {
  if (buffer.length > MAX_WORKBOOK_BYTES)
    fail("This spreadsheet is too large. Upload a file under 3 MB.");
  if (buffer.subarray(0, 8).equals(OLE2)) fail(LEGACY_XLS);
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50)
    fail(NOT_A_WORKBOOK);
  const entries = readZip(buffer);
  if (!entries.has("xl/workbook.xml")) fail(NOT_A_WORKBOOK);
  const path = firstSheetPath(entries);
  if (!path) fail("This spreadsheet has no readable sheet.");
  const strings = sharedStrings(parseXml(entries.get("xl/sharedStrings.xml")));
  return readSheet(parseXml(entries.get(path)), strings);
}
