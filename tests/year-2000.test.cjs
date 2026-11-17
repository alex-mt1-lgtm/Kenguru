'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.resolve(__dirname, '../dist');
const context = vm.createContext();
for (const id of ['2000-visual', '2000-three', '2000-four', '2000-five', '2000']) {
  vm.runInContext(fs.readFileSync(path.join(dist, 'years', id + '.js'), 'utf8'), context);
}
const edition = context.KENGURU_ARCHIVE[2000];
const official = 'B E D E D C D E D D B E D B A D A B E D D A D B D C'.split(' ');

test('the 2000 year preserves numbering, original A–E letters, scores and official answers', () => {
  assert.equal(edition.id, '2000-3-4');
  assert.equal(edition.answerLetters.join(''), 'ABCDE');
  assert.equal(edition.lessons.length, 26);
  assert.equal(edition.scenes.length, 26);

  for (const [i, lesson] of edition.lessons.entries()) {
    assert.equal(lesson.number, i + 1);
    assert.equal(lesson.points, i < 10 ? 3 : i < 20 ? 4 : 5);
    assert.equal(lesson.choices.length, 5);
    assert.equal(edition.answerLetters[lesson.answer], official[i], 'Task ' + lesson.number);
    assert.ok(lesson.steps.length >= 3);
    assert.ok(lesson.steps.every(step => step.length === 3 && step.every(value =>
      typeof value === 'string' && value.trim() && !/догад/iu.test(value))));
    const images = [lesson.originalImage, ...(lesson.choiceImages ?? [])];
    if (lesson.choiceImages) assert.equal(lesson.choiceImages.length, 5);
    for (const image of images) {
      const bytes = fs.readFileSync(path.resolve(dist, image));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
  }
});

test('the independent stage stays still and animated explanation frames are valid', () => {
  for (const [i, scene] of edition.scenes.entries()) {
    const steps = edition.lessons[i].steps;
    assert.equal(scene(0, 0), scene(0, 20), 'Independent stage for task ' + (i + 1));
    assert.ok(steps.slice(1).some((_, j) => scene(j + 1, 0.1) !== scene(j + 1, 4.9)),
      'Animation for task ' + (i + 1));
    for (const [step] of steps.entries()) {
      if (step > 0) {
        const budget = step === steps.length - 1 ? 4500 : 6500;
        assert.equal(scene(step, budget / 600), scene(step, 50),
          'Animation ends before the next step for task ' + (i + 1));
      }
      for (const frame of [0, .1, 1.25, 4.9, 7.5, 10.84]) {
        const markup = scene(step, frame);
        assert.match(markup, /^<svg [^>]+aria-label="[^"]+".*<\/svg>$/s);
        assert.doesNotMatch(markup, /NaN|undefined|Infinity/);
      }
    }
  }
});

test('2000 archive card links to the interactive task and keeps PDF access', () => {
  const archive = fs.readFileSync(path.join(dist, 'archive.html'), 'utf8');
  assert.match(archive, /<li id="2000"[^>]*>[^]*?href="\.\/#zadacha=2000-3-4\/1"/u);
  assert.match(archive, /href="https:\/\/files\.mathkang\.ru\/old\/kenguru_2000_class_3-4\.pdf"/u);
});

test('the farmer relay reaches the time lower bound with valid bike handoffs', () => {
  const minPerKm = {bike: 4, foot: 12};
  const routeTimes = legs => {
    let time = 0;
    return legs.map(([from, to, mode]) => {
      const departure = time;
      time += (to - from) * minPerKm[mode];
      return {departure, arrival: time};
    });
  };
  const until = routeTimes([[0, 20, 'bike'], [20, 30, 'foot']]);
  const middle = routeTimes([[0, 10, 'bike'], [10, 20, 'foot'], [20, 30, 'bike']]);
  const from = routeTimes([[0, 10, 'foot'], [10, 30, 'bike']]);

  assert.equal(until[0].arrival, 80);
  assert.equal(middle[2].departure, 160);
  assert.ok(until[0].arrival <= middle[2].departure);
  assert.equal(middle[0].arrival, 40);
  assert.equal(from[1].departure, 120);
  assert.ok(middle[0].arrival <= from[1].departure);

  const lowerBound = (90 * minPerKm.foot - 60 * (minPerKm.foot - minPerKm.bike)) / 3;
  assert.equal(lowerBound, 200);
  assert.deepEqual([until, middle, from].map(route => route.at(-1).arrival), [200, 200, 200]);
  assert.equal(edition.lessons[25].choices[edition.lessons[25].answer], '3 ч 20 мин');
});
