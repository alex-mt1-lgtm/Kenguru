'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.resolve(__dirname, '../dist');
const script = fs.readFileSync(path.join(dist, 'years/2021.js'), 'utf8');
const context = vm.createContext({});
const run = code => vm.runInContext(code, context);
run(script);
run('const svg = (body, label, box = "0 0 640 300") => "<svg viewBox=\\"" + box + "\\" role=\\"img\\" aria-label=\\"" + label + "\\">" + body + "</svg>";');
const get = expression => JSON.parse(run('JSON.stringify(' + expression + ')'));
const lessons = get('KENGURU_ARCHIVE[2021].lessons');
const add = (a, b) => a + b;

function imageExists(src) {
  assert.match(src, /^assets\/years\/2021\/[a-z0-9-]+\.png$/);
  const bytes = fs.readFileSync(path.join(dist, src));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(bytes.readUInt32BE(16) >= 75 && bytes.readUInt32BE(20) >= 60, src);
}

test('2021 registers the joint group and all eighteen official answers', () => {
  assert.equal(run('KENGURU_ARCHIVE[2021].id'), '2021-3-4');
  assert.deepEqual(get('KENGURU_ARCHIVE[2021].grades'), [3, 4]);
  assert.equal(lessons.length, 18);
  assert.equal(lessons.map(lesson => 'АБВГД'[lesson.answer]).join(''), 'ВВББДВАДДВГБГГАГДГ');
  assert.deepEqual(lessons.map(lesson => lesson.points), [3, 4, 5].flatMap(points => Array(6).fill(points)));
  assert.deepEqual(lessons[1].choices, ['3', '3', '6', '7', '8']);
  assert.match(run('KENGURU_ARCHIVE[2021].sources.solutionUrl'), /kenguru_2021_solution\.pdf$/);
  assert.doesNotMatch(script, /догад/iu);
});

test('all 72 scenes render at zero and fractional frames using valid local visual assets', () => {
  assert.equal(run('KENGURU_ARCHIVE[2021].scenes.length'), 18);
  for (const [i, lesson] of lessons.entries()) {
    assert.equal(lesson.number, i + 1);
    assert.equal(lesson.choices.length, 5);
    assert.ok(lesson.short && lesson.title && lesson.skill && lesson.question);
    imageExists(lesson.originalImage);
    lesson.choiceImages?.forEach(imageExists);
    if (lesson.choiceImages) assert.equal(lesson.choiceImages.length, 5);
    assert.equal(lesson.steps.length, 4);
    for (const [step, content] of lesson.steps.entries()) {
      assert.equal(content.length, 3);
      assert.ok(content.every(value => typeof value === 'string' && value.trim().length > 0));
      for (const frame of [0, .01, .125, .65, 1.3, 2.8, 5.1, 10.5]) {
        const markup = run('KENGURU_ARCHIVE[2021].scenes[' + i + '](' + step + ',' + frame + ')');
        const drawings = markup.match(/<svg [^>]*aria-label="[^"]+"[^>]*>[\s\S]*?<\/svg>/g) || [];
        assert.equal(drawings.length, lesson.number === 5 ? 5 : 1, lesson.title);
        assert.doesNotMatch(markup, /NaN|undefined|Infinity/);
        for (const [, src] of markup.matchAll(/\bhref="([^"]+)"/g)) imageExists(src);
      }
    }
  }
});

test('step zero is stable and shows givens before the learner answers', () => {
  for (let i = 0; i < lessons.length; i++) {
    const scene = 'KENGURU_ARCHIVE[2021].scenes[' + i + ']';
    const initial = run(scene + '(0,0)');
    assert.equal(initial, run(scene + '(0,7.5)'), lessons[i].title);
    assert.notEqual(initial, run(scene + '(3,0)'), lessons[i].title);
    assert.doesNotMatch(initial, /aria-label="(?:Ответ|Подходит)|>✓</);
  }
  assert.doesNotMatch(run('y2021Puzzle(0,0)'), /13 \+ 2|15<\/text>/);
  assert.doesNotMatch(run('y2021NeighborSums(0,0)'), /9 − 2/);
  assert.doesNotMatch(run('y2021DigitArrows(0,0)'), />6<\/text>|7 → 8 → 9/);
  assert.doesNotMatch(run('y2021Targets(0,0)'), /target-score/);
  assert.match(run('y2021Targets(3,0)'), /target-best[\s\S]*9 \+ 8 \+ 9[\s\S]*<strong>26<\/strong>/);
});

test('1: exactly one drawing uses one white brick', () => {
  const layouts = [
    [[0, 1], [4, 5], [2, 6], [3, 7]],
    [[0, 2], [4, 6], [1, 3], [5, 7]],
    [[0, 4], [1, 5], [2, 3], [6, 7]],
    [[0, 4], [1, 5], [2, 3], [6, 7]],
    [[0, 2], [4, 6], [1, 3], [5, 7]]
  ];
  const whiteBricks = [[1, 3], [2, 3], [0], [0, 2], [0, 3]];
  assert.ok(layouts.every(layout => new Set(layout.flat()).size === 8));
  assert.deepEqual(whiteBricks.map(bricks => bricks.length), [2, 2, 1, 2, 2]);
  assert.equal(whiteBricks.findIndex(bricks => bricks.length === 1), lessons[0].answer);
  assert.match(run('y2021Cube(3,0)'), /В · 1/);
});

test('2: following the continuous line reaches six fish tail first', () => {
  const fish = get('Y2021_FISH');
  assert.equal(fish.length, 10);
  assert.deepEqual(fish.flatMap(([, , toward], index) => toward ? [index + 1] : []), [1, 3, 4, 5, 8, 10]);
  assert.equal(fish.filter(item => item[2]).length, Number(lessons[1].choices[lessons[1].answer]));
  assert.equal((run('y2021Fish(3,0)').match(/>\+<\/text>/g) || []).length, 6);
});

test('3–4: the puzzle gives 15 and the sun contains the four rays from option Б', () => {
  const pieces = [
    {label: '3', left: 'in', right: 'in'}, {label: '2', left: 'in', right: 'flat'},
    {label: '1', left: 'flat', right: 'out'}, {label: '+', left: 'out', right: 'out'}
  ];
  const ordered = [pieces.find(piece => piece.left === 'flat')];
  while (ordered.length < pieces.length) {
    const next = pieces.filter(piece => !ordered.includes(piece) && piece.left !== 'flat'
      && piece.left !== ordered.at(-1).right && (piece.right !== 'flat' || ordered.length === pieces.length - 1));
    assert.equal(next.length, 1);
    ordered.push(next[0]);
  }
  assert.equal(ordered.map(piece => piece.label).join(''), '13+2');
  assert.equal(13 + 2, Number(lessons[2].choices[lessons[2].answer]));
  const rays = 'llDDwLDwwwLDDLwDww';
  const windows = Array.from(rays, (_, i) => (rays + rays).slice(i, i + 4));
  assert.ok(windows.includes('DLwD'));
  assert.ok(!windows.includes('DwwD'));
  assert.equal(lessons[3].choices[lessons[3].answer], 'Фрагмент Б');
});

test('5: ring radii produce the unique maximum of 26', () => {
  const scores = get('Y2021_TARGET_HITS').map(hits => hits.map(([x, y, expected]) => {
    const r = Math.hypot(x, y);
    const score = r <= 15 ? 10 : r <= 25 ? 9 : r <= 35 ? 8 : 7;
    assert.equal(score, expected);
    return score;
  }).reduce(add));
  assert.deepEqual(scores, [25, 24, 24, 22, 26]);
  assert.equal(scores.indexOf(Math.max(...scores)), lessons[4].answer);
});

test('6: all three scale readings force the white ball to weigh five kilograms', () => {
  const candidates = [];
  for (let gray = 1; gray <= 10; gray++) {
    for (let black = 1; black <= 10; black++) {
      for (let white = 1; white <= 14; white++) {
        if (gray + black === 6 && 2 * white + gray === 14 && black + 2 * gray === 10) {
          candidates.push([gray, black, white]);
        }
      }
    }
  }
  assert.deepEqual(candidates, [[4, 2, 5]]);
  assert.equal(lessons[5].choices[lessons[5].answer], '5 кг');
});

test('7: testing every swap rules out only the first fruit deck', () => {
  const decks = get('Y2021_FRUITS');
  const grouped = row => new Set(row.filter((fruit, i) => i === 0 || fruit !== row[i - 1])).size === row.filter((fruit, i) => i === 0 || fruit !== row[i - 1]).length;
  const patterns = decks.map(deck => {
    const solutions = [];
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        const swap = get('y2021Swap(' + JSON.stringify(deck) + ',[' + i + ',' + j + '])');
        if (grouped(swap)) solutions.push([i, j]);
      }
    }
    return solutions;
  });
  assert.deepEqual(patterns.map(list => list.length > 0), [false, true, true, true, true]);
  for (const [index, pair] of get('Y2021_GOOD_SWAPS').entries()) {
    if (pair) assert.ok(patterns[index].some(solution => solution.join() === pair.join()));
  }
  assert.equal(patterns.findIndex(list => list.length === 0), lessons[6].answer);
});

test('8: one distinct shape from each box forces box four to supply the diamond', () => {
  const options = get('Y2021_BOX_SHAPES');
  const assignments = options.reduce((rows, choices) => rows.flatMap(row => choices.filter(shape => !row.includes(shape)).map(shape => [...row, shape])), [[]]);
  assert.deepEqual(assignments, [['star', 'triangle', 'circle', 'diamond', 'pentagon']]);
  assert.equal(lessons[7].choices[lessons[7].answer], 'Ромб');
});

test('9: gray cubes occupy every bottom cell except the front middle and front right', () => {
  const top = get('Y2021_TOP');
  const bottom = get('Y2021_BOTTOM');
  assert.equal(top.length + bottom.length, 18);
  assert.equal(top.filter(color => color === 'black').length, 7);
  assert.deepEqual(bottom, ['gray', 'gray', 'gray', 'gray', 'gray', 'gray', 'gray', 'white', 'white']);
  assert.equal([...top, ...bottom].filter(color => color === 'white').length, 4);
  assert.match(run('y2021CubeParts(3,0)'), /choice-9-4\.png/);
});

test('10–11: differences give the initial cash and the shortest ladder', () => {
  const unitPrice = (120 - 70) / (16 - 6);
  assert.equal(unitPrice, 5);
  const cash = 70 - unitPrice * 6;
  assert.equal(cash + unitPrice * 16, 120);
  assert.equal(cash, Number(lessons[9].choices[lessons[9].answer]));
  const landingGap = 48 - 36;
  assert.equal(32 - landingGap, Number(lessons[10].choices[lessons[10].answer]));
});

test('12: ten cup moves end downward, downward, upward', () => {
  assert.deepEqual(get('y2021CupOrder(0)'), [1, 2, 3]);
  assert.deepEqual(get('y2021CupOrder(3)'), [-1, -2, -3]);
  assert.deepEqual(get('y2021CupOrder(6)'), [1, 2, 3]);
  assert.deepEqual(get('y2021CupOrder(9)'), [-1, -2, -3]);
  assert.deepEqual(get('y2021CupOrder(10)'), [-2, -3, 1]);
  assert.match(run('y2021Cups(3,0)'), /После 10: вниз, вниз, вверх/);
});

function permutations(values) {
  if (!values.length) return [[]];
  return values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map(tail => [value, ...tail]));
}

test('13: both valid sticker arrangements put the flower fourth', () => {
  const valid = permutations(['star', 'circle', 'flower', 'triangle']).map(tail => ['apple', ...tail]).filter(items => {
    const index = items.indexOf('flower');
    return items[4] !== 'star' && [items[index - 1], items[index + 1]].sort().join() === 'circle,triangle';
  });
  assert.equal(valid.length, 2);
  assert.ok(valid.every(items => items.indexOf('flower') + 1 === Number(lessons[12].choices[lessons[12].answer])));
});

test('14: chaining the eight sums allows one ordering', () => {
  const sums = get('Y2021_SUMS');
  const solutions = Array.from({length: 9}, (_, i) => sums.reduce((cells, sum) => [...cells, sum - cells.at(-1)], [i + 1]))
    .filter(cells => cells.every(cell => cell >= 1 && cell <= 9) && new Set(cells).size === 9);
  assert.deepEqual(solutions, [get('Y2021_SUM_NUMBERS')]);
  assert.equal(solutions[0][4], Number(lessons[13].choices[lessons[13].answer]));
});

function subsets(values) {
  return values.reduce((sets, value) => sets.concat(sets.map(set => [...set, value])), [[]]);
}

test('15: the two ways to make 30 have exactly one balloon in common', () => {
  const ways = subsets(get('Y2021_BALLOONS')).filter(set => set.reduce(add, 0) === 30);
  assert.deepEqual(ways, [[3, 13, 14], [3, 9, 18]]);
  assert.deepEqual(ways[0].filter(value => ways[1].includes(value)), [Number(lessons[14].choices[lessons[14].answer])]);
});

test('16: only 36 satisfies every divisibility condition below 51', () => {
  const candidates = Array.from({length: 50}, (_, i) => i + 1)
    .filter(value => [2, 3, 4].every(divisor => value % divisor === 0));
  assert.deepEqual(candidates, get('Y2021_CHOCOLATES'));
  assert.deepEqual(candidates.filter(value => (value + 6) % 7 === 0), [Number(lessons[15].choices[lessons[15].answer])]);
});

test('17: the unique group of apple boxes is the first and fourth', () => {
  const weights = get('Y2021_BOX_WEIGHTS');
  const appleWeight = weights.reduce(add) / 4;
  assert.equal(appleWeight, 9);
  const boxes = subsets(weights.map((_, index) => index)).filter(set => set.reduce((weight, i) => weight + weights[i], 0) === appleWeight);
  assert.deepEqual(boxes, [[0, 3]]);
  assert.equal(boxes[0].map(index => index + 1).join(' и '), lessons[16].choices[lessons[16].answer]);
});

test('18: both arrow grids put 6 in the requested upper-right cell', () => {
  const edges = get('Y2021_DIGIT_EDGES');
  const possibilities = permutations([1, 2, 3, 4, 6, 8, 9]).map(cells => [...cells.slice(0, 3), 7, ...cells.slice(3, 5), 5, ...cells.slice(5)])
    .filter(cells => edges.every(([from, to]) => cells[from] < cells[to]));
  assert.equal(possibilities.length, 2);
  assert.ok(possibilities.every(cells => cells[2] === Number(lessons[17].choices[lessons[17].answer])));
  assert.ok(possibilities.some(cells => cells.join() === get('Y2021_DIGITS').join()));
});
