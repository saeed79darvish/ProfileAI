/**
 * AI Prompts Index
 * Central export for all AI prompt modules
 */

const profile = require('./profile');
const job = require('./job');
const post = require('./post');
const agent = require('./agent');
const screening = require('./screening');

module.exports = {
  profile,
  job,
  post,
  agent,
  screening
};
