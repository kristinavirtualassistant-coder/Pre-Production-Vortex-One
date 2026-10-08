import assert from 'node:assert/strict';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { extractDocumentText } from '../services/documentTextExtractor';

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipSingle(name: string, body: string): Buffer {
  const nameBuffer = Buffer.from(name);
  const data = Buffer.from(body, 'utf8');
  const compressed = deflateRawSync(data);
  const local = Buffer.alloc(30 + nameBuffer.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(8, 10);
  local.writeUInt32LE(crc32(data), 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuffer.length, 26);
  nameBuffer.copy(local, 30);

  const central = Buffer.alloc(46 + nameBuffer.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(8, 12);
  central.writeUInt32LE(crc32(data), 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  nameBuffer.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length + compressed.length, 16);

  return Buffer.concat([local, compressed, central, eocd]);
}

assert.equal(extractDocumentText(Buffer.from('\ufeffHello Vortex'), 'text/plain'), 'Hello Vortex');

const pdf = Buffer.from('%PDF-1.4\nstream\n(Hello PDF) Tj\nendstream\n%%EOF', 'latin1');
assert.equal(extractDocumentText(pdf, 'application/pdf'), 'Hello PDF');

const compressedPdfText = Buffer.from('[(First) 120 (Second)] TJ (Third) Tj', 'latin1');
const compressedPdf = Buffer.concat([
  Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n', 'latin1'),
  deflateSync(compressedPdfText),
  Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
]);
assert.equal(extractDocumentText(compressedPdf, 'application/pdf'), 'First Second Third');

const docx = zipSingle('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>Vortex DOCX</w:t></w:r></w:p></w:body></w:document>');
assert.equal(extractDocumentText(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'Vortex DOCX');

const pptx = zipSingle('ppt/slides/slide1.xml', '<p:sld><a:t>Vortex PPTX</a:t></p:sld>');
assert.equal(extractDocumentText(pptx, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), 'Vortex PPTX');

const xlsx = zipSingle(
  'xl/worksheets/sheet1.xml',
  '<worksheet><sheetData><row><c t="inlineStr"><is><t>Vortex XLSX</t></is></c><c><v>42</v></c></row></sheetData></worksheet>',
);
assert.equal(
  extractDocumentText(xlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  'Vortex XLSX\t42',
);

console.log('Document text extractor tests passed');
