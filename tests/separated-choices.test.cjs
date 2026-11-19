const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

test('each reviewed choice group has five separate choices and a figure only where needed', () => {
  const records = JSON.parse(fs.readFileSync(path.join(root, 'sources/separated-choices.json'), 'utf8'));
  const vectorFile = path.join(root, 'sources/separated-choice-vectors.json');
  const vectorRecords = fs.existsSync(vectorFile) ? JSON.parse(fs.readFileSync(vectorFile, 'utf8')) : {};
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(dist, 'years/choice-layouts.js'), 'utf8'), context);
  const layouts = context.KENGURU_CHOICE_LAYOUTS;
  assert.equal(Object.keys(layouts).length, 164);
  assert.deepEqual(Object.keys(layouts), Object.keys(records));
  for (const [id, record] of Object.entries(records)) {
    const {options, condition} = layouts[id];
    assert.equal(options.length, 5, id);
    const assetPaths = new Set();
    if (condition) {
      assert.ok(condition.width > 0 && condition.height > 0, id);
      assert.notEqual(condition.src, record.source, id);
      assert.ok(fs.existsSync(path.join(dist, condition.src)), condition.src);
      assetPaths.add(condition.src);
    }
    assert.equal(Boolean(condition), Boolean(record.condition || record.vectorCondition || vectorRecords[id]?.condition), id);
    for (const [index, option] of options.entries()) {
      assert.ok(option.text || option.image, id + '/' + index);
      if (record.choices?.[index]?.text) {
        assert.equal(option.text, record.choices[index].text, id + '/' + index);
      }
      if (option.image) {
        assert.notEqual(option.image, record.source, id);
        assert.ok(!assetPaths.has(option.image), option.image);
        assert.ok(fs.existsSync(path.join(dist, option.image)), option.image);
        assetPaths.add(option.image);
      }
    }
  }
});

test('diagonal directions and numbered controls use font-independent vectors', () => {
  const context = vm.createContext({});
  for (const filename of ['choice-layouts.js', 'grade-conditions.js', 'grade-5-6-keys.js']) {
    vm.runInContext(fs.readFileSync(path.join(dist, 'years', filename), 'utf8'), context);
  }
  const directions = context.KENGURU_CHOICE_LAYOUTS['2016-3-4/4'].options;
  const sequences = context.KENGURU_CHOICE_LAYOUTS['2017-5-6/13'].options;
  assert.match(directions[3].description, /вверх вправо/u);
  assert.match(directions[4].description, /вверх влево/u);
  assert.equal(sequences[1].description, 'Кнопка 1, затем 3, затем 2');
  for (const option of [...directions, ...sequences]) {
    const image = fs.readFileSync(path.join(dist, option.image), 'utf8');
    assert.match(image, /<path\b/u);
    assert.doesNotMatch(image, /<text\b|<image\b/u);
  }
  assert.match(context.KENGURU_GRADE_CONDITIONS[2017][13].question, /3 — удвоение/u);
  assert.match(context.KENGURU_GRADE_KEYS[2017][12][0], /1, 3, 2/u);
});
