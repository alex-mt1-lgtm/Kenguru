'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', 'dist');
const context = vm.createContext({
  svg: (markup, label, viewBox = '0 0 640 300') =>
    `<svg viewBox="${viewBox}" role="img" aria-label="${label}">${markup}</svg>`,
});
const run = expression => vm.runInContext(expression, context);
const read = expression => JSON.parse(run(`JSON.stringify(${expression})`));
run(fs.readFileSync(path.join(root, 'years', '2026.js'), 'utf8'));
const pack = context.KENGURU_ARCHIVE[2026];

function assertPng(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file);
  assert.ok(bytes.readUInt32BE(16) > 30, file);
  assert.ok(bytes.readUInt32BE(20) > 30, file);
}

test('2026 has 24 lessons, official key, task crops and all referenced choice pictures', () => {
  assert.deepEqual(read('KENGURU_ARCHIVE[2026].grades'), [3, 4]);
  assert.equal(pack.lessons.length, 24);
  assert.equal(pack.scenes.length, 24);
  assert.equal(pack.lessons.map(item => 'АБВГД'[item.answer]).join(''), 'ДБДГАГАВБГДГБВГДВГАВДББА');
  pack.lessons.forEach((lesson, index) => {
    assert.equal(lesson.number, index + 1);
    assert.equal(lesson.points, 3 + Math.floor(index / 8));
    assert.equal(lesson.choices.length, 5);
    assert.ok(lesson.title && lesson.question && lesson.skill);
    assert.ok(lesson.steps.length >= 4);
    assert.ok(lesson.steps.every(step => step.length === 3 && step.every(Boolean)));
    assertPng(lesson.originalImage);
    if (lesson.choiceImages) {
      assert.equal(lesson.choiceImages.length, 5);
      lesson.choiceImages.forEach(assertPng);
    }
  });
});

test('each opening scene contains only the question and all fractional solution frames render', () => {
  pack.lessons.forEach((lesson,index) => {
    const renderer = pack.scenes[index];
    const original = renderer(0, 0);
    assert.match(original, /^<img [^>]+>$/);
    assert.ok(original.includes(lesson.originalImage));
    assert.equal(renderer(0, 3.2), original);
    for (let step = 1; step < lesson.steps.length; step++) {
      for (const frame of [0, .01, .27, .91, 1.35, 2.82, 4.68, 9.21, 12]) {
        const markup = renderer(step, frame);
        assert.match(markup, /^<svg [\s\S]*<\/svg>$/);
        assert.doesNotMatch(markup, /NaN|undefined|Infinity/);
        for (const match of markup.matchAll(/ href="([^"]+\.png)"/g)) assertPng(match[1]);
      }
    }
  });
  for (const task of [1, 2, 3, 4, 6, 8, 10, 11, 12, 14, 15, 16, 19, 21, 22, 23]) {
    const animated = pack.scenes[task-1];
    assert.ok(pack.lessons[task-1].steps.some((_,step) => animated(step,.11) !== animated(step,.88)), '№ ' + task);
  }
});

test('the marked point is seven unit steps from the start on a twelve-step line', () => {
  const vertices = read('y2026LinePath');
  assert.equal(vertices.length - 1, 12);
  assert.deepEqual(vertices[7], [3,1]);
  vertices.slice(1).forEach(([x,y],index) =>
    assert.equal(Math.abs(x-vertices[index][0]) + Math.abs(y-vertices[index][1]), 1));
});

test('only road piece Г can connect the two fixed parts without a rotation', () => {
  const distance = ([x,y],[u,v]) => Math.abs(x-u) + Math.abs(y-v);
  const left = read('y2026RoadExisting.slice(0,13)');
  const right = read('y2026RoadExisting.slice(13)');
  const pieces = [
    [[0,0],[1,0],[2,0],[2,1],[2,2],[2,3]],
    [[0,0],[1,0],[1,1],[1,2],[2,2],[2,3]],
    [[0,0],[1,0],[1,1],[1,2],[1,3],[2,3]],
    [[0,0],[1,0],[2,0],[2,1],[2,2],[3,2]],
    [[1,0],[2,0],[3,0],[0,1],[1,1],[3,1]],
  ];
  const matches = [];
  for (const [id,piece] of pieces.entries()) {
    for (let c = 0; c < 14; c++) for (let r = 0; r < 6; r++) {
      const candidate = piece.map(([x,y]) => [x+c,y+r]);
      if (candidate.some(([x,y]) => x >= 14 || y >= 6)) continue;
      if (candidate.some(cell => [...left,...right].some(other => !distance(cell,other)))) continue;
      if ([left,right].every(end => end.some(cell => candidate.some(other => distance(cell,other) === 1)))) {
        matches.push({id,candidate});
      }
    }
  }
  assert.deepEqual(matches,[{id:3,candidate:read('y2026RoadBridge')}]);
});

test('the four pieces of the heart tessellate its eleven empty cells', () => {
  const rows = read('y2026HeartRows');
  const gaps = rows.flatMap((row,r) => Array.from(row, (value,c) => value === '.' ? `${r},${c}` : null).filter(Boolean));
  const pieces = read('y2026HeartTiles');
  assert.equal(gaps.length, 11);
  assert.deepEqual(Object.keys(pieces), ['А','Б','В','Д']);
  assert.deepEqual(Object.values(pieces).flat().map(String).sort(), gaps.sort());
  assert.equal(4 + 4 + 1 + 3 + 2 - gaps.length, 3);
});

test('the only full path through the arrow grid starts at D2 and leaves at D1', () => {
  const arrows = read('y2026ArrowGrid');
  const directions = {'→':[0,1], '←':[0,-1], '↑':[-1,0], '↓':[1,0]};
  const walk = (r,c) => {
    const seen = new Map();
    while (arrows[r]?.[c] && !seen.has(`${r},${c}`)) {
      seen.set(`${r},${c}`, [r,c]);
      const [dr,dc] = directions[arrows[r][c]];
      r += dr;
      c += dc;
    }
    return [...seen.values()];
  };
  const routes = arrows.flatMap((row,r) => row.map((_,c) => walk(r,c))).filter(route => route.length === 12);
  assert.deepEqual(routes, [read('y2026ArrowPath')]);
  assert.deepEqual(routes[0][0], [1,3]);
  assert.deepEqual(routes[0].at(-1), [0,3]);
});

test('the code patterns reproduce all five competition numbers exactly', () => {
  const values = {3:8,4:3,6:2,9:1,11:4,12:7,14:5};
  assert.deepEqual(read('y2026CipherRows').map(row => Number(row.map(pattern => values[pattern]).join(''))),
    [882,183,521,872,451]);
});

test('only three one-eyed creatures fit and the towers are visible in columns 2, 4, 3, 2', () => {
  assert.deepEqual(read('y2026Creatures').filter(item => item.legs === 16), [{three:2,one:3,legs:16}]);
  assert.deepEqual(read('[0,1,2,3].map(c => y2026TowerGrid.filter((_,r) => y2026VisibleTower(r,c)).length)'),
    [2,4,3,2]);
});

test('two complete number grids preserve the given numbers and both marked twos', () => {
  const givens = read('y2026NumberGrid');
  const grids = read('y2026NumberCompletions');
  assert.notDeepEqual(grids[0],grids[1]);
  for (const grid of grids) {
    givens.forEach((row,r) => row.forEach((given,c) => {
      if (typeof given === 'number') assert.equal(grid[r][c], given);
      if (given === '?') assert.equal(grid[r][c], 2);
    }));
    const columns = grid[0].map((_,c) => grid.map(row => row[c]));
    for (const values of [...grid,...columns]) assert.deepEqual(values.slice().sort(),[0,2,2,6]);
  }
});

test('the bear buckets give a unique Laura and Mona, and the cards give one subtraction', () => {
  const buckets = [2,3,4,6,7];
  const pairs = buckets.flatMap(chris => buckets.filter(laura => laura - 2 === chris + 2)
    .filter(laura => buckets.includes((chris + laura) / 2)).map(laura => [chris,laura,(chris+laura)/2]));
  assert.deepEqual(pairs, [[2,6,4]]);
  const matches = [];
  for (const a of [1,7]) for (const b of [6,8]) for (const c of [3,5,9]) for (const d of [1,7]) {
    if (new Set([a,b,c,d]).size === 4 && 10*a+b-c === d) matches.push([a,b,c,d]);
  }
  assert.deepEqual(matches, [[1,6,9,7]]);
});

test('three button presses are necessary and sufficient', () => {
  const start = read('y2026ButtonStart');
  const press = run('y2026ButtonPress');
  const successful = [];
  for (let mask = 0; mask < 16; mask++) {
    const buttons = [0,1,2,3].filter(index => mask & (1 << index));
    if (buttons.reduce(press,start).every(shape => !shape)) successful.push(buttons);
  }
  assert.deepEqual(successful, [[1,2,3]]);
  assert.deepEqual(successful[0],read('y2026ButtonPresses'));
});

test('the nine candy counts sum to sixteen and reproduce every printed clue', () => {
  const candy = read('y2026CandyCounts');
  const sums = candy.map((row,r) => row.map((_,c) =>
    [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].reduce((sum,[i,j]) => sum+(candy[i]?.[j] ?? 0),0)));
  assert.deepEqual(sums,read('y2026CandyClues'));
  assert.equal(candy.flat().reduce((sum,count) => sum + count),16);
});

test('the gray sheet remains a square and both other sheets yield two squares each', () => {
  const squareChecks = scene => (scene.match(/>✓<\/text>/g) || []).length;
  const paper = pack.scenes[7];
  assert.match(paper(1, 2.4), /width="100" height="100" rx="0" fill="#9ea2a5"/);
  assert.equal(squareChecks(paper(1, 2.4)),1);
  assert.equal(squareChecks(paper(2, 2.4)),5);
  assert.match(paper(3, 2.4), /1 \+ 2 \+ 2 = 5/);
});

test('the 50 cm line repeats groups of 6 and only cube view Б fits both limits', () => {
  const orders = [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];
  const fits = orders.filter(order => {
    let length = 0;
    for (let i = 0; length < 50; i++) length += order[i % 3];
    return length === 50;
  });
  assert.deepEqual(fits, [[2,1,3],[2,3,1]]);
  const options = read('y2026CubeOptions');
  const possible = options.map((grid,i) => grid[0].every(value => value === 0)
    && grid.flat().reduce((sum,value) => sum+value,0) <= 11-9+1 ? i : -1).filter(i => i >= 0);
  assert.deepEqual(possible,[1]);
});
