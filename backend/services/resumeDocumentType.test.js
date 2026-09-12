const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyDocument, rejectionMessage } = require('./resumeDocumentType');

const CONTRACT = `CONSULTING AGREEMENT
This Agreement is entered into by and between Threedy.ai Inc. and the Consultant.
WHEREAS the parties wish to set out terms and conditions of the engagement.
The Consultant shall provide scope of services including prototype UI experiences
and demos as required by the Company. Governing law shall be the State of Delaware.
IN WITNESS WHEREOF the parties hereby execute this agreement. Confidentiality
agreement and indemnification provisions apply. Payment terms: net 30.`;

const RESUME = `SAEED DARVISH
saeed@example.com | linkedin.com/in/saeed
WORK EXPERIENCE
Staff Frontend Developer, Acme 2019-2024. Built the design system.
EDUCATION
Hack Reactor, Bootcamp Certificate, 2019
SKILLS
React, TypeScript, Node.js
PROJECTS
Bus tracker`;

// The one that must not be rejected: a resume whose whole career is contracts.
const LAWYER_RESUME = `JANE SMITH  jane@example.com
EXPERIENCE
Legal Counsel at Acme, 2018-2024. Drafted terms and conditions, negotiated
confidentiality agreement and indemnification clauses, advised on governing law,
jurisdiction and arbitration. Managed liability exposure.
EDUCATION
JD, Harvard Law
SKILLS
Contract Law, Compliance`;

test('a contract uploaded as a resume is rejected', () => {
  const result = classifyDocument(CONTRACT);
  assert.equal(result.isResume, false);
  assert.equal(result.kind, 'contract');
});

test('an invoice is rejected, and named as one', () => {
  const invoice = `INVOICE
  Invoice number 11200271. Bill to: Acme Corp. Remit to: Threedy.ai Inc.
  Amount due: $4,500. Payment terms: net 30. Tax ID 88-1234567.
  This agreement is subject to the terms and conditions overleaf. Governing law
  applies and liability is limited. The parties agree.`;
  const result = classifyDocument(invoice);
  assert.equal(result.isResume, false);
  assert.equal(result.kind, 'invoice');
  assert.match(rejectionMessage(result.kind), /invoice/);
});

test('an actual resume is accepted', () => {
  assert.equal(classifyDocument(RESUME).isResume, true);
});

test("a lawyer's resume is still a resume", () => {
  // Legal vocabulary is this person's job. Rejecting it would tell them their
  // own CV is not a CV, which is the expensive mistake here.
  const result = classifyDocument(LAWYER_RESUME);
  assert.equal(result.isResume, true, `legal=${result.legalScore} resume=${result.resumeScore}`);
});

test('empty or unreadable input is not rejected as the wrong document', () => {
  // Nothing to judge. The length check upstream owns this case, and claiming
  // an empty file is a contract would be a lie.
  assert.equal(classifyDocument('').isResume, true);
  assert.equal(classifyDocument(null).isResume, true);
});
