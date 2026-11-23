'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {dist, loadLessonCatalog} = require('../scripts/lesson-catalog.cjs');
const {readMaterials} = require('../scripts/russian-archive.cjs');
const source = path.join(dist, '..', 'sources', 'medvezhonok');
const evidence = JSON.parse(fs.readFileSync(path.join(source, 'archive-evidence.json'))).editions;

test('the Russian archive preserves the verified booklets for the historical grade groups', () => {
  const byId = new Map(readMaterials().map(row => [row.year + '/' + row.grade, row]));
  for (let year = 2000; year <= 2025; year++) {
    const groups = year === 2000 ? ['5-6', '7-8', '9-11'] : ['6-7', '8-9', '10-11'];
    if (year >= 2001 && year <= 2003) groups.push('3-5');
    if (year >= 2022) groups.push('1');
    for (const grade of groups) {
      const id = year + '/' + grade;
      const row = byId.get(id);
      const record = evidence.find(book => book.year === year && book.grade === grade);
      assert.ok(row && record, id);
      for (const [filename, expected] of [[row.tasksFile, record.taskPdf], [row.answersFile, record.answerPdf]]) {
        const published = fs.readFileSync(path.join(dist, 'assets/medvezhonok', String(year), filename));
        assert.equal(published.subarray(0, 5).toString(), '%PDF-', id);
        assert.equal(crypto.createHash('sha256').update(published).digest('hex'), expected.sha256, id);
      }
    }
  }
});

test('every converted Russian edition has a complete, scored walkthrough in the archive', () => {
  const {catalog, lessons} = loadLessonCatalog();
  const editions = new Map(catalog.map(book => [book.id, book]));
  const rating = JSON.parse(fs.readFileSync(path.join(dist, 'api/rating-catalog.json')));
  const archive = fs.readFileSync(path.join(dist, 'archive.html'), 'utf8');
  for (const {year, grade} of readMaterials()) {
    const id = year + '-medvezhonok-' + grade;
    const file = path.join(source, String(year), 'editions', grade + '.json');
    assert.ok(fs.existsSync(file), id + ' has an original booklet and needs an interactive edition');
    assert.ok(archive.includes('href="./#zadacha=' + id + '/1"'), id);
    assert.ok(editions.has(id), id);
    const book = editions.get(id);
    const rows = JSON.parse(fs.readFileSync(file));
    assert.equal(book.indices.length, rows.length, id);
    for (const [i, index] of book.indices.entries()) {
      const lesson = lessons[index];
      const key = id + '/' + (i + 1);
      assert.equal(lesson.number, i + 1, key);
      assert.ok(lesson.steps.length >= 4 && lesson.steps[1][2].trim() !== lesson.steps[2][2].trim(), key);
      assert.equal(lesson.answer, 'АБВГД'.indexOf(rows[i].key), key);
      assert.deepEqual(rating[key], [lesson.answer, lesson.points, ...(rows[i].acceptedAnswers ? [rows[i].acceptedAnswers] : [])], key);
      assert.ok(lesson.choices.every((text,j) => text.trim() || lesson.choiceImages?.[j]), key);
      assert.doesNotMatch(lesson.choices.join(' '), /(?:задачи|задания),?\s+оцениваемые в\s+[345]\s+балл/i, key);
    }
  }
});
