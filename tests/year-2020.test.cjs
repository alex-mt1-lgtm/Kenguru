'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.resolve(__dirname, '../dist');
const source = fs.readFileSync(path.join(dist, 'years/2020.js'), 'utf8');
const context = vm.createContext();
vm.runInContext(source, context);
context.svg = (body, label, box) => `<svg viewBox="${box}" role="img" aria-label="${label}">${body}</svg>`;
const archive = context.KENGURU_ARCHIVE[2020];
const snapshot = value => JSON.parse(JSON.stringify(value));
const frames = [0, .01, .25, .9, 1.45, 2.25, 4.75, 7.125, 13.25];

function checkImage(file) {
  const bytes = fs.readFileSync(path.join(dist, file));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(bytes.readUInt32BE(16) >= 60);
  assert.ok(bytes.readUInt32BE(20) >= 60);
}

test('2020 archive uses the joint 3–4 grade booklet and all 26 official answers', () => {
  assert.equal(archive.year, 2020);
  assert.equal(archive.id, '2020-3-4');
  assert.deepEqual(snapshot(archive.grades), [3, 4]);
  assert.deepEqual(snapshot(archive.sources), {
    tasksUrl: 'https://ipokengu.ru/public/task/kenguru_2020_class_3-4.pdf',
    answersUrl: 'https://ipokengu.ru/public/task/kenguru_2020_answers.pdf',
    solutionUrl: null,
  });
  assert.equal(archive.lessons.length, 26);
  assert.equal(archive.scenes.length, 26);
  assert.equal(archive.lessons.map(lesson => 'АБВГД'[lesson.answer]).join(''), 'ДДГВГАДДВБВББВГГВААГББАДВГ');
  assert.doesNotMatch(source, /догад/iu);
  archive.lessons.forEach((lesson, i) => {
    assert.equal(lesson.number, i + 1);
    assert.equal(lesson.points, i < 10 ? 3 : i < 20 ? 4 : 5);
    assert.equal(lesson.choices.length, 5);
    assert.equal(lesson.steps[0][0], 'Твоё решение');
    assert.ok(lesson.steps.length >= 3);
    assert.ok(lesson.steps.every(step => step.length === 3 && step.every(field => typeof field === 'string' && field.length > 0)));
  });
});

test('originals, all graphical options and every fractional frame are usable', () => {
  for (const [i, lesson] of archive.lessons.entries()) {
    checkImage(lesson.originalImage);
    if (lesson.choiceImages) {
      assert.equal(lesson.choiceImages.length, 5);
      lesson.choiceImages.forEach(checkImage);
    }
    for (const [step] of lesson.steps.entries()) {
      for (const frame of frames) {
        const markup = archive.scenes[i](step, frame);
        assert.match(markup, /^<svg [^>]+aria-label="[^"]+">.+<\/svg>$/u);
        assert.doesNotMatch(markup, /NaN|undefined/);
        for (const [, file] of markup.matchAll(/\bhref="([^"]+\.png)"/g)) checkImage(file);
      }
    }
  }
});

test('the independent stage never animates into a solved state or reveals the first move', () => {
  const firstStages = archive.scenes.map(scene => scene(0, 0));
  assert.ok(archive.scenes.every((scene, i) => scene(0, 7.125) === firstStages[i]));
  assert.match(firstStages[0], /19□3/);
  assert.doesNotMatch(firstStages[0], /1993/);
  assert.doesNotMatch(firstStages[4], /Дырок при раскрытии/);
  assert.doesNotMatch(firstStages[5], /= 20|= 21/);
  assert.doesNotMatch(firstStages[13], /map-\d\.png/);
  assert.doesNotMatch(firstStages[15], /<polyline|19 \+ 3/);
  assert.doesNotMatch(firstStages[16], /Перекатов|7 − 3/);
  assert.doesNotMatch(firstStages[18], /Замкнутое кольцо/);
  assert.doesNotMatch(firstStages[23], /Жёлтого круга нет/);
  assert.doesNotMatch(firstStages[24], /одинаковые/);
  assert.doesNotMatch(firstStages[25], /942|986|1064/);
});

test('1, 4, 6, 7 and 10: the written conditions isolate the keyed choices', () => {
  const candidates = task => Array.from(archive.lessons[task - 1].choices);
  assert.deepEqual(candidates(1).filter(v => 27 + Number('19' + v + '3') === 2020), ['9']);
  assert.deepEqual(candidates(4).filter(n => +n[0] - 5 === +n[1] && +n[1] === 2 * +n[2]), ['721']);
  assert.deepEqual([16 + 4, 28 - 8, 2 * 10, 7 * 3].map(n => n === 20), [true, true, true, false]);
  assert.deepEqual(candidates(7).filter(n => n[1] === n[4] && new Set(n).size === 4), ['87647']);
  const unshaded = [4 / 2, 3 / 2, 1 + 2 / 2, 1 + 2 / 2, 2];
  assert.equal(unshaded.indexOf(Math.min(...unshaded)), archive.lessons[9].answer);
});

test('12: paths around both house corners give exactly five reachable bones', () => {
  const distance = Array.from({length: 8}, (_, x) => Math.min(6 + 5 + x, 1 + 5 + (7 - x)));
  assert.deepEqual(distance, [11, 12, 11, 10, 9, 8, 7, 6]);
  assert.equal(distance.filter(v => v <= 10).length, 5);
  assert.match(archive.scenes[11](2, 8), /Справа доступны пять/);
});

test('14: both proper three-colorings leave the same three regions red', () => {
  // Regions ordered from the center outward, alternating the upper and lower neighbors.
  const borders = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [3, 5], [4, 5], [4, 6], [5, 6]];
  const solutions = [];
  for (let n = 0; n < 3 ** 6; n++) {
    const colors = [0, ...n.toString(3).padStart(6, '0').split('').map(Number)];
    if (borders.every(([a, b]) => colors[a] !== colors[b])) solutions.push(colors);
  }
  assert.equal(solutions.length, 2);
  assert.ok(solutions.every(colors => colors.map((color, i) => !color ? i : -1).filter(i => i >= 0).join() === '0,3,6'));
  assert.match(archive.scenes[13](3, 8), /map-3\.png/);
});

test('15 and 16: searching increasing years and reachable cells matches the result', () => {
  const sumOfDigits = n => [...String(n)].reduce((sum, digit) => sum + Number(digit), 0);
  const year = Array.from({length: 110}, (_, i) => 2021 + i).find(n => sumOfDigits(n) === 4);
  assert.equal(year - 2020, 81);
  const cells = [1, 5, 8, 11, 4, 7, 10, 14, 24, 23, 13, 18, 21, 19, 16, 20];
  const seen = new Set([1]);
  for (const cell of seen) cells.filter(dest => Math.abs(dest - cell) === 3).forEach(dest => seen.add(dest));
  assert.deepEqual([...seen], [1, 4, 7, 10, 13, 16, 19]);
  assert.match(archive.scenes[15](2, 8), /1, 4, 7, 10, 13, 16, 19/);
});

test('17 and 19: a five-cell roll and both knots yield the depicted arrangements', () => {
  let [top, right, bottom, left] = [1, 3, 6, 4];
  const tops = [top];
  for (let i = 0; i < 5; i++) {
    [top, right, bottom, left] = [left, top, right, bottom];
    tops.push(top);
  }
  assert.deepEqual(tops, [1, 4, 6, 3, 1, 4]);
  assert.match(archive.scenes[16](2, 8), /1, 4, 6, 3, 1, 4/);
  const originalRopes = [['A', 'D'], ['B', 'C'], ['X', 'Y']];
  const knots = [['A', 'B'], ['C', 'D']];
  const ring = ['A', 'B', 'C', 'D', 'A'];
  const links = originalRopes.concat(knots);
  assert.ok(ring.slice(1).every((v, i) => links.some(link => link.includes(v) && link.includes(ring[i]))));
  assert.ok(knots.every(knot => !knot.some(end => originalRopes[2].includes(end))));
});

test('20–22: time, calendar and team bounds checked by exhaustive enumeration', () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute++) {
      const time = [hour, minute].map(v => String(v).padStart(2, '0')).join(':');
      if (time.replace(':', '').split('').sort().join('') === '0022') times.push(time);
    }
  }
  assert.deepEqual(times, ['00:22', '02:02', '02:20', '20:02', '20:20', '22:00']);
  for (const time of times) assert.ok(archive.scenes[19](2, 8).includes(time));
  const dates = Array.from({length: 7}, (_, i) => i + 15);
  assert.deepEqual([14, 15, 20, 21, 22, 27].filter(date => dates.includes(date)), [15, 20, 21]);
  const teams = [];
  for (let five = 0; five <= 8; five++) {
    for (let six = 0; six <= 7; six++) if (5 * five + 6 * six === 43) teams.push([five, six]);
  }
  assert.deepEqual(teams, [[5, 3]]);
});

test('23 and 24: the target cells and the lack of a yellow circle are forced', () => {
  const pairs = new Set();
  for (let common = 15; common <= 35; common++) {
    const bottomGray = 2 + 8 - 7;
    const topGray = 6 + bottomGray - 2;
    const rows = [[common - 2 - topGray, 2, topGray], [6, 8, common - 14], [bottomGray, common - 10, 7]];
    assert.ok(rows.every(row => row.reduce((a, b) => a + b) === common));
    assert.ok(rows[0].every((_, i) => rows.reduce((sum, row) => sum + row[i], 0) === common));
    pairs.add([topGray, bottomGray].join());
  }
  assert.deepEqual([...pairs], ['7,3']);
  const fits = [];
  for (const a of 'RYG') for (const b of 'RYG') for (const c of 'RYG') {
    if (a === b) continue;
    if (['R', 'Y', 'G', a, b, c].sort().join('') === 'GRRRYY') fits.push(c);
  }
  assert.deepEqual(fits, ['R', 'R']);
});

function coordinates(diagram) {
  return diagram.split('/').flatMap((row, y) =>
    Array.from(row, (cell, x) => cell !== '.' ? {x, y, cell} : null).filter(Boolean));
}

function connected(cells) {
  const reached = new Set([cells[0]]);
  for (const a of reached) {
    for (const b of cells) if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) reached.add(b);
  }
  return reached.size === cells.length;
}

function canonical(cells) {
  const transforms = [];
  for (const swap of [false, true]) for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const shape = cells.map(({x, y}) => [a * (swap ? y : x), b * (swap ? x : y)]);
    const minX = Math.min(...shape.map(([x]) => x));
    const minY = Math.min(...shape.map(([, y]) => y));
    transforms.push(shape.map(([x, y]) => `${x - minX},${y - minY}`).sort().join(';'));
  }
  return transforms.sort()[0];
}

test('25: exhaustive connected five-cell cuts prove that only key В fails', () => {
  const diagrams = [
    '###/#.#/###/.#./.#./.#./.#./###',
    '###./#.##/###./.#../.##./##../.#..',
    '####./.#.#./.####/..#../..#../.##../..#..',
    '..#/###/#.#/###/.#./.#./###/.#.',
    '.###/.#.#/####/..#./..##/.##./..#.',
  ];
  const totals = diagrams.map(diagram => {
    const cells = coordinates(diagram);
    assert.equal(cells.length, 15);
    const pieces = [];
    for (let mask = 0; mask < 1 << cells.length; mask++) {
      const selected = cells.filter((_, i) => mask & (1 << i));
      if (selected.length === 5 && connected(selected)) pieces.push({mask, shape: canonical(selected)});
    }
    const byMask = new Map(pieces.map(piece => [piece.mask, piece]));
    let partitions = 0;
    let distinct = 0;
    for (const a of pieces) {
      if (!(a.mask & 1)) continue;
      for (const b of pieces) {
        if (a.mask & b.mask) continue;
        const c = byMask.get(((1 << 15) - 1) ^ a.mask ^ b.mask);
        if (!c || b.mask > c.mask) continue;
        partitions++;
        if (new Set([a.shape, b.shape, c.shape]).size === 3) distinct++;
      }
    }
    return [partitions, distinct];
  });
  assert.deepEqual(totals, [[3, 2], [3, 1], [4, 0], [3, 3], [3, 2]]);
  const final = archive.scenes[24](3, 8);
  assert.equal((final.match(/2 одинаковые/g) ?? []).length, 3);
  assert.equal((final.match(/3 одинаковые/g) ?? []).length, 1);
});

test('26: the maximum is unique among every possible assignment', () => {
  let best = -Infinity;
  let assignments = [];
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  function visit(used) {
    if (used.length < 6) {
      for (const digit of digits) if (!used.includes(digit)) visit([...used, digit]);
      return;
    }
    const [k, a, n, g, r, o] = used;
    const value = (100 * k + 10 * a + n) + (10 * g + a) - (100 * r + 11 * o);
    if (value > best) {
      best = value;
      assignments = [used];
    } else if (value === best) {
      assignments.push(used);
    }
  }
  visit([]);
  assert.equal(best, 942);
  assert.deepEqual(assignments, [[9, 8, 6, 7, 1, 2]]);
  assert.match(archive.scenes[25](3, 8), /1064 − 122 = 942/);
});
