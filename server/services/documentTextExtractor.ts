import { inflateRawSync } from 'node:zlib';

const MAX_ARCHIVE_ENTRIES = 500;
const MAX_ENTRY_BYTES = 10 * 1024 * 1024;

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code: string) => {
      const n = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    });
}

function xmlText(xml: string): string {
  return decodeXml(
    xml
      .replace(/<w:tab\s*\/?>/g, '\\t')
      .replace(/<w:br\s*\/?>/g, '\\n')
      .replace(/<a:br\s*\/?>/g, '\\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\\t ]+/g, ' ')
      .replace(/\\n[ \\t]+/g, '\\n')
      .replace(/ *\\n */g, '\\n'),
  ).trim();
}

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
}

function readUInt16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function parseZip(buffer: Buffer): ZipEntry[] {
  let eocd = -1;
  const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Invalid ZIP archive: end of central directory not found');

  const count = readUInt16(buffer, eocd + 10);
  const centralOffset = readUInt32(buffer, eocd + 16);
  if (count > MAX_ARCHIVE_ENTRIES) throw new Error('ZIP archive contains too many entries');

  const entries: ZipEntry[] = [];
  let cursor = centralOffset;
  for (let i = 0; i < count; i += 1) {
    if (readUInt32(buffer, cursor) !== 0x02014b50) throw new Error('Invalid ZIP central directory');
    const method = readUInt16(buffer, cursor + 10);
    const compressedSize = readUInt32(buffer, cursor + 20);
    const uncompressedSize = readUInt32(buffer, cursor + 24);
    const nameLength = readUInt16(buffer, cursor + 28);
    const extraLength = readUInt16(buffer, cursor + 30);
    const commentLength = readUInt16(buffer, cursor + 32);
    const localOffset = readUInt32(buffer, cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    cursor += 46 + nameLength + extraLength + commentLength;

    if (uncompressedSize > MAX_ENTRY_BYTES) throw new Error('ZIP entry exceeds extraction memory limit');
    if (method !== 0 && method !== 8) throw new Error('Unsupported ZIP compression method');

    if (readUInt32(buffer, localOffset) !== 0x04034b50) throw new Error('Invalid ZIP local header');
    const localNameLength = readUInt16(buffer, localOffset + 26);
    const localExtraLength = readUInt16(buffer, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > buffer.length) throw new Error('ZIP entry exceeds archive bounds');

    entries.push({ name, method, compressedSize, uncompressedSize, dataOffset });
  }
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  const compressed = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.method === 0) return compressed;
  const result = inflateRawSync(compressed);
  if (result.length > MAX_ENTRY_BYTES) throw new Error('ZIP entry exceeds extraction memory limit');
  return result;
}

function extractOfficeOpenXml(buffer: Buffer, kind: 'docx' | 'xlsx' | 'pptx'): string {
  const entries = parseZip(buffer);
  const read = (name: string): string | null => {
    const entry = entries.find((candidate) => candidate.name === name);
    return entry ? readZipEntry(buffer, entry).toString('utf8') : null;
  };

  if (kind === 'docx') {
    const document = read('word/document.xml');
    if (!document) throw new Error('DOCX document.xml not found');
    return xmlText(document);
  }

  if (kind === 'pptx') {
    const slides = entries
      .filter((entry) => /^ppt\/slides\/slide\\d+\\.xml$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!slides.length) throw new Error('PPTX slides not found');
    return slides.map((entry) => xmlText(readZipEntry(buffer, entry).toString('utf8'))).filter(Boolean).join('\\n\\n');
  }

  const sharedStringsXml = read('xl/sharedStrings.xml');
  const sharedStrings = sharedStringsXml
    ? [...sharedStringsXml.matchAll(/<si[\\s\\S]*?<\\/si>/g)].map((match) => xmlText(match[0]))
    : [];

  const sheets = entries
    .filter((entry) => /^xl\/worksheets\/sheet\\d+\\.xml$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!sheets.length) throw new Error('XLSX worksheets not found');

  const rows: string[] = [];
  for (const sheet of sheets) {
    const xml = readZipEntry(buffer, sheet).toString('utf8');
    for (const row of xml.matchAll(/<row[\\s\\S]*?<\\/row>/g)) {
      const cells: string[] = [];
      for (const cell of row[0].matchAll(/<c\\b([^>]*)>[\\s\\S]*?<\\/c>/g)) {
        const attrs = cell[1];
        const valueMatch = cell[0].match(/<v>([\\s\\S]*?)<\\/v>/);
        if (!valueMatch) continue;
        const raw = decodeXml(valueMatch[1].trim());
        const type = attrs.match(/\\bt="([^"]+)"/)?.[1];
        cells.push(type === 's' ? (sharedStrings[Number(raw)] || '') : raw);
      }
      if (cells.length) rows.push(cells.join('\\t'));
    }
  }
  return rows.join('\\n').trim();
}

function extractPdf(buffer: Buffer): string {
  const chunks: string[] = [];
  const source = buffer.toString('latin1');
  for (const match of source.matchAll(/stream\\r?\\n([\\s\\S]*?)\\r?\\nendstream/g)) {
    const raw = Buffer.from(match[1], 'latin1');
    let decoded = raw;
    try {
      decoded = inflateRawSync(raw);
    } catch {
      // Uncompressed PDF content streams are also valid.
    }
    const text = decoded.toString('latin1');
    for (const tj of text.matchAll(/\\((?:\\\\.|[^\\)])*\\)\\s*Tj/g)) {
      chunks.push(tj[0].replace(/\\s*Tj$/, '').replace(/^\\(|\\)$/g, '').replace(/\\([\\\\()])/g, '$1'));
    }
    for (const tjArray of text.matchAll(/\\[([\\s\\S]*?)\\]\\s*TJ/g)) {
      for (const part of tjArray[1].matchAll(/\\((?:\\\\.|[^\\)])*\\)/g)) {
        chunks.push(part[0].slice(1, -1).replace(/\\([\\\\()])/g, '$1'));
      }
    }
  }
  return decodeXml(chunks.join(' ')).replace(/\\s+/g, ' ').trim();
}

export function extractDocumentText(buffer: Buffer, mimeType: string): string {
  const mime = mimeType.toLowerCase().split(';')[0].trim();
  if (mime === 'application/pdf') return extractPdf(buffer);
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return extractOfficeOpenXml(buffer, 'docx');
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return extractOfficeOpenXml(buffer, 'xlsx');
  if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return extractOfficeOpenXml(buffer, 'pptx');
  if (mime === 'text/plain' || mime === 'text/csv' || mime === 'application/json' || mime === 'application/xml' || mime === 'text/xml') {
    return buffer.toString('utf8').replace(/^\\uFEFF/, '').trim();
  }
  throw new Error('Document text extraction is not supported for MIME type: ' + (mime || 'unknown'));
}
