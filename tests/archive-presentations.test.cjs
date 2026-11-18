'use strict';

const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const dist = path.resolve(__dirname, '..', 'dist');
const context = vm.createContext();
for (const file of ['archive-text.js', 'grades-5-6-data.js', 'grades-5-6.js']) {
  vm.runInContext(fs.readFileSync(path.join(dist, 'years', file), 'utf8'), context);
}

function digest(asset) {
  return createHash('sha256').update(fs.readFileSync(path.join(dist, asset))).digest('hex').slice(0, 12);
}

test('the paper player uses the current version of each condition and answer image', () => {
  for (const edition of context.KENGURU_GRADES_5_6) {
    const player = context.KENGURU_ARCHIVE[edition.id];
    for (const [i, card] of edition.cards.entries()) {
      const number = String(i + 1).padStart(2, '0');
      const prefix = `assets/grades-5-6/${edition.year}/`;
      const original = prefix + `task-${number}.webp`;
      const originalUrl = original + '?v=' + digest(original);
      assert.equal(player.lessons[i].originalImage, original, `${edition.id}/${number}`);
      assert.equal(player.lessons[i].originalImageVersion, digest(original));
      const condition = player.scenes[i](0);
      const final = player.scenes[i](1);
      assert.ok(condition.includes(`href="${originalUrl}"`));
      assert.ok(final.includes(`href="${originalUrl}"`));
      const excerpt = card[3];
      if (excerpt) {
        const file = prefix + `answer-${number}.webp`;
        const excerptUrl = file + '?v=' + digest(file);
        assert.ok(!condition.includes(excerptUrl));
        assert.ok(final.includes(`href="${excerptUrl}"`));
      }
    }
  }
});

test('the paper player preserves reviewed glyphs and reveals transcribed keys on the answer step', () => {
  const old = context.KENGURU_ARCHIVE['1997-5-6'].lessons[12];
  assert.match(old.question, /вместо клетки/);
  assert.ok(old.choices.every(choice => choice.includes('□')));

  const layout = context.KENGURU_ARCHIVE['2024-5-6'].lessons[15];
  assert.match(layout.question, /шрифтом Брайля/);
  assert.match(layout.questionNote, /Для цифры 0 выпуклые точки 2, 4, 5/);

  const excerpt = context.KENGURU_ARCHIVE['2011-5-6'].lessons[6];
  assert.doesNotMatch(excerpt.steps[0][2], /умноженное/);
  assert.match(excerpt.steps[1][2], /одно из этих чисел, умноженное на 2/);
  assert.equal(excerpt.answer, null);
});
