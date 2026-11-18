/**
 * BeBig 2.0 — Zero-Dependency Pure-TypeScript OOXML (.xlsx) Writer (AUD-005)
 *
 * Replaces the unmaintained `xlsx@0.18.5` package (GHSA-4r6h-8v6p-xvw6 Prototype
 * Pollution, GHSA-5pgg-2g8v-p4x9 ReDoS) with a minimal, auditable, write-only
 * OpenXML spreadsheet generator.
 *
 * Security invariants:
 * - Zero external dependencies (no third-party parsers, zero prototype-pollution surface).
 * - Formula injection (DDE/Excel CSV-injection) neutralization on string cells:
 *   values starting with `=`, `+`, `@`, `\t`, `\r`, or `-` (when non-numeric) are
 *   prefixed with a literal single quote (`'`) so spreadsheet apps never execute them.
 * - Produces genuine PKZIP (STORE mode + IEEE 802.3 CRC-32) `.xlsx` archives
 *   compatible with Microsoft Excel, Google Sheets, Apple Numbers, and LibreOffice.
 */

export type CellScalar = string | number | boolean | null | undefined;

export interface OoxmlSheet {
  name: string;
  headers: string[];
  rows: CellScalar[][];
}

export interface OoxmlWorkbook {
  SheetNames: string[];
  Sheets: Record<string, OoxmlSheet>;
}

const FORMULA_TRIGGER_REGEX = /^[=+@\t\r]/;
const NUMERIC_STRING_REGEX = /^-?\d+(\.\d+)?$/;

/**
 * Neutralizes spreadsheet formula injection (DDE / CSV-Excel injection) in string values.
 * Numeric values and clean text are preserved unmodified.
 */
export function sanitizeSpreadsheetCell(value: CellScalar): string | number {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  const str = String(value);
  if (str.length === 0) return '';

  if (FORMULA_TRIGGER_REGEX.test(str)) {
    return `'${str}`;
  }
  if (str.startsWith('-') && !NUMERIC_STRING_REGEX.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Converts a 0-based column index to Excel column letters (0 -> A, 25 -> Z, 26 -> AA).
 */
export function colIndexToLetter(index: number): string {
  let col = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

/**
 * Escapes XML 1.0 text content and strips disallowed XML control characters.
 */
function escapeXml(text: string): string {
  // Strip illegal XML 1.0 control chars (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F)
  let cleaned = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      code >= 0x20
    ) {
      cleaned += text[i];
    }
  }
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitizes worksheet names to comply with Excel's 31-char and forbidden-char rules.
 */
function sanitizeSheetName(name: string, fallbackIndex: number): string {
  const cleaned = (name || `Sheet${fallbackIndex + 1}`)
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned || `Sheet${fallbackIndex + 1}`;
}

/**
 * Converts an OoxmlSheet into row-keyed JSON objects (useful for testing & verification).
 */
export function sheetToRecords(sheet: OoxmlSheet): Record<string, string | number>[] {
  return sheet.rows.map((row) => {
    const record: Record<string, string | number> = {};
    for (let c = 0; c < sheet.headers.length; c++) {
      const header = sheet.headers[c];
      const cell = sanitizeSpreadsheetCell(row[c]);
      if (cell !== '') {
        record[header] = cell;
      }
    }
    return record;
  });
}

function buildWorksheetXml(sheet: OoxmlSheet): string {
  const allRows: CellScalar[][] = [sheet.headers, ...sheet.rows];
  const xmlRows: string[] = [];

  for (let r = 0; r < allRows.length; r++) {
    const rowNum = r + 1;
    const row = allRows[r] || [];
    const xmlCells: string[] = [];

    for (let c = 0; c < row.length; c++) {
      const cellRef = `${colIndexToLetter(c)}${rowNum}`;
      const sanitized = sanitizeSpreadsheetCell(row[c]);

      if (typeof sanitized === 'number') {
        xmlCells.push(`<c r="${cellRef}" t="n"><v>${sanitized}</v></c>`);
      } else if (sanitized !== '') {
        xmlCells.push(
          `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(sanitized)}</t></is></c>`
        );
      }
    }

    xmlRows.push(`<row r="${rowNum}">${xmlCells.join('')}</row>`);
  }

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${xmlRows.join('')}</sheetData>` +
    `</worksheet>`
  );
}

function buildContentTypesXml(sheetCount: number): string {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, i) => {
    const idx = i + 1;
    return `<Override PartName="/xl/worksheets/sheet${idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join('');

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheetOverrides +
    `</Types>`
  );
}

function buildRootRelsXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`
  );
}

function buildWorkbookXml(sheetNames: string[]): string {
  const sheetsXml = sheetNames
    .map((name, i) => {
      const id = i + 1;
      return `<sheet name="${escapeXml(sanitizeSheetName(name, i))}" sheetId="${id}" r:id="rId${id}"/>`;
    })
    .join('');

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${sheetsXml}</sheets>` +
    `</workbook>`
  );
}

function buildWorkbookRelsXml(sheetCount: number): string {
  const sheetRels = Array.from({ length: sheetCount }, (_, i) => {
    const id = i + 1;
    return `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`;
  }).join('');
  const stylesRelId = sheetCount + 1;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheetRels +
    `<Relationship Id="rId${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`
  );
}

function buildStylesXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/spreadsheetml/2006/main" ` +
    `xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs>` +
    `</styleSheet>`
  ).replace(
    'http://schemas.openxmlformats.org/spreadsheetml/2006/spreadsheetml/2006/main',
    'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  );
}

// ============================================================================
// Pure-TS UTF-8 Encoder, CRC-32, PKZIP (STORE), and Base64 Encoder
// ============================================================================

function encodeUtf8(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(++i);
      code = 0x10000 + (((code - 0xd800) << 10) | (next - 0xdc00));
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      out.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return new Uint8Array(out);
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZipArchive(entries: ZipEntry[]): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encodeUtf8(entry.name);
    const data = entry.data;
    const checksum = crc32(data);
    const size = data.length;

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature (PK\x03\x04)
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Compression method: 0 (STORE)
    lv.setUint16(10, 0, true); // Mod time
    lv.setUint16(12, 0x21, true); // Mod date (1980-01-01)
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, data);

    // Central directory header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature (PK\x01\x02)
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // STORE
    cv.setUint16(12, 0, true); // Mod time
    cv.setUint16(14, 0x21, true); // Mod date
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra
    cv.setUint16(32, 0, true); // Comment
    cv.setUint16(34, 0, true); // Disk number
    cv.setUint16(36, 0, true); // Internal attrs
    cv.setUint32(38, 0, true); // External attrs
    cv.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralDirSize = centralChunks.reduce((sum, c) => sum + c.length, 0);

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature (PK\x05\x06)
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralDirSize + eocd.length;
  const archive = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of localChunks) {
    archive.set(chunk, cursor);
    cursor += chunk.length;
  }
  for (const chunk of centralChunks) {
    archive.set(chunk, cursor);
    cursor += chunk.length;
  }
  archive.set(eocd, cursor);
  return archive;
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    const triplet = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64_CHARS[(triplet >> 18) & 0x3f];
    out += BASE64_CHARS[(triplet >> 12) & 0x3f];
    out += i + 1 < len ? BASE64_CHARS[(triplet >> 6) & 0x3f] : '=';
    out += i + 2 < len ? BASE64_CHARS[triplet & 0x3f] : '=';
  }
  return out;
}

/**
 * Serializes an OoxmlWorkbook into a genuine binary `.xlsx` file (Uint8Array).
 */
export function writeOoxmlWorkbookToBytes(workbook: OoxmlWorkbook): Uint8Array {
  const sheetNames = workbook.SheetNames;
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encodeUtf8(buildContentTypesXml(sheetNames.length)) },
    { name: '_rels/.rels', data: encodeUtf8(buildRootRelsXml()) },
    { name: 'xl/workbook.xml', data: encodeUtf8(buildWorkbookXml(sheetNames)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encodeUtf8(buildWorkbookRelsXml(sheetNames.length)) },
    { name: 'xl/styles.xml', data: encodeUtf8(buildStylesXml()) },
  ];

  sheetNames.forEach((name, idx) => {
    const sheet = workbook.Sheets[name];
    entries.push({
      name: `xl/worksheets/sheet${idx + 1}.xml`,
      data: encodeUtf8(buildWorksheetXml(sheet)),
    });
  });

  return buildZipArchive(entries);
}

/**
 * Serializes an OoxmlWorkbook into a base64-encoded `.xlsx` binary string.
 */
export function writeOoxmlWorkbookToBase64(workbook: OoxmlWorkbook): string {
  return uint8ArrayToBase64(writeOoxmlWorkbookToBytes(workbook));
}

/**
 * Creates a new empty OoxmlWorkbook container.
 */
export function createOoxmlWorkbook(): OoxmlWorkbook {
  return {
    SheetNames: [],
    Sheets: {},
  };
}

/**
 * Appends a named sheet to an OoxmlWorkbook.
 */
export function appendOoxmlSheet(
  workbook: OoxmlWorkbook,
  name: string,
  headers: string[],
  rows: CellScalar[][]
): void {
  workbook.SheetNames.push(name);
  workbook.Sheets[name] = { name, headers, rows };
}
