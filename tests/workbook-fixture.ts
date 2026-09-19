import { deflateRawSync } from "node:zlib";

// Builds a real .xlsx (a zip of XML) so the reader is exercised end to end
// rather than against a stubbed parser. CRC fields are left at zero; the
// reader relies on the declared sizes, not the checksum.
type Entry = { name: string; body: string | Buffer; declaredSize?: number };

export function zip(entries: Entry[], entryCount?: number) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.isBuffer(entry.body)
      ? entry.body
      : Buffer.from(entry.body, "utf8");
    const compressed = deflateRawSync(raw);
    const size = entry.declaredSize ?? raw.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    const record = Buffer.concat([local, name, compressed]);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(size, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([directory, name]));
    locals.push(record);
    offset += record.length;
  }
  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entryCount ?? entries.length, 8);
  eocd.writeUInt16LE(entryCount ?? entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

export function sheetXml(rows: string[]) {
  return `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

export function sharedStringsXml(values: string[]) {
  return `<?xml version="1.0"?><sst count="${values.length}">${values
    .map((value) => `<si><t>${value}</t></si>`)
    .join("")}</sst>`;
}

// A simple workbook whose first sheet holds the given grid of shared strings.
export function workbook(grid: string[][], extra: Entry[] = []) {
  const unique = [...new Set(grid.flat())];
  const rows = grid.map(
    (cells, row) =>
      `<row r="${row + 1}">${cells
        .map(
          (cell, column) =>
            `<c r="${String.fromCharCode(65 + column)}${row + 1}" t="s"><v>${unique.indexOf(cell)}</v></c>`,
        )
        .join("")}</row>`,
  );
  return zip([
    {
      name: "xl/workbook.xml",
      body: `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      body: `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    { name: "xl/sharedStrings.xml", body: sharedStringsXml(unique) },
    { name: "xl/worksheets/sheet1.xml", body: sheetXml(rows) },
    ...extra,
  ]);
}
