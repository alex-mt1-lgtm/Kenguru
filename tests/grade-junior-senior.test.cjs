'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const sources = path.join(root, 'sources');
const context = vm.createContext({});
for (const source of ['lesson-visuals.js', 'years/grade-junior-senior-data.js', 'years/grade-editions.js']) {
  vm.runInContext(fs.readFileSync(path.join(dist, source), 'utf8'), context, {filename: source});
}
const manifest = JSON.parse(fs.readFileSync(path.join(sources, 'grade-junior-senior-manifest.json'), 'utf8'));
const editions = new Map(context.KENGURU_JUNIOR_SENIOR.map(edition => [edition.id, edition]));

test('the archive reflects the official contest groups and keeps their source booklets', () => {
  const archive = fs.readFileSync(path.join(dist, 'archive.html'), 'utf8');
  assert.equal(manifest.datasets.length, 45);
  assert.equal(editions.size, 45);
  assert.equal([...editions.values()].reduce((total, {cards}) => total + cards.length, 0), 1257);
  assert.match(archive, /id="grades-1-2"/u);
  assert.match(archive, /id="grades-9-11"/u);
  for (const entry of manifest.datasets) {
    assert.ok(fs.readFileSync(path.join(sources, entry.sourceDir, 'tasks.pdf')).subarray(0, 5).equals(Buffer.from('%PDF-')), entry.id);
    assert.ok(archive.includes(entry.tasksUrl), entry.id);
    assert.ok(archive.includes(entry.answersUrl), entry.id);
    assert.equal(archive.includes('#zadacha=' + entry.id + '/1'), editions.has(entry.id), entry.id);
  }
  const junior2021 = manifest.datasets.find(entry => entry.id === '2021-2');
  const senior2023 = manifest.datasets.find(entry => entry.id === '2023-9-11');
  assert.deepEqual(junior2021.grades, [2]);
  assert.deepEqual(senior2023.grades, [9,10,11]);
  assert.deepEqual(senior2023.keyGrades, [9,10]);
  const senior2022 = manifest.datasets.find(entry => entry.id === '2022-9-10');
  assert.deepEqual(senior2022.keyGrades, [9,10]);
  assert.deepEqual([...editions.get(senior2022.id).grades], [9,10,11]);
  assert.equal(editions.get(senior2022.id).label, '9–11 классы');
  assert.match(archive, /<h3>2022<\/h3><a class="archive-open" href="\.\/#zadacha=2022-9-10\/1"/u);
});

test('each interactive junior and senior task uses native text, available artwork and the correct rating scale', () => {
  assert.deepEqual([...editions.get('1997-9-10').answerLetters], [...'ABCDE']);
  const grade2 = editions.get('2017-2').cards[5];
  assert.equal(grade2.options[grade2.answer].text, '2');
  assert.equal(grade2.points, 3);
  assert.match(grade2.review[1].text, /6 − 4 = 2/u);
  const shading = context.KENGURU_ARCHIVE['2017-2'].scenes[5];
  assert.notEqual(shading(2, 0), shading(2, 2));
  const rating = JSON.parse(fs.readFileSync(path.join(dist, 'api/rating-catalog.json'), 'utf8'));
  for (const entry of manifest.datasets) {
    if (!editions.has(entry.id)) continue;
    const {cards} = editions.get(entry.id);
    const source = JSON.parse(fs.readFileSync(path.join(sources, entry.sourceDir, 'edition.json'), 'utf8'));
    const counts = source.pointsPerGroup ?? [cards.length / 3, cards.length / 3, cards.length / 3];
    assert.equal(cards.length, source.tasks.length, entry.id);
    assert.equal(new Set(cards.map(card => card.title)).size, cards.length, entry.id);
    const lesson = context.KENGURU_ARCHIVE[entry.id].lessons;
    for (const card of cards) {
      const key = entry.id + '/' + card.number;
      const expectedPoints = card.number <= counts[0] ? 3 : card.number <= counts[0] + counts[1] ? 4 : 5;
      assert.equal(card.points, expectedPoints, key);
      assert.equal(lesson[card.number - 1].title, card.title, key);
      assert.ok(card.title.length <= 30 && card.question.trim(), key);
      assert.equal(card.options.length, 5, key);
      assert.ok(Number.isInteger(card.answer) && card.answer >= 0 && card.answer < 5, key);
      assert.deepEqual(rating[key], [card.answer, expectedPoints], key);
      for (const option of card.options) {
        assert.ok(option.text?.trim() || (option.description?.trim() && fs.existsSync(path.join(dist, option.image))), key);
      }
      if (card.condition) assert.ok(card.condition.alt && fs.existsSync(path.join(dist, card.condition.src)), key);
      for (const stage of card.review) {
        assert.ok(stage.title?.trim() && stage.text?.trim(), key);
        if (stage.image) assert.ok(fs.existsSync(path.join(dist, stage.image)), key);
      }
    }
  }
});
