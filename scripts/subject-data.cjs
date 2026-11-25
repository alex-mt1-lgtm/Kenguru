'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const fileKey = row => [row.year, row.grade, row.variant || ''].join('/');
const idFor = row => [row.year, row.subject, row.session, row.grade, row.editionSuffix].filter(Boolean).join('-');
const answerFile = row => 'reviewed-' + [row.grade, row.session, row.editionSuffix || row.variant].filter(Boolean).join('-') + '.pdf';

function loadSubjects() {
  const subjects = [...read('sources/subject-editions.json'), ...read('sources/chip/interactive-additions.json'),
    ...read('sources/chip/interactive-2012-2014.json'), ...read('sources/chip/interactive-africa.json')];
  for (const subject of ['british-bulldog', 'golden-fleece', 'kit']) {
    const directory = 'sources/' + subject;
    const manifests = fs.readdirSync(path.join(root, directory)).filter(name => /^interactive-[\d-]+\.json$/.test(name)).sort();
    for (const manifest of manifests) subjects.push(...read(directory + '/' + manifest));
  }
  const editions = subjects.map(meta => {
    const file = meta.sourceFile ?? ['sources', meta.subject, meta.year, meta.session, meta.grade + '.json'].filter(Boolean).join('/');
    return {meta: {...meta, answersFile: answerFile(meta), reviewedKey: true}, rows: read(file), file};
  });
  const forms = read('sources/golden-fleece/archive-materials.json');
  const bases = new Map(read('sources/golden-fleece/paper-base-keys.json').map(row => [fileKey(row), row]));
  const corrections = new Map();
  for (const row of read('sources/golden-fleece/archive-corrections-modern.json')) {
    const key = fileKey(row);
    if (!corrections.has(key)) corrections.set(key, []);
    corrections.get(key).push(row);
  }
  const paper = new Map();
  for (const [key, fixes] of corrections) {
    if (!forms.some(row => fileKey(row) === key)) throw new Error('Unknown corrected booklet: ' + key);
    if (new Set(fixes.map(r => r.number)).size !== fixes.length) throw new Error('Duplicate correction: ' + key);
  }
  for (const form of forms) {
    const key = fileKey(form);
    const fixes = corrections.get(key);
    const base = bases.get(key);
    if (!base && !fixes) continue;
    const meta = {...form, subject: 'golden-fleece', contest: 'Золотое руно', language: form.variant === 'kz' || (form.year === 2012 && form.variant === '980') ? 'kk' : 'ru', points: 3,
      letters: base?.letters || 'ABCD', editionSuffix: form.variant ? 'v' + form.variant.replace(/-/g, '') : undefined,
      editionLabel: form.variantLabel, reviewedKey: true};
    meta.answersFile = answerFile(meta);
    const full = editions.find(e => e.meta.subject === meta.subject && e.meta.year === meta.year && e.meta.tasksFile === form.tasksFile && !e.meta.partial);
    if (full) {
      if (base && full.rows.length !== base.answers.length) throw new Error('Incomplete booklet: ' + key);
      for (const fix of fixes || []) {
        const row = full.rows[fix.number - 1];
        if (idFor(meta) !== idFor(full.meta) || !row || (row.number ?? fix.number) !== fix.number ||
            row.question !== fix.question || row.answer !== fix.answer || JSON.stringify(row.choices) !== JSON.stringify(fix.choices)) {
          throw new Error('Previously reviewed question changed: ' + key + '/' + fix.number);
        }
        row.adaptation ??= 'Формулировка уточнена в редакции сайта.';
      }
      continue;
    }
    let paperRows = [];
    if (base) {
      paperRows = base.answers.map((letter, i) => {
        const corrected = fixes?.find(row => row.number === i + 1);
        if (corrected) return corrected;
        const answer = typeof letter === 'string' && letter.length === 1 ? meta.letters.indexOf(letter) : -1;
        if (answer < 0) throw new Error('Unresolved answer: ' + key + '/' + (i + 1));
        return {number: i + 1, answer, choices: []};
      });
    }
    if (fixes && base && fixes.some(row => row.number < 1 || row.number > paperRows.length)) throw new Error('Correction outside key: ' + key);
    const sorted = [...(fixes || [])].sort((a,b) => a.number - b.number);
    paper.set(key, {meta, rows: base ? paperRows : sorted, partial: !base});
    if (sorted.length) {
      const rows = sorted.map(row => ({...row, title: row.title || 'Задание ' + row.number}));
      editions.push({meta: {...meta, partial: true, firstNumber: rows[0].number, count: rows.length,
        choiceCounts: [...new Set(rows.map(row => row.choices.length))]}, rows, file: key});
    }
  }
  return {editions, paper};
}

module.exports = {loadSubjects, idFor, fileKey, answerFile};
