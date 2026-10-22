import test from 'node:test';
import assert from 'node:assert/strict';
import {jpegToPdf, downloadBracket} from '../dist/js/export.js';

// An independently encoded RGB JPEG has non-ASCII bytes that must pass through
// unchanged. It catches accidental character-count offsets and UTF-8 conversion.
const jpeg = new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==', 'base64'));

test('PDF preserves the binary JPEG and has accurate byte-based cross references', () => {
  const bytes = jpegToPdf(jpeg, 2, 1);
  const text = Buffer.from(bytes).toString('latin1');
  assert.equal(text.slice(0, 9), '%PDF-1.4\n');
  const trailer = /startxref\n(\d+)\n%%EOF\n$/.exec(text);
  assert.ok(trailer, 'PDF includes a complete trailer');
  const xrefOffset = Number(trailer[1]);
  assert.equal(text.slice(xrefOffset, xrefOffset + 9), 'xref\n0 7\n');
  const entries = text.slice(xrefOffset + 9).split('\n').slice(0, 7);
  assert.equal(entries[0], '0000000000 65535 f ');
  entries.slice(1).forEach((entry, index) => {
    assert.match(entry, /^\d{10} 00000 n $/);
    const offset = Number(entry.slice(0, 10));
    assert.equal(text.slice(offset, offset + 7), `${index + 1} 0 obj`);
  });
  const image = /4 0 obj\n([^]*?)\nstream\n/.exec(text);
  assert.ok(image);
  assert.match(image[1], /\/Width 2 \/Height 1/);
  assert.match(image[1], /\/ColorSpace \/DeviceRGB/);
  assert.match(image[1], /\/Filter \/DCTDecode/);
  const length = Number(/\/Length (\d+)/.exec(image[1])[1]);
  assert.equal(length, jpeg.length);
  const start = image.index + image[0].length;
  assert.deepEqual(bytes.slice(start, start + length), jpeg);
  assert.equal(text.slice(start + length, start + length + 10), '\nendstream');
});

test('PDF fits the entire image proportionally inside a single page', () => {
  const text = Buffer.from(jpegToPdf(jpeg, 2, 1)).toString('latin1');
  assert.match(text, /\/Count 1/);
  const [, pageWidth, pageHeight] = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text).map(Number);
  const [, imageWidth, imageHeight, x, y] = /q\n([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(text).map(Number);
  assert.ok(Math.abs(imageWidth / imageHeight - 2) < 0.00001);
  assert.equal(x, 36);
  assert.equal(y, 36);
  assert.ok(Math.abs(imageWidth + x * 2 - pageWidth) < 0.001);
  assert.ok(Math.abs(imageHeight + y * 2 - pageHeight) < 0.001);
  assert.match(text, /\/Author \(Maxine Sun\)/);
});

test('invalid image dimensions and unsupported downloads fail clearly', async () => {
  for (const dimensions of [[0, 1], [1, -1], [1.5, 2], [NaN, 1], [1, Infinity]]) {
    assert.throws(() => jpegToPdf(jpeg, ...dimensions), /positive whole numbers/);
  }
  assert.throws(() => jpegToPdf(new Uint8Array([1, 2, 3, 4]), 1, 1), /JPEG image/);
  await assert.rejects(downloadBracket('<svg/>', 'svg'), /Choose JPEG or PDF/);
});
