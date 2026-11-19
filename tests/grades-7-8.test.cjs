'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const context = vm.createContext({});
for (const source of ['lesson-visuals.js', 'years/grades-7-8-data.js', 'years/grades-7-8.js']) {
  vm.runInContext(fs.readFileSync(path.join(dist, source), 'utf8'), context, {filename: source});
}
const editions = context.KENGURU_GRADES_7_8;

test('the archive lists all official 7–8 editions and links to each interactive edition', () => {
  const {datasets} = JSON.parse(fs.readFileSync(path.join(root, 'sources/grade-7-8-manifest.json'), 'utf8'));
  const archive = fs.readFileSync(path.join(dist, 'archive.html'), 'utf8').split('<!-- grades-7-8:start -->')[1];
  assert.equal(datasets.length, 30);
  assert.equal(editions.length, 7);
  for (const edition of datasets) {
    assert.ok(archive.includes(edition.tasksUrl));
    assert.ok(archive.includes(edition.answersUrl));
    assert.equal(archive.includes('#zadacha=' + edition.id + '/1'), edition.year >= 2020);
  }
});

test('7–8 grade cards have native conditions and accessible artwork with matching official scoring', () => {
  const rating = JSON.parse(fs.readFileSync(path.join(dist, 'api/rating-catalog.json'), 'utf8'));
  const unrated = ['2021-7-8/7', '2022-7-8/15'];
  assert.equal(editions.reduce((total, edition) => total + edition.cards.length, 0), 204);
  for (const {id, year, cards} of editions) {
    const lessons = context.KENGURU_ARCHIVE[id].lessons;
    assert.equal(new Set(cards.map(card => card.title)).size, cards.length);
    for (const card of cards) {
      const key = id + '/' + card.number;
      const lesson = lessons[card.number - 1];
      assert.equal(lesson.title, card.title);
      assert.equal(lesson.question, card.question);
      assert.ok(card.question.trim(), key);
      assert.equal(card.options.length, 5, key);
      for (const option of card.options) {
        if (option.image) {
          assert.ok(option.description && !option.text, key);
          assert.ok(fs.existsSync(path.join(dist, option.image)), option.image);
        } else {
          assert.ok(option.text.trim(), key);
        }
      }
      if (card.condition) {
        assert.ok(card.condition.alt, key);
        assert.ok(fs.existsSync(path.join(dist, card.condition.src)), card.condition.src);
      }
      if (unrated.includes(key)) {
        assert.equal(card.answer, null);
        assert.equal(rating[key], undefined);
      } else {
        assert.ok(Number.isInteger(card.answer) && card.answer >= 0 && card.answer < 5, key);
        assert.deepEqual(rating[key], [card.answer, card.points], key);
      }
      assert.equal(lesson.paperEdition, year === 2020 || key === '2022-7-8/15', key);
      for (const stage of card.review) {
        assert.ok(stage.title && stage.text, key);
        if (stage.image) assert.ok(fs.existsSync(path.join(dist, stage.image)), stage.image);
      }
    }
  }
});

test('equal-area illustration moves the quarter-circles and works at a complete frame', () => {
  const area = context.KENGURU_ARCHIVE['2026-7-8'].scenes[0];
  assert.match(area(1, 0), /радиус/u);
  const first = area(2, 0);
  const intermediate = area(2, 1);
  const complete = area(2, 12);
  assert.notEqual(first, intermediate);
  assert.notEqual(intermediate, complete);
  assert.equal((complete.match(/rotate\(/gu) ?? []).length, 16);
  assert.doesNotMatch(complete, /NaN|undefined/u);
  assert.equal(area(0, 0), '');
});
