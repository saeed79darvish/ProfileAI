/**
 * resumeDocumentType — is this document actually a resume?
 *
 * Someone uploaded a signed consulting agreement. The parser read it, decided
 * their job title was "UI/UX Consultant at Threedy.ai Inc.", lifted the
 * services clause into a skills list, and the coach then critiqued the
 * contract as though it were a CV: "your resume reads like a placeholder".
 * Every sentence of that was confident and wrong, and it would have gone
 * onto a real profile.
 *
 * A language model will describe whatever it is handed — asked to parse a
 * resume, it parses. So the check has to happen before the model sees the
 * text, and it has to be something a model cannot talk itself out of:
 * counting the words each kind of document actually contains.
 *
 * Deliberately biased toward letting things through. A false negative tells
 * someone their real resume is not a resume, which is insulting and leaves
 * them stuck; a false positive lands them in the editor with odd fields they
 * can see and fix. When in doubt, parse it.
 */

const RESUME_MARKERS = [
  // Section headings, which nearly every resume has at least two of.
  'work experience', 'professional experience', 'employment history',
  'experience', 'education', 'skills', 'projects', 'certifications',
  'achievements', 'publications', 'volunteer', 'summary', 'objective',
  'references', 'languages', 'awards', 'career history', 'qualifications',
];

// Documents that get uploaded by mistake: contracts, invoices, offer letters,
// statements. The phrasing is boilerplate, which is what makes it countable.
const LEGAL_MARKERS = [
  'this agreement', 'the parties', 'party of the', 'whereas', 'hereby',
  'hereinafter', 'in witness whereof', 'witnesseth', 'governing law',
  'indemnif', 'confidentiality agreement', 'terms and conditions',
  'termination clause', 'shall be deemed', 'force majeure', 'arbitration',
  'jurisdiction', 'liability', 'binding upon', 'consulting agreement',
  'non-disclosure', 'effective date of this', 'signature page',
  'purchase order', 'invoice number', 'amount due', 'payment terms',
  'bill to', 'remit to', 'tax id', 'statement of work', 'scope of services',
];

const count = (text, markers) =>
  markers.reduce((n, marker) => (text.includes(marker) ? n + 1 : n), 0);

/**
 * @param {string} rawText  text extracted from the uploaded file
 * @returns {{ isResume: boolean, kind: string, resumeScore: number, legalScore: number }}
 */
function classifyDocument(rawText) {
  const text = String(rawText || '').toLowerCase();
  const resumeScore = count(text, RESUME_MARKERS);
  const legalScore = count(text, LEGAL_MARKERS);

  // Contact details are strong resume evidence and almost never appear in a
  // contract's body — a signature block carries names, not a LinkedIn URL.
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(text);
  const hasLinkedIn = text.includes('linkedin.com/in/');
  const contactScore = (hasEmail ? 1 : 0) + (hasLinkedIn ? 1 : 0);

  // Only reject when the document is loudly something else AND thin on the
  // headings a resume is built from. A resume that happens to mention an NDA
  // it worked under stays a resume.
  const isResume = !(legalScore >= 3 && resumeScore + contactScore <= 3);

  const kind = isResume
    ? 'resume'
    : legalScore >= 3 && /invoice|amount due|remit to|purchase order/.test(text)
      ? 'invoice'
      : 'contract';

  return { isResume, kind, resumeScore, legalScore };
}

// What the person is told. Names what we think it is, because "this is not a
// resume" about a document they just chose reads as an argument.
const REJECTION = {
  contract: 'That looks like a contract or agreement rather than a resume, so I have not read anything off it. Try your resume file.',
  invoice: 'That looks like an invoice rather than a resume, so I have not read anything off it. Try your resume file.',
};

const rejectionMessage = (kind) => REJECTION[kind] || REJECTION.contract;

module.exports = { classifyDocument, rejectionMessage, RESUME_MARKERS, LEGAL_MARKERS };
