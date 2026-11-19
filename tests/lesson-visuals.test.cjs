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

function solutionStep(grades, year, number, step) {
  const file = path.join(__dirname, '..', 'sources', `grades-${grades}`, String(year), 'solutions.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'))[number].steps[step - 1].text;
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

test('symbolic relations in assumptions and alternative cases stay with their qualifiers', () => {
  assert.equal(label(solutionStep('9-10', 2021, 12, 1)), '');
  assert.equal(label(solutionStep('9-10', 2021, 12, 2)), '9 + 15 = 24. 9 + 17 + 19 = 45');
  assert.equal(label(solutionStep('9-11', 2023, 16, 1)), '');
  assert.equal(label(solutionStep('9-11', 2023, 16, 2)), '2x + y = 6y. x = 2,5y');
  assert.equal(label(solutionStep('9-11', 2023, 24, 2)), '');
  assert.equal(label(solutionStep('9-11', 2023, 24, 3)), '');
  assert.equal(label(solutionStep('9-11', 2023, 26, 2)), '');
  assert.equal(label(solutionStep('9-11', 2026, 23, 1)), '2026 = 2 · 1013');
  assert.equal(label(solutionStep('9-11', 2026, 23, 2)), '');
  assert.equal(label(solutionStep('9-11', 2026, 23, 3)), '2048 − 22 = 2026. a + b = 13');
  assert.equal(label(solutionStep('7-8', 2026, 20, 1)), 'A &gt; 0. C &gt; A');
  assert.equal(label(solutionStep('7-8', 2026, 20, 3)), 'B + 7 = 13. B = 6. 367 + 376 = 743');
  assert.doesNotMatch(label(solutionStep('7-8', 2026, 29, 1)), /∠BAD \+ ∠ADC = 180°/u);
  assert.equal(label(solutionStep('9-11', 2025, 21, 2)), 'x² − 27x + 162 = 0. (x − 9)(x − 18) = 0. x = 9');
  assert.equal(label('Подходят k = 5, 7 и 9. Пусть k = 5. Итак, k = 7.'), 'k = 7');
});

test('tiling proofs include separate marked diagrams and the published construction', () => {
  const stages = context.KENGURU_GRADE_SOLUTION_STEPS[2025];
  const trimino = stages[23].steps;
  assert.equal(trimino.length, 4);
  assert.match(trimino[0].text, /верхней левой клетки не останется свободных соседей/u);
  assert.match(trimino[2].text, /в одной детали находится E/u);
  assert.match(trimino[3].image, /task-23-1\.svg$/u);
  const cross = stages[25].steps;
  assert.equal(cross.length, 3);
  assert.match(context.KenguruVisual.workedScene(cross[0], 12), /Отмечены восемь острых углов/u);
  assert.match(label(cross[1].text), /17 − 8 = 9/u);
  assert.match(cross[2].image, /task-25-1\.svg$/u);
  for (const stage of [...trimino, ...cross]) {
    if (stage.image) assert.ok(fs.existsSync(path.join(dist, stage.image)), stage.image);
  }
});
