'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const context = vm.createContext();
for (const file of ['legacy-catalog.js', 'legacy-conditions.js', 'legacy-editions.js']) {
  vm.runInContext(fs.readFileSync(path.join(dist, 'years', file), 'utf8'), context);
}

test('every 2001–2019 edition has 26 checked lessons, the official key, and its original artwork', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'sources/archive-manifest.json')));
  const years = Object.keys(context.KENGURU_ARCHIVE).map(Number);
  assert.deepEqual(years, Array.from({length: 19}, (_, i) => 2001 + i));
  for (const year of years) {
    const localKey = JSON.parse(fs.readFileSync(path.join(root, 'sources/legacy-lessons', year + '.json')));
    const edition = context.KENGURU_ARCHIVE[year];
    const metadata = manifest.datasets.find(entry => entry.year === year);
    assert.equal(edition.id, year + '-3-4');
    assert.equal(edition.sources.tasksUrl, metadata.tasksUrl);
    assert.equal(edition.sources.answersUrl, metadata.answersUrl);
    assert.equal(edition.answerLetters.join(''), year < 2008 ? 'ABCDE' : 'АБВГД');
    assert.equal(edition.lessons.length, 26);
    assert.equal(edition.scenes.length, 26);
    assert.equal(edition.lessons.map(lesson => lesson.answer === null ? '?' : 'ABCDE'[lesson.answer]).join(''), localKey.answers);
    for (const [i, lesson] of edition.lessons.entries()) {
      const id = year + '/' + lesson.number;
      assert.equal(lesson.number, i + 1, id);
      assert.ok(lesson.title.trim().length > 2, id);
      assert.equal(lesson.points, i < 10 ? 3 : i < 20 ? 4 : 5, id);
      assert.equal(lesson.choices.length, 5, id);
      assert.ok(lesson.steps.length >= 3, id);
      assert.ok(lesson.steps.every(step => step.length === 3 && step.every(s => s.trim())), id);
      const scene = edition.scenes[i];
      assert.equal(scene(0, 0), scene(0, 15), id);
      assert.doesNotMatch(scene(0, 0), /<rect |<text |stroke-dasharray=/u, id);
      if (lesson.question) {
        assert.ok(lesson.choices.every(Boolean) || scene(0, 0).includes('<image '), id + ' native options');
      } else {
        const view = scene(0, 0).match(/viewBox="0 0 (\d+) (\d+)"/u);
        assert.ok(view && +view[1] >= 700 && +view[2] >= 50, id + ' image size');
      }
      assert.equal(fs.readFileSync(path.join(dist, lesson.originalImage)).subarray(8, 12).toString(), 'WEBP', id);
    }
  }
});

test('each interactive archive card opens its year and lessons link to the archive', () => {
  const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const archive = fs.readFileSync(path.join(dist, 'archive.html'), 'utf8');
  assert.ok(index.indexOf('id="sources"') > index.indexOf('id="lesson"'));
  assert.match(index, /<nav class="previous-editions"[^>]*><a href="archive.html">/u);
  assert.ok(index.indexOf('id="profileMenu"') < index.indexOf('</header>'));
  assert.match(index, /<button id="accountOpen"[^>]*>Войти<\/button>\s*<details id="profileMenu"[^>]* hidden>/u);
  assert.ok(index.indexOf('id="editionMenu"') < index.indexOf('</header>'));
  assert.match(index, /<details id="editionMenu"[^>]*>[\s\S]*?<select id="yearPicker"/u);
  assert.match(index, /<details id="editionMenu"[^>]*>(?:(?!<\/details>)[\s\S])*?<a id="editionArchive" href="archive\.html#grades-3-4">Все выпуски<\/a>/u);
  assert.doesNotMatch(index, /Новая попытка|Скопировать ссылку/u);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'sources/archive-manifest.json')));
  for (const {year, id, tasksUrl, answersUrl} of manifest.datasets) {
    const card = archive.split('<li id="' + year + '"')[1]?.split('</li>')[0];
    assert.ok(card, String(year));
    assert.ok(card.includes('href="./#zadacha=' + id + '/1"'), String(year));
    assert.ok(card.includes('href="' + tasksUrl + '"'), String(year));
    assert.ok(card.includes('href="' + answersUrl + '"'), String(year));
  }
});
