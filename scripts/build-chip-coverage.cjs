'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {loadSubjects} = require('./subject-data.cjs');

const root = path.join(__dirname, '..');
const destination = path.join(root, 'sources/chip/coverage-matrix.json');
const editionId = row => [row.year, row.session, row.grade].filter(Boolean).join('/');

function refreshCoverage(matrix) {
  const books = new Map(loadSubjects().editions.filter(({meta}) => meta.subject === 'chip')
    .map(book => [editionId(book.meta), book]));
  let interactive = 0;
  let questions = 0;
  for (const row of matrix.school) {
    const id = editionId(row);
    const book = books.get(id);
    for (const original of Object.values(row.archive)) {
      if (!fs.existsSync(path.join(root, original))) throw new Error(id + ': missing ' + original);
    }
    if (!book) {
      delete row.interactive;
      delete row.interactiveQuestions;
      continue;
    }
    if (!row.archive.tasks || book.rows.length !== row.problemCount) throw new Error(id + ': incomplete booklet');
    row.interactive = book.meta.sourceFile ?? 'sources/chip/' + id + '.json';
    row.interactiveQuestions = book.rows.length;
    books.delete(id);
    interactive++;
    questions += book.rows.length;
  }
  if (books.size) throw new Error('Add these booklets to the source inventory: ' + [...books.keys()].join(', '));
  matrix.counts.interactive = interactive;
  matrix.counts.interactiveQuestions = questions;
  return matrix;
}

if (require.main === module) {
  const content = fs.readFileSync(destination, 'utf8');
  const fresh = JSON.stringify(refreshCoverage(JSON.parse(content)), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (fresh !== content) throw new Error('Run node scripts/build-chip-coverage.cjs to refresh the ChIP inventory');
  } else {
    fs.writeFileSync(destination, fresh);
  }
}

module.exports = {refreshCoverage};
