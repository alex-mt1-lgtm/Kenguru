'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dist = path.join(__dirname, '..', 'dist');

// A reading copy accompanies its original booklet, answer key or commentary.
function readingPdfFor(original) {
  if (!original?.endsWith('.pdf') || original.endsWith('-reading.pdf')) return null;
  const reader = original.slice(0, -4) + '-reading.pdf';
  return fs.existsSync(path.join(dist, reader)) ? reader : null;
}

module.exports = {readingPdfFor};
