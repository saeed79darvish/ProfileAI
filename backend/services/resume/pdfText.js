/**
 * PDF → text, for every resume upload path.
 *
 * Two copies of this used to exist and both failed the same way on ordinary
 * text PDFs: "Failed to extract text from PDF". pdf-parse bundles pdf.js 1.10,
 * which reads a Buffer's whole underlying ArrayBuffer and ignores its
 * byteOffset. Node hands small Buffers (multer's concatenated upload among
 * them) a slice of a shared 8 KB pool, so pdf.js was parsing the pool — other
 * bytes, then the file — and reported "bad XRef entry". Even the PDFs this app
 * generates itself failed to parse back in.
 *
 * Fix: a private copy of the bytes, so byteOffset is 0. If the old engine
 * still refuses, the newer pdf.js that ships inside the same package gets a
 * second try before we give up.
 */
const path = require('node:path');

// The inner lib path, not the package index: the index has a debug shim that
// reads a test fixture when module.parent is undefined (Render's Node 22).
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

let pdfjsV2 = null;
const loadPdfjsV2 = () => {
  if (!pdfjsV2) {
    pdfjsV2 = require(path.join(
      path.dirname(require.resolve('pdf-parse/package.json')),
      'lib/pdf.js/v2.0.550/build/pdf.js'
    ));
  }
  return pdfjsV2;
};

/** A copy whose ArrayBuffer is exactly this file and nothing else. */
const ownBytes = (buffer) => new Uint8Array(buffer);

/* The same line reconstruction pdf-parse does, so text from either engine
   reads the same to the parser downstream. */
async function extractWithPdfjsV2(buffer) {
  const PDFJS = loadPdfjsV2();
  const doc = await PDFJS.getDocument({ data: ownBytes(buffer) }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i += 1) {
    const content = await (await doc.getPage(i)).getTextContent();
    let lastY;
    for (const item of content.items) {
      const y = item.transform[5];
      text += (lastY === undefined || lastY === y) ? item.str : `\n${item.str}`;
      lastY = y;
    }
    text += '\n\n';
  }
  return text;
}

class PdfTextError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

/**
 * @returns {Promise<string>} the text layer
 * @throws {PdfTextError} code 'pdf_password' | 'pdf_unreadable'
 */
async function pdfToText(buffer) {
  let firstError;
  try {
    const data = await pdfParse(ownBytes(buffer));
    if (String(data.text || '').trim()) return data.text;
  } catch (error) {
    firstError = error;
  }

  try {
    return await extractWithPdfjsV2(buffer);
  } catch (error) {
    const cause = error || firstError;
    console.error('Error extracting PDF text:', firstError?.message, '|', cause?.message);
    if (/password/i.test(`${cause?.name} ${cause?.message}`)) {
      throw new PdfTextError('pdf_password', 'This PDF is password-protected', cause);
    }
    throw new PdfTextError('pdf_unreadable', 'Failed to extract text from PDF', cause);
  }
}

module.exports = { pdfToText, PdfTextError };
