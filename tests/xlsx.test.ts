import { expect, it } from "vitest";
import {
  MAX_SHEET_COLUMNS,
  MAX_SHEET_ROWS,
  readWorkbook,
  SpreadsheetError,
  columnIndex,
  decodeXmlText,
} from "@/lib/xlsx";
import { sheetXml, sharedStringsXml, workbook, zip } from "./workbook-fixture";

const workbookXml = `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const rels = `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`;
const build = (rows: string[], strings: string[] = []) =>
  zip([
    { name: "xl/workbook.xml", body: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", body: rels },
    { name: "xl/sharedStrings.xml", body: sharedStringsXml(strings) },
    { name: "xl/worksheets/sheet1.xml", body: sheetXml(rows) },
  ]);

it("reads a real workbook of shared strings", () => {
  const result = readWorkbook(
    workbook([
      ["Name", "Manufacturer", "Price"],
      ["Model 70", "Winchester", "1299"],
    ]),
  );
  expect(result.rows).toEqual([
    ["Name", "Manufacturer", "Price"],
    ["Model 70", "Winchester", "1299"],
  ]);
  expect(result.truncated).toBe(false);
});

it("reads every cell kind and never evaluates a formula", () => {
  const rows = [
    `<row r="1">` +
      `<c r="A1" t="s"><v>0</v></c>` +
      `<c r="B1"><v>1299.99</v></c>` +
      `<c r="C1" t="inlineStr"><is><t>Inline</t></is></c>` +
      `<c r="D1" t="str"><f>CONCATENATE("a","b")</f><v>ab</v></c>` +
      `<c r="E1" t="b"><v>1</v></c>` +
      `<c r="F1" t="e"><v>#REF!</v></c>` +
      `<c r="G1"><f>SUM(A1:B1)</f><v>7</v></c>` +
      `</row>`,
  ];
  expect(readWorkbook(build(rows, ["Shared"])).rows).toEqual([
    ["Shared", "1299.99", "Inline", "ab", "TRUE", "", "7"],
  ]);
});

it("places sparse cells by their column reference and drops trailing blanks", () => {
  const rows = [
    `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="D1" t="s"><v>1</v></c></row>`,
    `<row r="2"/>`,
  ];
  expect(readWorkbook(build(rows, ["First", "Fourth"])).rows).toEqual([
    ["First", "", "", "Fourth"],
  ]);
});

it("decodes entities and rich-text runs without expanding anything else", () => {
  const strings = `<?xml version="1.0"?><sst><si><r><t>Smith &amp; </t></r><r><t>Wesson</t></r><rPh><t>ignored</t></rPh></si></sst>`;
  const buffer = zip([
    { name: "xl/workbook.xml", body: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", body: rels },
    { name: "xl/sharedStrings.xml", body: strings },
    {
      name: "xl/worksheets/sheet1.xml",
      body: sheetXml([`<row r="1"><c r="A1" t="s"><v>0</v></c></row>`]),
    },
  ]);
  expect(readWorkbook(buffer).rows).toEqual([["Smith & Wesson"]]);
  expect(decodeXmlText("&lt;b&gt;&#65;&#x42;&#0;")).toBe("<b>AB");
});

it("skips hidden sheets and resolves the relationship target", () => {
  const buffer = zip([
    {
      name: "xl/workbook.xml",
      body: `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Old" sheetId="1" state="hidden" r:id="rId1"/><sheet name="Live" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      body: `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
    },
    {
      name: "xl/sharedStrings.xml",
      body: sharedStringsXml(["Hidden", "Live"]),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      body: sheetXml([`<row r="1"><c r="A1" t="s"><v>0</v></c></row>`]),
    },
    {
      name: "xl/worksheets/sheet2.xml",
      body: sheetXml([`<row r="1"><c r="A1" t="s"><v>1</v></c></row>`]),
    },
  ]);
  expect(readWorkbook(buffer).rows).toEqual([["Live"]]);
});

it("bounds rows and columns instead of reading an unbounded sheet", () => {
  const rows = Array.from(
    { length: MAX_SHEET_ROWS + 10 },
    (_, index) =>
      `<row r="${index + 1}"><c r="A${index + 1}"><v>1</v></c></row>`,
  );
  const result = readWorkbook(build(rows));
  expect(result.rows.length).toBe(MAX_SHEET_ROWS);
  expect(result.truncated).toBe(true);
  const wide = readWorkbook(
    build([
      `<row r="1">${Array.from(
        { length: MAX_SHEET_COLUMNS + 5 },
        (_, index) => `<c r="${reference(index)}1"><v>${index}</v></c>`,
      ).join("")}</row>`,
    ]),
  );
  expect(wide.rows[0].length).toBe(MAX_SHEET_COLUMNS);
});
function reference(index: number) {
  return index < 26
    ? String.fromCharCode(65 + index)
    : `${String.fromCharCode(64 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`;
}

it("maps spreadsheet column letters", () => {
  expect(columnIndex("A1")).toBe(0);
  expect(columnIndex("Z9")).toBe(25);
  expect(columnIndex("AA1")).toBe(26);
  expect(columnIndex("BC12")).toBe(54);
});

it("guides the client when an old .xls file is uploaded", () => {
  const ole2 = Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(200),
  ]);
  expect(() => readWorkbook(ole2)).toThrow(SpreadsheetError);
  expect(() => readWorkbook(ole2)).toThrow(/Save As/);
});

it.each([
  ["not a spreadsheet at all", Buffer.from("just some text, not a zip file")],
  ["an empty file", Buffer.alloc(0)],
])("rejects %s with a readable message", (_label, buffer) => {
  expect(() => readWorkbook(buffer)).toThrow(SpreadsheetError);
});

it("refuses a zip that is not a workbook", () => {
  expect(() =>
    readWorkbook(zip([{ name: "notes.txt", body: "hello" }])),
  ).toThrow(/isn’t an Excel workbook/);
});

it("refuses XML that declares a document type or entities", () => {
  const buffer = zip([
    { name: "xl/workbook.xml", body: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", body: rels },
    {
      name: "xl/sharedStrings.xml",
      body: `<?xml version="1.0"?><!DOCTYPE sst [<!ENTITY bomb "boom">]><sst><si><t>&bomb;</t></si></sst>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      body: sheetXml([`<row r="1"><c r="A1" t="s"><v>0</v></c></row>`]),
    },
  ]);
  expect(() => readWorkbook(buffer)).toThrow(/unsupported content/);
});

it("refuses an entry that claims to expand far beyond the cap", () => {
  const buffer = zip([
    { name: "xl/workbook.xml", body: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", body: rels },
    {
      name: "xl/sharedStrings.xml",
      body: sharedStringsXml(["ok"]),
      declaredSize: 90_000_000,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      body: sheetXml([`<row r="1"><c r="A1" t="s"><v>0</v></c></row>`]),
    },
  ]);
  expect(() => readWorkbook(buffer)).toThrow(/too large/);
});

it("refuses a workbook that is too big to accept at all", () => {
  const padded = Buffer.concat([workbook([["Name"]]), Buffer.alloc(4_000_000)]);
  expect(() => readWorkbook(padded)).toThrow(/under 3 MB/);
});

it("refuses a directory claiming more entries than it holds", () => {
  expect(() =>
    readWorkbook(zip([{ name: "xl/workbook.xml", body: workbookXml }], 900)),
  ).toThrow(/too complex/);
});
