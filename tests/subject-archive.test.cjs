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

test('every interactive question has one checked answer and its score in the deployed catalogue', () => {
  const {loadLessonCatalog} = require('../scripts/lesson-catalog.cjs');
  const {lessons} = loadLessonCatalog();
  const catalog = JSON.parse(fs.readFileSync(path.join(root,'dist/api/rating-catalog.json')));
  for (const lesson of lessons) {
    const id = lesson.datasetId + '/' + lesson.number;
    const numeric = Number.isInteger(lesson.numericAnswer);
    const expected = numeric ? lesson.numericAnswer : lesson.answer;
    assert.ok(Number.isInteger(expected) && expected >= 0 && (numeric || expected < lesson.choices.length), id);
    assert.ok(lesson.points > 0 && !lesson.keyConflict && !lesson.acceptedAnswers, id);
    assert.deepEqual(catalog[id], numeric ? [expected, lesson.points, 'number'] : [expected, lesson.points], id);
  }
});
