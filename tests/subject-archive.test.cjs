'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {buildSubjectArchive} = require('../scripts/subject-archive.cjs');
const root = path.join(__dirname, '..');

test('the four subject archives include every local booklet, its matching key and available recordings', () => {
  const html = fs.readFileSync(path.join(root, 'dist/archive.html'), 'utf8');
  assert.equal(buildSubjectArchive(html), html);
  const {loadSubjects, fileKey, answerFile} = require('../scripts/subject-data.cjs');
  const subjects = loadSubjects();
  for (const subject of ['british-bulldog', 'golden-fleece', 'kit', 'chip']) {
    const rows = JSON.parse(fs.readFileSync(path.join(root, 'sources', subject, 'archive-materials.json'), 'utf8'));
    const editions = JSON.parse(fs.readFileSync(path.join(root, 'sources/subject-editions.json'), 'utf8'));
    for (const row of rows) {
      const folder = 'assets/' + subject + '/' + row.year + '/';
      assert.ok(html.includes('id="' + subject + '-' + row.year + '"'));
      for (const field of ['tasksFile', 'readerFile', 'answersFile', 'listeningFile', 'solutionsFile', 'additionalSolutionsFile']) {
        if (!row[field]) continue;
        const href = folder + row[field];
        const {editions: lessons, paper} = subjects;
        const reviewed = lessons.find(e => e.meta.subject === subject && e.meta.year === row.year && e.meta.tasksFile === row.tasksFile)?.meta
          ?? (subject === 'golden-fleece' && paper.get(fileKey(row))?.meta);
        const target = field === 'answersFile' && reviewed ? folder + reviewed.answersFile : href;
        if (html.includes('href="' + target + '"')) continue;
        const edition = editions.find(entry => entry.subject === subject && entry.grade === row.grade && entry.year === row.year && entry.session === row.session);
        assert.ok(edition?.[field], 'Missing link ' + target);
        const alternate = folder + (field === 'answersFile' ? answerFile(edition) : edition[field]);
        assert.ok(html.includes('href="' + alternate + '"'), alternate);
        if (field !== 'answersFile') assert.ok(fs.readFileSync(path.join(root, 'dist', href)).equals(fs.readFileSync(path.join(root, 'dist', alternate))), href);
      }
    }
  }
});

test('every interactive question has a verified answer and its score in the deployed catalogue', () => {
  const {loadLessonCatalog} = require('../scripts/lesson-catalog.cjs');
  const {lessons} = loadLessonCatalog();
  const catalog = JSON.parse(fs.readFileSync(path.join(root,'dist/api/rating-catalog.json')));
  for (const lesson of lessons) {
    const id = lesson.datasetId + '/' + lesson.number;
    if (lesson.textAnswer !== undefined) {
      assert.deepEqual(catalog[id], [lesson.textAnswer, lesson.points, 'text'], id);
      assert.equal(lesson.choices.length, 0, id);
      assert.ok(lesson.points > 0 && !lesson.keyConflict, id);
      continue;
    }
    const numeric = Number.isInteger(lesson.numericAnswer);
    const expected = numeric ? lesson.numericAnswer : lesson.answer;
    assert.ok(Number.isInteger(expected) && expected >= 0 && (numeric || expected < lesson.choices.length), id);
    assert.ok(lesson.points > 0 && !lesson.keyConflict, id);
    if (lesson.acceptedAnswers) {
      assert.ok(!numeric && lesson.acceptedAnswers.includes(expected), id);
      assert.ok(lesson.acceptedAnswers.every(i => Number.isInteger(i) && i >= 0 && i < lesson.choices.length), id);
    }
    assert.deepEqual(catalog[id], numeric ? [expected, lesson.points, 'number', ...(lesson.acceptedNumericAnswers ? [Array.from(lesson.acceptedNumericAnswers)] : [])] :
      [expected, lesson.points, ...(lesson.acceptedAnswers ? [Array.from(lesson.acceptedAnswers)] : [])], id);
  }
});

test('each ChIP school booklet in local storage has a complete interactive edition', () => {
  const {refreshCoverage} = require('../scripts/build-chip-coverage.cjs');
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'sources/chip/coverage-matrix.json'), 'utf8'));
  assert.deepEqual(refreshCoverage(structuredClone(inventory)), inventory);
  const withBooklet = inventory.school.filter(row => row.archive.tasks);
  assert.equal(inventory.counts.schoolBooklets, withBooklet.length);
  for (const row of withBooklet) {
    assert.equal(row.interactiveQuestions, row.problemCount, [row.year, row.session, row.grade].filter(Boolean).join('/'));
    assert.ok(row.interactive && fs.existsSync(path.join(root, row.interactive)), row.interactive);
  }
});

test('every stored Bulldog, Golden Fleece and KIT booklet has its entire scored interactive lesson', () => {
  const {loadSubjects, idFor} = require('../scripts/subject-data.cjs');
  const {editions} = loadSubjects();
  for (const subject of ['british-bulldog', 'golden-fleece', 'kit']) {
    const archive = JSON.parse(fs.readFileSync(path.join(root, 'sources', subject, 'archive-materials.json')));
    for (const booklet of archive) {
      const matches = editions.filter(({meta}) => meta.subject === subject && meta.year === booklet.year
        && meta.tasksFile === booklet.tasksFile && !meta.partial);
      assert.equal(matches.length, 1, subject + '/' + booklet.year + '/' + booklet.tasksFile);
      const {meta, rows} = matches[0];
      const id = idFor(meta);
      assert.equal(rows.length, meta.count, id);
      for (const [index, row] of rows.entries()) {
        const label = id + '/' + (index + 1);
        assert.equal(row.number ?? index + 1, index + 1, label);
        assert.ok(!row.keyOnly && !row.keyConflict && row.question?.trim() && row.steps.length >= 2, label);
      }
      if (booklet.listeningFile) {
        assert.equal(meta.listeningFile ?? 'listening.mp3', booklet.listeningFile, id);
        assert.ok(rows.some(row => row.audio), id);
      }
    }
  }
});
