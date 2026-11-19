'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const dist = path.join(__dirname, '..', 'dist');
const context = vm.createContext({});
for (const file of ['lesson-visuals.js', 'years/grade-solution-steps.js']) {
  vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), context, {filename: file});
}

const scene = text => context.KenguruVisual.workedScene({text}, 12);
function label(text) {
  return scene(text).match(/aria-label="([^"]+)"/u)?.[1] ?? '';
}

test('the calculation scene preserves complete mathematical expressions and signs', () => {
  const samples = [
    ['Сумма равна 13 700 + 137 = 13 837.', '13 700 + 137 = 13 837'],
    ['Результат −1 + 1012 = 1011.', '−1 + 1012 = 1011'],
    ['Поэтому x²/2 = 1.', 'x²/2 = 1'],
    ['Значит, 6 × 6 × 6 × 6 = 6⁴.', '6 × 6 × 6 × 6 = 6⁴'],
    ['2025 = 45². В этот момент получился квадрат.', '2025 = 45²'],
    ['Угол равен (180° − 40°) : 2 = 70°.', '(180° − 40°) : 2 = 70°'],
    ['Для 3/2 стакана риса нужно (3/2) · (3/2) = 9/4 = 2 1/4 стакана воды.', '(3/2) · (3/2) = 9/4 = 2 1/4'],
    ['Сумма равна 3 · 4π/6 = 2π см.', '3 · 4π/6 = 2π'],
    ['Поэтому x : 12 = 9 : 18 и x = 6.', 'x : 12 = 9 : 18. x = 6'],
  ];
  for (const [wording, expected] of samples) {
    assert.equal(label(wording), expected, wording);
    assert.ok(scene(wording).includes(expected.split('. ')[0]), wording);
  }
});

test('prose and separate equations remain separate in worked scenes', () => {
  assert.equal(label('Чтобы получить последнюю цифру 2, нужно прибавить 5: 7 + 5 = 12.'), '7 + 5 = 12');
  assert.equal(label('В 19:59 получится 10 + 14 = 24.'), '10 + 14 = 24');
  assert.equal(label('Если бы все сказали правду, сумма была бы 1 + 2 + … + 10 = 55.'), '1 + 2 + … + 10 = 55');
  assert.equal(label('25 – 21 = 4 – в стольких домах живут 4 человека.'), '25 – 21 = 4');
  assert.equal(label('2 + 1 = 3\n4 + 2 = 6'), '2 + 1 = 3. 4 + 2 = 6');

  const solutions = context.KENGURU_GRADE_SOLUTION_STEPS;
  assert.equal(label(solutions[2023][26].steps[1].text),
    '1 · 10 + 5 · 4 = 30. 1 · 10 + 3 · 4 + 1 = 23. 8 · 4 + 6 · 3/2 = 41');
  assert.equal(label(solutions[2025][30].steps[3].text),
    '1 · 30 + 5 · 40 = 230. 1 · 30 + 4 · 50 = 230. 2 · 30 + 3 · 40 + 1 · 50 = 230');
});

test('an unsupported or incomplete expression never yields a smaller calculation', () => {
  for (const wording of [
    'Остаётся 7 + 3 = 1 + нижний левый кружок.',
    'Выражение задано в виде 2 ± 1 = 3.',
    'Условие x_1 + 2 = 4.',
    'Предложено 6 = 3!',
    '1 · 30 + 5 · 40 = 230 1 · 30 + 4 · 50 = 230',
  ]) {
    assert.equal(scene(wording), '', wording);
  }
});
