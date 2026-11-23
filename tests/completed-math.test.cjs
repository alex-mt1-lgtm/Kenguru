'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadCompletedMath} = require('../scripts/math-completion.cjs');
const {loadLessonCatalog, dist} = require('../scripts/lesson-catalog.cjs');

test('all historical primary and middle booklets open with scored tasks and worked solutions', () => {
  const editions = loadCompletedMath();
  const ids = new Set(editions.map(edition => edition.id));
  for (let year = 1997; year <= 2019; year++) {
    assert.ok(ids.has(year + '-7-8'));
    if (year < 2000) assert.ok(ids.has(year + '-3-4'));
  }
  const model = loadLessonCatalog();
  const byId = new Map(model.catalog.map(entry => [entry.id, entry]));
  const rating = JSON.parse(fs.readFileSync(path.join(dist, 'api/rating-catalog.json')));
  for (const {id, cards} of editions) {
    const entry = byId.get(id);
    assert.equal(entry.indices.length, cards.length, id);
    for (const [offset, card] of cards.entries()) {
      const lesson = model.lessons[entry.indices[offset]];
      const key = id + '/' + (offset + 1);
      assert.equal(lesson.paperEdition, false, key);
      assert.deepEqual(Array.from(lesson.steps.slice(1), step => step[2]), card.review.map(step => step.text), key);
      assert.deepEqual(rating[key], [card.answer, card.points], key);
    }
  }
});
