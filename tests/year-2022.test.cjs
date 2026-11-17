const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const dist = path.resolve(__dirname, '..', 'dist');
const entry = path.join(dist, 'years', '2022.js');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(entry, 'utf8'), context, {filename: entry});
const archive = context.KENGURU_ARCHIVE[2022];
const {lessons, scenes} = archive;
const letter = (index) => 'АБВГД'[index];
const answer = (number) => lessons[number - 1].choices[lessons[number - 1].answer];

context.svg = (inside, label, box) => `<svg viewBox="${box}" role="img" aria-label="${label}">${inside}</svg>`;

test('2022 registers one official 3–4 grade booklet with 24 tasks and the published key', () => {
  assert.equal(archive.year, 2022);
  assert.equal(archive.id, '2022-3-4');
  assert.deepEqual([...archive.grades], [3, 4]);
  assert.equal(archive.label, '3–4 классы');
  assert.equal(lessons.length, 24);
  assert.equal(scenes.length, lessons.length);
  assert.deepEqual([...lessons.map(({number}) => number)], Array.from({length: 24}, (_, i) => i + 1));
  for (const [points, expected] of [[3, 'АБВАВДГВ'], [4, 'БАБДБДБД'], [5, 'БДГВБГВГ']]) {
    assert.equal(lessons.filter((lesson) => lesson.points === points).map(({answer}) => letter(answer)).join(''), expected);
  }
  for (const [kind, name] of [
    ['tasksUrl', 'class_3-4'], ['answersUrl', 'answers'], ['solutionUrl', 'solution']
  ]) {
    assert.equal(archive.sources[kind], `https://ipokengu.ru/public/task/kenguru_2022_${name}.pdf`);
  }
  for (const name of ['tasks', 'answers', 'solutions']) {
    const file = path.join(dist, '..', 'sources', '2022', name + '.pdf');
    assert.match(fs.readFileSync(file).subarray(0, 8).toString(), /^%PDF-/);
  }
});

test('all conditions, scenes and choice buttons resolve to accessible, local assets at fractional frames', () => {
  const files = new Set();
  for (const [index, lesson] of lessons.entries()) {
    const scene = scenes[index];
    assert.ok(lesson.question.length > 35);
    assert.ok(lesson.title && lesson.short && lesson.skill);
    assert.equal(lesson.choices.length, 5);
    assert.equal(new Set(lesson.choices).size, 5);
    assert.equal(lesson.steps[0][0], 'Решение');
    assert.equal(lesson.steps.length, 4);
    assert.ok(lesson.steps.every((step) => step.length === 3 && step.every(Boolean)));
    assert.equal(lesson.originalImage, `assets/years/2022/task-${index + 1}.png`);
    files.add(lesson.originalImage);
    for (const file of lesson.choiceImages || []) files.add(file);
    const first = scene(0, 0);
    assert.equal(scene(0, 2.167), first, `task ${index + 1} independent work stays static`);
    assert.notEqual(scene(3, 6.75), first, `task ${index + 1} has a distinct final scene`);
    for (const step of [0, 1, 2, 3]) {
      for (const frame of [0, .125, 1.73, 3.99, 6.75, 30]) {
        const result = scene(step, frame);
        assert.match(result, /^(<svg |<figure )/);
        assert.match(result, /(?:aria-label|alt)="[^"]+"/);
        assert.doesNotMatch(result, /NaN|Infinity|undefined/);
        for (const [, file] of result.matchAll(/(?:src|href)="(assets\/years\/2022\/[^"]+)"/g)) files.add(file);
      }
    }
  }
  assert.equal(files.size, 49);
  for (const file of files) {
    assert.match(file, /^assets\/years\/2022\/(task-\d+|figure-\d+|choice-\d+-\d+)\.png$/);
    const image = fs.readFileSync(path.join(dist, file));
    assert.equal(image.readUInt32BE(0), 0x89504e47, file);
    assert.ok(image.readUInt32BE(16) > 50 && image.readUInt32BE(20) > 50, file);
  }
});

test('the initial stage preserves unknowns and omits solution emphasis', () => {
  for (const number of [14, 19, 21, 23]) {
    assert.doesNotMatch(scenes[number - 1](0, 0), /<text|<image|<circle/);
  }
  const coins = scenes[2](0, 0);
  assert.doesNotMatch(coins, /#d6ece3|>3<|>2</);
  assert.equal((scenes[15](0, 0).match(/>\?</g) || []).length, 4);
  const puzzle = scenes[6](0, 0);
  assert.equal((puzzle.match(/<text /g) || []).length, 32);
  assert.doesNotMatch(scenes[21](0, 0), /#237e79/);
  assert.notEqual(scenes[0](3, .65), scenes[0](3, 3.65));
  assert.notEqual(scenes[1](2, .65), scenes[1](2, 3.65));
  assert.notEqual(scenes[2](2, .65), scenes[2](2, 3.65));
  assert.notEqual(scenes[8](2, .65), scenes[8](2, 3.65));
  assert.notEqual(scenes[19](2, .65), scenes[19](2, 3.65));
});

const sum = (numbers) => numbers.reduce((total, n) => total + n, 0);
const indices = (count) => Array.from({length: count}, (_, index) => index);

test('bee, mirrors and coins resolve by following the printed grids', () => {
  const routes = lessons[0].choices.filter((route) =>
    [...route].filter((arrow) => arrow === '→').length === 3 &&
    [...route].filter((arrow) => arrow === '↓').length === 3);
  assert.deepEqual([...routes], [answer(1)]);
  const mirrors = [['\\','/','\\'], ['\\','/','/']];
  let x = -1;
  let y = 0;
  let dx = 1;
  let dy = 0;
  for (let i = 0; i < 9; i++) {
    x += dx;
    y += dy;
    const mirror = mirrors[y]?.[x];
    if (!mirror) break;
    [dx, dy] = mirror === '/' ? [-dy, -dx] : [dy, dx];
  }
  assert.equal(y, 2);
  assert.equal('ABC'[x], answer(2));
  const grid = ['A...o', '.o.o.', '..Do.', 'B....', 'C.E.o'].map((row) => [...row]);
  const solutions = [];
  for (const r of indices(5)) for (const c of indices(5)) {
    if (!/[A-E]/.test(grid[r][c])) continue;
    for (const i of indices(5)) for (const j of indices(5)) {
      if (grid[i][j] !== '.') continue;
      const copy = grid.map((row) => row.slice());
      copy[i][j] = copy[r][c];
      copy[r][c] = '.';
      const full = (row) => row.filter((value) => value !== '.').length === 2;
      if (copy.every(full) && indices(5).every((n) => full(copy.map((row) => row[n])))) {
        solutions.push([copy[i][j], i + 1, j + 1]);
      }
    }
  }
  assert.deepEqual(solutions, [[answer(3), 4, 2]]);
});

test('equality, required boxes and jumping circles match the stated options', () => {
  const equal = lessons[3].choices.filter((choice) => {
    const [a, b] = choice.split(' и ').map(Number);
    return 2022 + a === 2020 + b;
  });
  assert.deepEqual([...equal], [answer(4)]);
  const above = {
    игрушки: ['одежда', 'бельё'],
    одежда: ['книги', 'ноты'],
    бельё: ['ноты', 'игры']
  };
  const moved = new Set();
  const clear = (box) => {
    for (const neighbor of above[box] || []) {
      moved.add(neighbor);
      clear(neighbor);
    }
  };
  clear('игрушки');
  assert.equal(moved.size, Number(answer(5)));
  let position = 0;
  let jumps = 0;
  while (position < 16) position += [2,1,1][jumps++ % 3];
  assert.equal(position, 16);
  assert.equal(jumps, Number(answer(6)));
});

test('every puzzle piece is tested against all edge neighbors and only Г fits', () => {
  const board = [[3,2,5,4,2,1], [1,4,3,1,3,4], [2,5,0,5,2,1], [4,1,0,0,0,3], [3,2,4,2,5,2], [4,1,3,1,3,4]];
  const slots = [[2,2], [3,2], [3,3], [3,4]];
  const pieces = [[4,1,2,3], [1,3,4,2], [2,4,1,3], [2,3,1,4], [3,2,1,4]];
  const neighbors = [[0,1], [0,-1], [1,0], [-1,0]];
  const fitting = [];
  for (const [index, piece] of pieces.entries()) {
    const cells = board.map((row) => row.slice());
    slots.forEach(([row, col], i) => { cells[row][col] = piece[i]; });
    if (slots.every(([row, col]) => neighbors.every(([dr, dc]) =>
      cells[row][col] !== cells[row + dr]?.[col + dc]))) fitting.push(index);
  }
  assert.deepEqual(fitting, [lessons[6].answer]);
  assert.equal(lessons[7].answer, 2);
  assert.match(scenes[7](3, 0), /Основание, площадка и столбик/);
});

test('car overtakings and postcard assignment agree with the selected options', () => {
  const cars = [1,2,3,4,5];
  for (const position of [4,3,2]) {
    const [car] = cars.splice(position, 1);
    cars.splice(position - 2, 0, car);
  }
  assert.equal(cars.join(', '), answer(9));
  const cards = [
    {sun: true, creatures: 0},
    {kangaroo: true, creatures: 2},
    {creatures: 2},
    {duck: true, sun: true, creatures: 5},
    {dog: true, creatures: 1}
  ];
  const clues = [(card) => !card.duck, (card) => card.sun,
    (card) => card.creatures === 2, (card) => card.dog, (card) => card.kangaroo];
  const candidates = (person, left) => {
    if (person === clues.length) return [[]];
    return left.filter((id) => clues[person](cards[id])).flatMap((id) =>
      candidates(person + 1, left.filter((other) => other !== id)).map((tail) => [id, ...tail]));
  };
  const solutions = candidates(0, indices(5));
  assert.deepEqual(solutions, [[lessons[9].answer, 3, 2, 4, 1]]);
});

test('square correction, carpet border and reflected holes satisfy all constraints', () => {
  const square = [[9,1,5], [3,7,6], [4,7,4]];
  const changes = [];
  for (const r of indices(3)) for (const c of indices(3)) {
    for (const replacement of indices(10)) {
      const changed = square.map((row) => row.slice());
      changed[r][c] = replacement;
      const totals = changed.map(sum).concat(indices(3).map((j) => sum(changed.map((row) => row[j]))));
      if (new Set(totals).size === 1) changes.push([square[r][c], replacement]);
    }
  }
  assert.deepEqual(changes, [[Number(answer(11)), 2]]);
  let dots = 0;
  for (const r of indices(6)) for (const c of indices(6)) {
    if (Math.min(r, c, 5-r, 5-c) < 2) dots++;
  }
  assert.equal(dots, Number(answer(12)));
  const holes = [2,3].flatMap((r) => [1,4].map((c) => r * 6 + c + 1));
  assert.equal(holes.join(', '), answer(13));
  assert.equal((2 + 1 + 1) * (3 + 1 + 5), Number(answer(14)));
});

test('cube pieces reproduce all three printed faces and leave 11 unit positions', () => {
  const faces = {
    top: ['DWL', 'WWL', 'LWL'],
    front: ['DWL', 'DDL', 'DWL'],
    right: ['LLL', 'LWW', 'LWL']
  };
  const visible = new Map();
  for (const a of indices(3)) for (const b of indices(3)) {
    visible.set([a,b,0].join(','), faces.top[b][a]);
    visible.set([a,0,b].join(','), faces.front[b][a]);
    visible.set([2,a,b].join(','), faces.right[b][a]);
  }
  const placements = {D: new Map(), L: new Map()};
  const record = (kind, cells) => {
    if (cells.every((xyz) => xyz.every((n) => n >= 0 && n < 3))) {
      const keys = cells.map((xyz) => xyz.join(',')).sort();
      if (keys.every((key) => !visible.has(key) || visible.get(key) === kind)) {
        placements[kind].set(keys.join(' '), keys);
      }
    }
  };
  const offset = (pos, axis, amount) => pos.map((n, i) => n + (i === axis ? amount : 0));
  for (const x of indices(3)) for (const y of indices(3)) for (const z of indices(3)) {
    const start = [x,y,z];
    for (const a of indices(3)) {
      record('D', [start, offset(start, a, 1), offset(start, a, 2)]);
      for (const b of indices(3).slice(a+1)) for (const da of [-1,1]) for (const db of [-1,1]) {
        record('L', [start, offset(start,a,da), offset(start,a,da*2), offset(start,b,db), offset(start,b,db*2)]);
      }
    }
  }
  const required = [...visible].filter(([,kind]) => kind !== 'W');
  const pack = (filled, parts) => {
    const needed = required.find(([key]) => !filled.has(key));
    if (!needed) return [{filled, parts}];
    const [position, kind] = needed;
    return [...placements[kind].values()].filter((piece) =>
      piece.includes(position) && piece.every((key) => !filled.has(key))).flatMap((piece) =>
      pack(new Set([...filled, ...piece]), [...parts, piece]));
  };
  const solutions = pack(new Set(), []);
  assert.equal(solutions.length, 1);
  assert.deepEqual(solutions[0].parts.map((piece) => piece.length).sort(), [3,3,5,5]);
  assert.equal(27 - solutions[0].filled.size, Number(answer(15)));
  for (const [letter, size] of [['А',3], ['Б',3], ['В',5], ['Г',5]]) {
    assert.equal([...scenes[14](2, 0).matchAll(new RegExp('>' + letter + '<', 'g'))].length, size);
  }
});

test('all valid sums under the ink and the minimum shapes have the published values', () => {
  const hiddenSums = new Set();
  for (let a = 100; a < 572; a++) {
    const b = 572 - a;
    if (b < 100 || b % 100 !== 63) continue;
    hiddenSums.add(sum([...String(a), String(b)[0]].map(Number)));
  }
  assert.deepEqual([...hiddenSums], [Number(answer(16))]);
  const shapeKinds = ['','LC','C','L','LR','RC'];
  const feasible = [];
  for (const mask of indices(2 ** shapeKinds.length)) {
    const subset = shapeKinds.filter((_, i) => mask & (1 << i));
    if ([...'LCR'].every((required) => subset.filter((kind) => kind.includes(required)).length === 2)) {
      feasible.push(subset.length);
    }
  }
  assert.equal(Math.min(...feasible), Number(answer(17)));
});

test('hexagonal roads admit options 1 and 5 under cyclic rotation', () => {
  const pieces = [[0,1,4,5], [3,4,5], [0,2,4], [0,2,3,5], [1,3,4,5]];
  const valid = pieces.flatMap((piece, index) => {
    const connects = indices(6).some((rotation) => {
      const exits = piece.map((exit) => (exit + rotation) % 6);
      return [0,1,4].every((house) => exits.includes(house)) && !exits.includes(3);
    });
    return connects ? [index + 1] : [];
  });
  assert.equal(valid.join(' и '), answer(18));
});

test('football, park loops and plum differences produce the stated answers', () => {
  const possible = new Set([0,1,3].flatMap((a) => [0,1,3].map((b) => a + b)));
  assert.deepEqual([...lessons[18].choices.filter((value) => !possible.has(Number(value)))], [answer(19)]);
  let distance = 20;
  while (distance % 30 !== 0) distance += 20;
  assert.equal(distance / 20, Number(answer(20)));
  const sofia = 10;
  const lisa = sofia + 2;
  const borya = lisa - 3;
  const kolya = borya + 1;
  const alice = kolya + 3;
  const amounts = {'София': sofia, 'Лиза': lisa, 'Боря': borya, 'Коля': kolya, 'Алиса': alice};
  assert.deepEqual([...lessons[20].choices.filter((pair) => {
    const [a,b] = pair.split(' и ');
    return amounts[a] === amounts[b];
  })], [answer(21)]);
});

test('colored sums, pizza and the uniquely partitioned bags finish the 5-point tier', () => {
  const pairs = (34 + 26) / 3;
  assert.equal(32 - pairs, Number(answer(22)));
  assert.equal(5 - (12 - 3 - 7), Number(answer(23)));
  const bags = [1,2,3,4,5,6,9,13,17];
  const target = sum(bags) / 3;
  const solutions = [];
  const triples = (values) => values.flatMap((a,i) => values.slice(i+1).flatMap((b,j) =>
    values.slice(i+j+2).map((c) => [a,b,c]))).filter((triple) => sum(triple) === target);
  for (const first of triples(bags).filter((group) => group.includes(17))) {
    const rest = bags.filter((weight) => !first.includes(weight));
    for (const second of triples(rest).filter((group) => group.includes(13))) {
      solutions.push([first, second, rest.filter((weight) => !second.includes(weight))]);
    }
  }
  assert.deepEqual(solutions, [[[1,2,17], [3,4,13], [5,6,9]]]);
  assert.equal(lessons[23].choices.filter((choice) =>
    solutions[0].find((group) => group.includes(6)).includes(Number(choice.split(' ')[0]))).join(), answer(24));
});
