/** Export the complete bracket SVG, independently of viewport scrolling or zoom. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const TITLE = 'Tournament Trois-Rivières - Lions M13AAA Elite';
const DATE_LABEL = 'November 12–15, 2026';
const MAX_PIXELS = 16_000_000;
const MAX_SIDE = 8192;
const encoder = new TextEncoder();

function number(value) { return String(Number(value.toFixed(3))); }

/** A single-page PDF with an embedded RGB JPEG; all offsets count bytes. */
export function jpegToPdf(jpegBytes, width, height) {
  if (!(jpegBytes instanceof Uint8Array) || jpegBytes.length < 4 ||
      jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    throw new TypeError('A JPEG image is required for the PDF export.');
  }
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new TypeError('The PDF image dimensions must be positive whole numbers.');
  }

  // A generous page width keeps the whole bracket on one page, with its original
  // proportions. PDF viewers can zoom in without any page or viewport clipping.
  const margin = 36;
  const pageWidth = 1190.55;
  const imageWidth = pageWidth - margin * 2;
  const imageHeight = imageWidth * height / width;
  const pageHeight = imageHeight + margin * 2;
  const content = encoder.encode(`q\n${number(imageWidth)} 0 0 ${number(imageHeight)} ${margin} ${margin} cm\n/Bracket Do\nQ\n`);
  const chunks = [];
  const offsets = [0];
  let length = 0;
  const append = value => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id, value) => {
    offsets[id] = length;
    append(`${id} 0 obj\n${value}\nendobj\n`);
  };
  append('%PDF-1.4\n%');
  append(new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3, 10]));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(pageWidth)} ${number(pageHeight)}] /Resources << /XObject << /Bracket 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  append(jpegBytes);
  append('\nendstream\nendobj\n');
  offsets[5] = length;
  append(`5 0 obj\n<< /Length ${content.length} >>\nstream\n`);
  append(content);
  append('endstream\nendobj\n');
  object(6, '<< /Title (Tournament Trois-Rivieres - Lions M13AAA Elite) /Author (Maxine) /Creator (Lions tournament planner) >>');
  const xref = length;
  append(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const pdf = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) { pdf.set(chunk, position); position += chunk.length; }
  return pdf;
}

function titledSvg(svgString) {
  const parsed = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  const bracket = parsed.documentElement;
  if (parsed.querySelector('parsererror') || bracket.localName !== 'svg') {
    throw new Error('The visual bracket could not be read. Please refresh and try again.');
  }
  const viewBox = (bracket.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const bracketWidth = viewBox.length === 4 ? viewBox[2] : parseFloat(bracket.getAttribute('width'));
  const bracketHeight = viewBox.length === 4 ? viewBox[3] : parseFloat(bracket.getAttribute('height'));
  if (![bracketWidth, bracketHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('The visual bracket has invalid dimensions.');
  }

  const padding = 24;
  const headerHeight = 116;
  const width = Math.max(1024, bracketWidth) + padding * 2;
  const height = bracketHeight + headerHeight + padding;
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [name, value] of Object.entries({width, height, viewBox: `0 0 ${width} ${height}`})) {
    svg.setAttribute(name, String(value));
  }
  svg.innerHTML = `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    `<text x="${padding + 2}" y="40" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${TITLE}</text>` +
    `<text x="${padding + 2}" y="69" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-size="18">${DATE_LABEL}</text>` +
    `<text x="${padding + 2}" y="94" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-size="16">Prepared by Maxine</text>`;
  bracket.setAttribute('x', String((width - bracketWidth) / 2));
  bracket.setAttribute('y', String(headerHeight));
  bracket.setAttribute('width', String(bracketWidth));
  bracket.setAttribute('height', String(bracketHeight));
  bracket.style.fontFamily = 'Arial, Helvetica, sans-serif';
  for (const text of bracket.querySelectorAll('text')) {
    if (text.textContent.includes(' · Select a game to edit')) {
      text.textContent = text.textContent.replace(' · Select a game to edit', '');
    }
  }
  const background = [...bracket.children].find(child => child.localName === 'rect');
  if (background) background.setAttribute('fill', '#ffffff');
  const fonts = document.createElementNS(SVG_NS, 'style');
  fonts.textContent = 'text,tspan{font-family:Arial,Helvetica,sans-serif!important}';
  bracket.append(fonts);
  svg.append(bracket);
  return {source: new XMLSerializer().serializeToString(svg), width, height};
}

async function renderJpeg(svgString) {
  const {source, width, height} = titledSvg(svgString);
  const scale = Math.min(2, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not create the bracket image.');
  const url = URL.createObjectURL(new Blob([source], {type: 'image/svg+xml;charset=utf-8'}));
  try {
    const image = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The bracket image could not be rendered. Please try again.'));
      image.src = url;
    });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('The bracket image could not be saved.')), 'image/jpeg', 0.95);
    });
    return {blob, width: canvas.width, height: canvas.height};
  } finally { URL.revokeObjectURL(url); }
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try { link.click(); } finally {
    link.remove();
    // Leave the URL alive long enough for the browser to begin its download.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

export async function downloadBracket(svgString, format) {
  if (!['jpeg', 'pdf'].includes(format)) throw new TypeError('Choose JPEG or PDF to save the bracket.');
  const image = await renderJpeg(svgString);
  const filename = `lions-trois-rivieres-2026-bracket-${new Date().toISOString().slice(0, 10)}.${format === 'jpeg' ? 'jpg' : 'pdf'}`;
  const blob = format === 'jpeg' ? image.blob : new Blob([
    jpegToPdf(new Uint8Array(await image.blob.arrayBuffer()), image.width, image.height)
  ], {type: 'application/pdf'});
  saveBlob(blob, filename);
  return {filename, width: image.width, height: image.height, format};
}
