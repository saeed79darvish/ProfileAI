/**
 * Resume Text Extractors
 * 
 * Handles extraction of raw text from PDF and DOCX files.
 * Uses pdf-parse for PDFs and mammoth for Word documents.
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text from PDF file buffer
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from DOCX file buffer
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting DOCX text:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

/**
 * Extract text from resume based on file type
 * @param {Object} file - File object with buffer and mimetype
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromResume(file) {
  const { buffer, mimetype } = file;

  if (mimetype === 'application/pdf') {
    return await extractPdfText(buffer);
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    return await extractDocxText(buffer);
  } else {
    throw new Error('Unsupported file type. Only PDF and DOCX files are supported.');
  }
}

/**
 * Supported MIME types for resume files
 */
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];

/**
 * Check if a file type is supported
 * @param {string} mimetype - MIME type to check
 * @returns {boolean}
 */
function isSupportedFileType(mimetype) {
  return SUPPORTED_MIME_TYPES.includes(mimetype);
}

module.exports = {
  extractPdfText,
  extractDocxText,
  extractTextFromResume,
  isSupportedFileType,
  SUPPORTED_MIME_TYPES
};
