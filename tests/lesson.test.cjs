const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
function app(includeArchive = false, archiveOverride = null, browser = {}) {
  const elements = new Map(), handlers = {}, callbacks = new Map();
  const fetched = [];
  let time = 0, id = 0, focused;
  const element = name => {
    if (!elements.has(name)) elements.set(name, {
      innerHTML: '', textContent: '', hidden: false, disabled: false, value: name === 'drawingColor' ? '#e9693e' : '',
      selectedIndex: 0, style: {}, attributes: {}, classList: {toggle() {}, remove() {}},
      setAttribute(key, value) { this.attributes[key] = value; },
      getAttribute(key) { return this.attributes[key] ?? null; },
      append(child) { child.parentElement = this; },
      addEventListener(key, listener) { this[key] = listener; },
      focus() { focused = this; },
      remove() {},
    });
    return elements.get(name);
  };
  const ctx = vm.createContext({
    TextEncoder, URL, ...browser,
    document: {
      body: {}, getElementById: element, addEventListener(key, listener) { handlers[key] = listener; },
      get activeElement() { return focused; },
    },
    requestAnimationFrame(fn) { callbacks.set(++id, fn); return id; },
    cancelAnimationFrame(key) { callbacks.delete(key); }, console,
  });
  const execute = file => vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), ctx, {filename: file});
  const scriptFiles = browser.streamProduction
    ? ['edition-loader.js', 'editions/index.js', 'lesson-visuals.js']
    : ['lessons.js', 'four-point-lessons.js', 'five-point-lessons.js', 'four-point-scenes.js', 'five-point-scenes.js'];
  if (browser.streamProduction) {
    ctx.document.currentScript = {src: 'https://example.test/edition-loader.js'};
    ctx.document.createElement = tag => ({
      tag, addEventListener(name, listener) { this[name] = listener; }, remove() {},
    });
    ctx.document.head = {append(node) {
      if (node.tag !== 'script') return;
      const file = new URL(node.src).pathname.slice(1);
      fetched.push(file);
      queueMicrotask(() => { execute(file); node.load(); });
    }};
  }
  if (includeArchive) scriptFiles.push(...['legacy-catalog', 'legacy-conditions', 'legacy-editions', '2000-visual',
    '2000-three', '2000-four', '2000-five', 2000, 2020, 2021, 2022, 2023, 2025, '2026-condition-art', 2026]
    .map(year => 'years/' + year + '.js'));
  scriptFiles.push('workspace.js', 'fruit-workspace.js', 'profile-rating.js', 'account-progress.js', 'app.js');
  for (const file of scriptFiles) {
    if (file === 'app.js' && archiveOverride) ctx.KENGURU_ARCHIVE = {...ctx.KENGURU_ARCHIVE, ...archiveOverride};
    execute(file);
  }
  const tick = (ms = 16) => {
    time += ms;
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const fn of pending) fn(time);
  };
  return {run: source => vm.runInContext(source, ctx), element, tick, advance(ms) {
    for (let left = ms; left > 0; left -= 16) tick(Math.min(16, left));
  }, handlers, fetched};
}

test('official answer key and every explanation step',()=>{const a=app();assert.equal(a.run('LESSONS.slice(0,8).map(l=>LETTERS[l.answer]).join("")'),'ДВВВГВДБ');for(let t=0;t<24;t++)for(let s=0;s<a.run(`LESSONS[${t}].steps.length`);s++){a.run(`selectTask(${t});navigate(${s})`);assert.ok(a.element('sceneTitle').textContent);if(t||s)assert.ok(a.element('scene').innerHTML);assert.equal(a.element('answers').hidden,s!==0);for(let f=0;f<=12;f++){a.run(`current().frame=${f};renderScene()`);assert.ok(!a.element('scene').innerHTML.includes('NaN'))}}});
test('square areas and unique cell count',()=>{const a=app();assert.equal(a.run('REGIONS.map(p=>Math.abs(p.reduce((s,v,j)=>{const n=p[(j+1)%p.length];return s+v[0]*n[1]-n[0]*v[1]},0))/2).join(",")'),'8,8,8,8,7');assert.equal(a.run('ORANGE.length+","+GREEN.length'),'7,9');assert.equal(a.run('new Set([...ORANGE,...GREEN].map(p=>p.join(","))).size'),16)});
test('minimum ladder route uses six connected ladders',()=>{const a=app();a.run(`
const platformAt=(level,x)=>PLATFORMS[level].findIndex(([a,b])=>a<=x&&x<=b);
const edges=new Map();for(const [l,x,y] of LADDERS){const a=l+':'+platformAt(l,x),b=(l+1)+':'+platformAt(l+1,y);if(a.endsWith('-1')||b.endsWith('-1'))throw Error('ladder misses platform');for(const [u,v] of [[a,b],[b,a]]){if(!edges.has(u))edges.set(u,[]);edges.get(u).push(v)}}
const q=[['0:0',0]],seen=new Set();let distance;while(q.length){const [n,d]=q.shift();if(seen.has(n))continue;seen.add(n);if(n==='4:2'){distance=d;break}for(const next of edges.get(n)||[])q.push([next,d+1])}if(distance!==6)throw Error('minimum '+distance);
let used=0;for(let i=1;i<FIRE_ROUTE.length;i++){const [x,l]=FIRE_ROUTE[i-1],[y,m]=FIRE_ROUTE[i];if(l===m){if(platformAt(l,x)!==platformAt(m,y))throw Error('walk over gap')}else{used++;if(!LADDERS.some(([k,a,b])=>k===Math.min(l,m)&&(l<m?a===x&&b===y:a===y&&b===x)))throw Error('not a ladder')}}if(used!==6)throw Error('route not six');`)});
test('football passes stop on second reception at player one',()=>{const a=app();assert.equal(a.run('FOOTBALL.slice(1).every((n,i)=>(FOOTBALL[i]+2)%11+1===n)'),true);assert.equal(a.run('new Set(FOOTBALL.slice(0,-1)).size'),11);assert.equal(a.run('FOOTBALL.at(-2)'),9)});
test('remaining cells, erased digits, positive prices, cube differences and hidden tiles',()=>{const a=app();assert.equal(28-2*7-2,12);assert.deepEqual([4897,4898,4899].map(n=>String(n)),['4897','4898','4899']);const triples=[];for(let i=1;i<7;i++)for(let j=i+1;j<7;j++)for(let k=j+1;k<7;k++)if(i+j+k===7)triples.push([i,j,k]);assert.deepEqual(triples,[[1,2,4]]);assert.equal(a.run('CUBE_HEIGHTS.map(h=>h.every((v,i)=>v>=TARGET_HEIGHTS[i])&&h.reduce((n,v,i)=>n+v-TARGET_HEIGHTS[i],0)===1).join(",")'),'false,false,false,false,true');let grey=0;for(let y=1;y<7;y++)for(let x=2;x<9;x++)grey+=(x+y)%2===0;assert.equal(grey,21)});
test('answer persistence, navigation, repeat, true pause and automatic progression',()=>{const a=app();for(let t=0;t<8;t++)a.run(`selectTask(${t});current().selected=${t%5};render()`);for(let t=0;t<8;t++){a.run(`selectTask(${t})`);assert.equal(a.run('current().selected'),t%5)}a.run('selectTask(1);navigate(2);start()');a.advance(1200);const before=a.run('current().elapsed'),picture=a.element('scene').innerHTML;assert.ok(before>1100);a.run('pause()');a.advance(5000);assert.equal(a.run('current().elapsed'),before);assert.equal(a.element('scene').innerHTML,picture);a.run('start()');a.tick();assert.equal(a.run('current().elapsed'),before);a.tick();assert.equal(a.run('current().elapsed'),before+16);a.advance(20000);assert.equal(a.run('current().step'),4);assert.equal(a.run('playing'),false);a.element('repeat').onclick();assert.equal(a.run('current().step'),0);assert.equal(a.run('current().selected'),null);assert.equal(a.element('back').disabled,true);a.run('navigate(20)');assert.equal(a.run('current().step'),4);assert.equal(a.element('next').hidden,true);a.element('nextTask').onclick();assert.equal(a.run('task'),2)});
test('automatic playback waits for an independent answer',()=>{const a=app();a.run('selectTask(1);start()');a.advance(2000);assert.equal(a.run('current().step'),0);assert.equal(a.run('playing'),false);assert.match(a.element('feedback').textContent,/выбери/);a.run('current().selected=2;start()');a.advance(1600);assert.equal(a.run('current().step'),1)});
test('firefighter moves every display frame and continues at the exact split',()=>{const a=app();const start=JSON.parse(a.run('JSON.stringify(fireMotion(2,0))'));assert.deepEqual(start.points,[[40,0]]);let previous=0;for(let ms=16;ms<=2000;ms+=16){const distance=a.run(`fireMotion(2,${ms}/FRAME_MS).distance`);assert.ok(distance>previous);assert.ok(distance-previous<=2.01);previous=distance}assert.equal(a.run('Math.abs(fireMotion(2,100).distance-fireMotion(3,0).distance)<1e-8'),true);assert.equal(a.run('fireMotion(2,100).climbs'),3);assert.ok(a.run('fireMotion(3,0.02).distance>fireMotion(3,0).distance'));assert.equal(a.run('fireMotion(3,100).climbs'),6);assert.equal(a.run('Math.round(sceneDuration(1,2)-FIRE_DISTANCES[FIRE_SPLIT]/FIRE_SPEED*1000)'),400)});
test('fractional frames produce valid scenes, including the flying ball',()=>{const a=app();for(let t=0;t<24;t++)for(let s=0;s<a.run(`LESSONS[${t}].steps.length`);s++)for(const f of [0,.01,.12,.5,1.01,2.25,4.99,8.1]){const markup=a.run(`SCENES[${t}](${s},${f})`);assert.ok(!/NaN|undefined/.test(markup),`task ${t} step ${s} frame ${f}`)}assert.notEqual(a.run('footballScene(2,0.01)'),a.run('footballScene(2,0.04)'));assert.notEqual(a.run('areaScene(3,.01)'),a.run('areaScene(3,.04)'))});
test('annotations are isolated by task, step and variant; clear can be undone',()=>{const a=app();a.run('selectTask(0);workVariant=0;addMark({type:"pen",color:"#e9693e",points:[[220,30],[240,50]]});renderWorkspace()');assert.equal(a.run('getSheet().marks.length'),1);assert.match(a.element('drawingMarks').innerHTML,/polyline/);a.run('workVariant=1');assert.equal(a.run('getSheet().marks.length'),0);a.run('workVariant=0;clearDrawing()');assert.equal(a.run('getSheet().marks.length'),0);a.run('undoDrawing()');assert.equal(a.run('getSheet().marks.length'),1);a.run('navigate(1)');assert.equal(a.run('getSheet().marks.length'),0);a.run('navigate(0)');assert.equal(a.run('getSheet().marks.length'),1);a.run('selectTask(2)');assert.equal(a.run('getSheet().marks.length'),0);a.run('selectTask(0)');assert.equal(a.run('getSheet().marks.length'),1)});
test('cell hit tests and ladder rails follow the learner drag',()=>{const a=app();assert.equal(a.run('JSON.stringify(cellAt([102,15],{x:102,y:15,dx:62,dy:58,cols:7,rows:4}))'),'[102,15,62,58]');assert.equal(a.run('cellAt([20,20],{x:102,y:15,dx:62,dy:58,cols:7,rows:4})'),null);assert.equal(a.run('ladderGeometry([0,0],[0,80]).rails.length'),2);assert.equal(a.run('ladderGeometry([0,0],[0,80]).rungs.length'),6);assert.ok(a.run('markHit({type:"line",points:[[20,20],[100,100]]},[60,60])'));assert.equal(a.run('markHit({type:"line",points:[[20,20],[100,100]]},[100,10])'),false)});
test('learner-facing wording refers to solving rather than guessing',()=>{for(const f of ['index.html','lessons.js','app.js','workspace.js'])assert.doesNotMatch(fs.readFileSync(path.join(root,'dist',f),'utf8'),/догад/iu)});
test('fast cell painting has no gaps and the eraser removes a single cell',()=>{const a=app();a.run('selectTask(2);activeSheet=sheetKey();draft={type:"fill",color:"#e9693e",points:[],cells:[]};extendMark([110,25]);extendMark([490,25]);finishMark()');assert.equal(a.run('getSheet().marks[0].cells.length'),7);a.run('activeSheet=sheetKey();workingMarks=getSheet().marks.slice();extendMark([110,25]);finishMark()');assert.equal(a.run('getSheet().marks[0].cells.length'),6);a.run('undoDrawing()');assert.equal(a.run('getSheet().marks[0].cells.length'),7)});
test('square choices have no cell grid; the dropdown really changes the drawing',()=>{const a=app();a.run('selectTask(0);navigate(0)');assert.equal(a.run('drawingGrid()'),null);assert.doesNotMatch(a.element('answers').innerHTML,/grid-line/);assert.equal((a.element('scene').innerHTML.match(/<rect /g)||[]).length,1);const drawings=new Set();for(let i=0;i<5;i++){a.element('workVariant').selectedIndex=i;a.element('workVariant').change();assert.equal(a.run('workVariant'),i);assert.equal(a.element('workVariant').selectedIndex,i);drawings.add(a.element('scene').innerHTML)}assert.equal(drawings.size,5);a.run('navigate(1)');assert.notEqual(a.run('drawingGrid()'),null)});
test('cube lesson rejects each candidate before testing D and reaches its real final step',()=>{const a=app();a.run('selectTask(6)');assert.equal(a.run('LESSONS[6].steps.length'),9);for(let s=2;s<=5;s++){a.run(`navigate(${s})`);assert.match(a.element('sceneTitle').textContent,new RegExp('^'+['А','Б','В','Г'][s-2]+':'));assert.match(a.element('scene').innerHTML,/После падения · условие/);assert.match(a.element('scene').innerHTML,/не подходит/);assert.equal(a.run(`CUBE_HEIGHTS[${s-2}][${[3,3,2,0][s-2]}]<TARGET_HEIGHTS[${[3,3,2,0][s-2]}]`),true)}a.run('navigate(6)');assert.equal(a.element('next').hidden,false);assert.doesNotMatch(a.element('feedback').textContent,/Ответ Д/);a.run('navigate(7)');assert.match(a.element('play').textContent,/Убрать кубик/);a.run('navigate(8)');assert.equal(a.element('next').hidden,true);assert.equal(a.element('nextTask').hidden,false);assert.equal(a.element('counter').textContent,'09 / 09');assert.match(a.element('scene').innerHTML,/Все четыре столбика совпали/);a.run('navigate(0);current().selected=4;start()');a.advance(55000);assert.equal(a.run('current().step'),8);assert.equal(a.run('playing'),false)});
function taskPickerNumbers(visit) {
  return [...visit.element('taskPicker').innerHTML.matchAll(/class="task-tab-number">(\d+)</g)]
    .map(([, number]) => Number(number));
}

function chooseTaskGroup(visit, group) {
  const picker = visit.element('taskSectionPicker');
  picker.value = String(group);
  picker.change({target: picker});
}

async function clickTaskCard(visit, number) {
  const index = visit.run(`activeSet().indices.find(i => LESSONS[i].number === ${number})`);
  assert.ok(visit.element('taskPicker').innerHTML.includes(`data-task="${index}"`));
  await visit.element('taskPicker').click({target: {closest: () => ({dataset: {task: String(index)}})}});
}

test('task groups keep all point levels and show at most five cards until a task is chosen', async () => {
  const visit = app();
  assert.equal(visit.run('LESSONS.length'), 24);
  assert.equal(visit.run('SCENES.length'), 24);
  const expected = [[1, 2, 3, 4, 5], [6, 7, 8], [9, 10, 11, 12, 13], [14, 15, 16],
    [17, 18, 19, 20, 21], [22, 23, 24]];
  assert.equal(visit.element('taskSummaryTitle').textContent, visit.element('taskTitle').textContent);
  for (const [group, numbers] of expected.entries()) {
    chooseTaskGroup(visit, group);
    assert.deepEqual(taskPickerNumbers(visit), numbers);
    assert.equal(visit.run('LESSONS[task].number'), 1);
  }
  assert.match(visit.element('taskSectionPicker').innerHTML, />4 балла · № 14–16</);
  chooseTaskGroup(visit, 3);
  visit.element('taskNavigation').open = true;
  await clickTaskCard(visit, 14);
  assert.equal(visit.element('taskNavigation').open, false);
  assert.equal(visit.run('document.activeElement === $("taskNavigationToggle")'), true);
  visit.run('current().selected=1; navigate(3); selectTask(19)');
  chooseTaskGroup(visit, 3);
  await clickTaskCard(visit, 14);
  assert.equal(visit.run('current().step'), 3);
  assert.equal(visit.run('current().selected'), 1);
  visit.run('selectTask(10); navigate(0)');
  assert.match(visit.element('answers').innerHTML, /disks-option-4/);
  visit.run('selectTask(22); navigate(0)');
  assert.match(visit.element('answers').innerHTML, /cookie-choice/);
  visit.run('selectTask(23); navigate(lastStep())');
  assert.match(visit.element('nextTask').textContent, /К первой/);
  await visit.element('nextTask').onclick();
  assert.equal(visit.run('task'), 0);
  assert.deepEqual(taskPickerNumbers(visit), expected[0]);
});
test('coin lesson finishes Tonya and Dima before offering an optional check',()=>{const a=app();a.run('selectTask(8)');assert.equal(a.run('LESSONS[8].steps.map(s=>s[0]).join(",")'),'Твой выбор,Правила,Тоня,Дима,Ответ');for(let s=0;s<4;s++){a.run(`navigate(${s})`);assert.equal(a.element('alternative').hidden,true);assert.doesNotMatch(a.element('scene').innerHTML,/все возможные итоги/)}a.run('navigate(4)');assert.equal(a.element('alternative').hidden,false);assert.equal(a.element('alternative').open,false);assert.match(a.element('alternativeTitle').textContent,/Другой способ/);assert.match(a.element('scene').innerHTML,/2 \+ 1 = 3/);assert.equal((a.element('alternativeTable').innerHTML.match(/scope="row"/g)||[]).length,5);a.element('alternative').open=true;a.run('selectTask(9)');assert.equal(a.element('alternative').hidden,true);assert.equal(a.element('alternative').open,false)});
test('fruit scheme begins blank and is filled by the learner, not by deduction order',()=>{const a=app();a.run('selectTask(9);navigate(0)');assert.equal(a.run('FRUIT_WORK.preferences.flat().filter(v=>v===null).length'),25);assert.equal(a.run('FRUIT_WORK.assignment.filter(v=>v===null).length'),5);assert.equal(a.run('FRUIT_WORK_ROWS.map(i=>FOUR_FRUIT_PEOPLE[i]).join(",")'),'Аня,Боря,Коля,Денис,Эльза');assert.equal((a.element('scene').innerHTML.match(/class="fruit-cell unknown"/g)||[]).length,25);assert.doesNotMatch(a.element('scene').innerHTML,/class="fruit-cell likes"/);assert.equal(a.element('drawingLayer').attributes['data-visible'],'false');assert.equal(a.element('drawingTools').hidden,true);a.element('scene').click({target:{closest:selector=>selector==='[data-fruit-row]'?{dataset:{fruitRow:'0',fruitColumn:'2'}}:null}});assert.equal(a.run('FRUIT_WORK.preferences[0][2]'),true);a.run('cycleFruitPreference(0,2)');assert.equal(a.run('FRUIT_WORK.preferences[0][2]'),false);a.run('cycleFruitPreference(0,2)');assert.equal(a.run('FRUIT_WORK.preferences[0][2]'),null);a.element('drawingWorkspace').open=true;a.run('navigate(1)');assert.equal(a.element('drawingLayer').attributes['data-visible'],'true')});
test('fruit checks reject incomplete, incorrect and repeated choices without completing the answer',()=>{const a=app();a.run('selectTask(9)');assert.match(a.run('checkFruitPreferences()'),/Заполни все/);a.run('FRUIT_WORK.preferences=Array.from({length:5},()=>Array(5).fill(true))');assert.match(a.run('checkFruitPreferences()'),/неточности/);assert.equal(a.run('FRUIT_WORK.preferences.flat().every(v=>v===true)'),true);a.run('FRUIT_WORK.preferences=FRUIT_WORK_ROWS.map(source=>FOUR_FRUITS.map((_,column)=>FOUR_FRUIT_PREFS[source].includes(column)))');assert.match(a.run('checkFruitPreferences()'),/соответствует/);assert.equal(a.run('current().selected'),null);assert.match(a.run('checkFruitAssignment()'),/всем пяти/);a.run('FRUIT_WORK.assignment=[2,0,3,4,4]');assert.match(a.run('checkFruitAssignment()'),/все взяли разное/);a.run('FRUIT_WORK.assignment=[0,2,3,4,1]');assert.match(a.run('checkFruitAssignment()'),/не любит/);a.run('FRUIT_WORK.assignment=[2,0,3,4,1]');assert.match(a.run('checkFruitAssignment()'),/Все условия выполнены/);assert.equal(a.run('current().selected'),null);a.run('selectTask(0);selectTask(9)');assert.equal(a.run('FRUIT_WORK.assignment.join(",")'),'2,0,3,4,1');a.element('repeat').onclick();assert.equal(a.run('FRUIT_WORK.assignment.every(v=>v===null)'),true);assert.equal(a.run('FRUIT_WORK.preferences.flat().every(v=>v===null)'),true)});
test('fruit dropdown keeps the selected value through rendering',()=>{const a=app();a.run('selectTask(9)');a.element('scene').change({target:{closest:()=>({dataset:{fruitPerson:'1'},value:'3'})}});assert.equal(a.run('FRUIT_WORK.assignment[1]'),3);assert.match(a.element('scene').innerHTML,/value="3" selected/);assert.equal(a.run('FRUIT_WORK.assignment.filter(v=>v!==null).length'),1)});

test('archive keeps original year sizes, local task numbers and official sources',()=>{const a=app(true);assert.equal(a.run('LESSONS.length'),684);assert.equal(a.run('SCENES.length'),684);assert.equal(a.run('CATALOG.map(s=>s.year).sort().join(",")'),Array.from({length:27},(_,i)=>2000+i).join(','));for(const [year,count] of [...Array.from({length:21},(_,i)=>[2000+i,26]),[2021,18],[2022,24],[2023,24],[2024,24],[2025,24],[2026,24]]){a.run(`selectYear(${year})`);assert.equal(a.run('activeSet().indices.length'),count);assert.equal(a.run('current().step'),0);assert.equal(a.element('gradePicker').disabled,true);assert.match(a.element('gradePicker').innerHTML,/3–4 классы/);assert.equal(a.element('tasksSource').href,`assets/kenguru/kenguru_${year}_class_3-4.pdf`);assert.equal(a.element('solutionsSource').hidden,year<=2020);const indices=JSON.parse(a.run('JSON.stringify(activeSet().indices)'));for(let n=0;n<indices.length;n++)assert.equal(a.run(`LESSONS[${indices[n]}].number`),n+1);a.run(`selectTask(activeSet().indices.at(-1));navigate(lastStep())`);assert.equal(a.element('taskNumber').textContent,String(count).padStart(2,'0'));a.element('nextTask').onclick();assert.equal(a.run('LESSONS[task].number'),1);assert.equal(a.run('LESSONS[task].year'),year)}});
test('year navigation preserves answers, steps, task positions and drawings independently', async () => {
  const visit = app(true);
  visit.run('selectYear(2024); selectTask(0); current().selected=2; addMark({type:"pen",color:"#e9693e",points:[[220,30],[240,50]]}); navigate(2); selectYear(2020)');
  assert.equal(visit.run('current().selected'), null);
  assert.equal(visit.run('getSheet().marks.length'), 0);
  assert.deepEqual(taskPickerNumbers(visit), [1, 2, 3, 4, 5]);
  chooseTaskGroup(visit, 2);
  await clickTaskCard(visit, 11);
  visit.run('current().selected=4; navigate(2); selectYear(2021)');
  assert.deepEqual(taskPickerNumbers(visit), [1, 2, 3, 4, 5]);
  visit.run('selectYear(2020)');
  assert.equal(visit.run('LESSONS[task].number'), 11);
  assert.deepEqual(taskPickerNumbers(visit), [11, 12, 13, 14, 15]);
  assert.equal(visit.run('current().selected'), 4);
  assert.equal(visit.run('current().step'), 2);
  visit.run('selectYear(2024)');
  assert.equal(visit.run('task'), 0);
  assert.equal(visit.run('current().selected'), 2);
  assert.equal(visit.run('current().step'), 2);
  visit.run('navigate(0)');
  assert.equal(visit.run('getSheet().marks.length'), 1);
});
test('separate third and fourth grade datasets stay separate when provided',()=>{const makeSet=grade=>({id:'2030-'+grade,year:2030,grades:[grade],label:grade+' класс',sources:{tasksUrl:'https://example.invalid/tasks.pdf',answersUrl:'https://example.invalid/answers.pdf',solutionUrl:null},lessons:[{number:1,points:3,answer:0,title:'Тест',short:'Тест',skill:'Проверяем',question:'Тестовое условие',choices:['1','2','3','4','5'],originalImage:'assets/original-1.png',steps:[['Выбор','Выбор','Выбери'],['Ответ','Ответ','Проверка']]}],scenes:[()=>'<svg aria-label="Тест" viewBox="0 0 640 300"></svg>']});const a=app(false,{2030:[makeSet(3),makeSet(4)]});a.run('selectYear(2030);current().selected=2');assert.equal(a.element('gradePicker').disabled,false);assert.equal((a.element('gradePicker').innerHTML.match(/<option /g)||[]).length,2);a.element('gradePicker').value='2030-4';a.element('gradePicker').change();assert.equal(a.run('selectedDataset'),'2030-4');assert.equal(a.run('current().selected'),null);a.element('gradePicker').value='2030-3';a.element('gradePicker').change();assert.equal(a.run('current().selected'),2)});
test('all archive lessons render together and reference existing files',()=>{const a=app(true),total=a.run('LESSONS.length');for(let index=0;index<total;index++){const count=a.run(`LESSONS[${index}].steps.length`);assert.ok(count>=2);assert.equal(a.run(`LESSONS[${index}].choices.length`),5);assert.ok(a.run(`Number.isInteger(LESSONS[${index}].answer)&&LESSONS[${index}].answer>=0&&LESSONS[${index}].answer<5`));const original=a.run(`LESSONS[${index}].originalImage`);assert.ok(fs.existsSync(path.join(root,'dist',original)),original);for(let step=0;step<count;step++)for(const frame of [0,.01,.5,2.25,5.9,12]){const markup=a.run(`SCENES[${index}](${step},${frame})`);assert.equal(typeof markup,'string');assert.doesNotMatch(markup,/NaN|undefined|Infinity/,`${index}/${step}/${frame}`);for(const match of markup.matchAll(/(?:src|href)="(assets\/[^"#]+)"/g))assert.ok(fs.existsSync(path.join(root,'dist',match[1])),match[1])}}});

test('a direct task URL opens the right year and lesson, with or without saved progress', () => {
  const storage = new Map();
  const location = {hash: '#zadacha=2025-3-4/24'};
  const browser = {
    location,
    sessionStorage: {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    history: {
      pushState: (_, __, hash) => { location.hash = hash; },
      replaceState: (_, __, hash) => { location.hash = hash; },
    },
  };
  let visit = app(true, null, browser);
  assert.match(visit.element('taskTitle').textContent, /Квадрат на чаше весов/);
  assert.match(visit.element('question').textContent, /1, 2, 3, 4 или 5 кг/);
  assert.equal(visit.run('current().step'), 0);

  visit.element('answers').click({target: {closest: () => ({dataset: {answer: '2'}})}});
  visit.run('navigate(lastStep()); selectYear(2021)');
  assert.equal(location.hash, '#zadacha=2021-3-4/1');

  visit = app(true, null, browser);
  assert.match(visit.element('taskTitle').textContent, /Куб из четырёх кирпичиков/);
  visit.run('selectYear(2025); selectTask(LESSONS.findIndex(l => l.year === 2025 && l.number === 24))');
  assert.equal(visit.run('current().selected'), 2);
  assert.equal(visit.run('current().step === lastStep()'), true);
  assert.match(visit.element('collectionProgress').textContent, /открыто ответов 1 из 24/);

  visit.element('repeat').onclick();
  visit = app(true, null, browser);
  assert.equal(visit.run('current().selected'), null);
  assert.equal(visit.run('current().step'), 0);
  assert.match(visit.element('collectionProgress').textContent, /открыто ответов 1 из 24/);
  assert.equal(location.hash, '#zadacha=2025-3-4/24');
});

test('an unavailable browser store permits opening and navigating lessons', () => {
  function blocked() {throw new Error('Storage unavailable');}
  const unavailable = {getItem: blocked, setItem: blocked};
  const visit = app(true, null, {sessionStorage: unavailable, performance: {getEntriesByType: () => [{type: "navigate"}]}});
  visit.run('selectTask(8); navigate(2)');
  assert.match(visit.element('question').textContent, /перед клеткой № 1/);
  assert.equal(visit.run('current().step'), 2);
});

test('draft notes and scratch paper follow the task, while special tools follow the surface',()=>{
  const a=app(true), workspace=a.element('drawingWorkspace');
  assert.equal(a.element('drawingLayer').attributes['data-visible'],'false');
  workspace.open=true;
  workspace.toggle();
  assert.equal(a.element('drawingLayer').attributes['data-visible'],'true');
  assert.equal(a.run('canDrawWith("fill") || canDrawWith("ladder")'),false);
  a.element('draftNotes').input({target:{value:'Проверю площадь'}});
  a.element('drawingSurface').change({target:{value:'grid'}});
  assert.equal(a.element('scene').hidden,false);
  assert.equal(a.element('draftBoard').hidden,false);
  assert.match(a.element('draftPaper').innerHTML,/M20 0V300/);
  assert.equal(a.run('canDrawWith("fill")'),true);
  a.run('addMark({type:"pen",color:"#e9693e",points:[[10,10],[20,20]]});navigate(1)');
  assert.equal(a.element('scene').hidden,false);
  a.element('drawingSurface').change({target:{value:'grid'}});
  assert.equal(a.run('getSheet().marks.length'),1);
  a.run('selectTask(1)');
  assert.equal(a.run('canDrawWith("ladder")'),true);
  assert.equal(a.element('draftNotes').value,'');
  a.run('selectYear(2026)');
  assert.equal(a.run('canDrawWith("ladder")'),false);
  a.run('selectTask(0)');
  assert.equal(a.element('draftNotes').value,'Проверю площадь');
  a.run('selectTask(9);navigate(0)');
  assert.equal(a.element('scene').hidden,false);
  assert.equal(a.element('drawingLayer').attributes['data-visible'],'false');
  a.element('drawingSurface').change({target:{value:'plain'}});
  assert.equal(a.element('drawingLayer').attributes['data-visible'],'true');
  workspace.open=false;
  workspace.toggle();
  assert.equal(a.element('scene').hidden,false);
});

test('pencil captures strokes on blank space without hiding the 2026 lesson',()=>{
  const a=app(true);
  a.run('selectYear(2026)');
  const lessonImage=a.element('scene').innerHTML;
  const workspace=a.element('drawingWorkspace'),layer=a.element('drawingLayer');
  const stage=a.element('stage'),board=a.element('draftBoard');
  stage.appendChild=child=>{child.parentElement=stage};
  board.appendChild=child=>{child.parentElement=board};
  layer.parentElement=stage;
  layer.viewBox={baseVal:{x:0,y:0,width:640,height:300}};
  layer.getScreenCTM=()=>({inverse(){return this}});
  layer.createSVGPoint=()=>({matrixTransform(){return this}});
  layer.setPointerCapture=()=>{};
  workspace.open=true;
  workspace.toggle();
  a.element('drawingSurface').change({target:{value:'grid'}});
  assert.equal(layer.parentElement,board);
  assert.equal(a.element('scene').innerHTML,lessonImage);
  assert.equal(a.element('scene').hidden,false);
  a.element('drawingTools').click({target:{closest:()=>({dataset:{tool:'pen'}})}});
  const pointer=(x,y)=>({clientX:x,clientY:y,pointerId:1,pointerType:'touch',button:0,preventDefault(){}});
  layer.pointerdown(pointer(40,40));
  layer.pointermove(pointer(70,60));
  layer.pointerup(pointer(100,80));
  assert.match(a.element('drawingMarks').innerHTML,/40,40 70,60 100,80/);
  assert.equal(a.run('getSheet().marks.length'),1);
  a.element('drawingSurface').change({target:{value:'scene'}});
  assert.equal(layer.parentElement,stage);
  assert.equal(board.hidden,true);
  assert.equal(a.run('getSheet().marks.length'),0);
});

test('a new learner gets a clean attempt even in a tab that inherits storage',()=>{
  const records=new Map();
  const sharedLegacy=new Map([['kenguru:v1:2026-3-4/1','{"step":3,"selected":3,"seen":true}']]);
  const makeBrowser=(entries,type)=>({
    location:{hash:'#zadacha=2026-3-4/1'},
    performance:{getEntriesByType:()=>[{type}]},
    localStorage:{getItem:key=>sharedLegacy.get(key)},
    sessionStorage:{
      get length(){return entries.size},
      key:i=>[...entries.keys()][i],
      getItem:key=>entries.get(key),
      setItem:(key,value)=>entries.set(key,value),
      removeItem:key=>entries.delete(key),
    },
  });
  const first=app(true,null,makeBrowser(records,'navigate'));
  assert.equal(first.run('current().step'),0);
  first.element('answers').click({target:{closest:()=>({dataset:{answer:'3'}})}});
  first.run('navigate(lastStep())');
  assert.equal(first.run('taskHash(task)'),'#zadacha=2026-3-4/1');
  const reloaded=app(true,null,makeBrowser(records,'reload'));
  assert.equal(reloaded.run('current().selected'),3);
  assert.equal(reloaded.run('current().step === lastStep()'),true);
  const independent=app(true,null,makeBrowser(new Map(records),'navigate'));
  assert.equal(independent.run('current().selected'),null);
  assert.equal(independent.run('current().step'),0);
  assert.match(independent.element('collectionProgress').textContent,/открыто ответов 0 из 24/);
  assert.equal(reloaded.run('current().selected'),3);
  assert.equal(sharedLegacy.size,1);
});

test('the 2000 deep link keeps Latin labels and scores against its own key', () => {
  const a = app(true, null, {location: {hash: '#zadacha=2000-3-4/1'}});
  assert.equal(a.run('activeSet().year'), 2000);
  assert.match(a.element('answers').innerHTML, /<strong>B<\/strong>/);
  assert.doesNotMatch(a.element('answers').innerHTML, /<strong>Б<\/strong>/);
  a.element('answers').click({target: {closest: () => ({dataset: {answer: '1'}})}});
  assert.match(a.element('feedback').textContent, /Твой выбор — B/);
  a.run('navigate(lastStep())');
  assert.match(a.element('feedback').textContent, /Верно!.*Ответ B: 20 мин\.$/u);

  a.run('selectYear(2024)');
  assert.match(a.element('answers').innerHTML, /<strong>Б<\/strong>/);
});

test('selecting a year with one edition closes the compact menu', () => {
  const a = app(true);
  const toggle = a.element('editionToggle');
  let focused = false;
  toggle.focus = () => { focused = true; };
  a.element('editionMenu').open = true;
  a.element('yearPicker').value = '2019';
  a.element('yearPicker').change();
  assert.equal(a.element('archiveLabel').textContent, '2019 · 3–4 классы');
  assert.equal(a.element('editionMenu').open, false);
  assert.equal(a.element('gradeField').hidden, true);
  assert.ok(focused);
});

test('the draft surface popover closes after selection and with the draft', () => {
  const a = app();
  const draft = a.element('drawingWorkspace');
  const surface = a.element('draftSurfaceMenu');
  const notes = a.element('draftNotesMenu');
  draft.open = true;
  surface.open = true;
  a.element('drawingSurface').change({target: {value: 'grid'}});
  assert.equal(surface.open, false);
  assert.equal(a.element('draftBoard').hidden, false);

  notes.open = true;
  draft.open = false;
  draft.toggle();
  assert.equal(notes.open, false);
  assert.equal(a.element('draftBoard').hidden, true);
});

test('account scores award the first correct answer once and are restored on another device', async () => {
  const user = {id: 29, username: 'Лиса'};
  let server = {revision: 0, progress: {}};
  const request = async (_, data) => {
    if (data) server = {revision: server.revision + 1, progress: {...server.progress, ...data.progress}};
    return server;
  };
  const a = accountBrowser(request);
  const selectAnswer = index => a.element('answers').click({
    target: {closest: () => ({dataset: {answer: String(index)}})},
  });
  const correct = () => selectAnswer(a.run('LESSONS[task].answer'));

  assert.equal(a.element('openProfileRating').hidden, true);
  a.account(user);
  await syncTurn();
  correct();
  assert.equal(a.element('profileRatingPoints').textContent, '0 баллов');
  a.element('next').onclick();
  assert.equal(a.element('profileRatingPoints').textContent, '0 баллов');
  assert.match(a.element('ratingNotice').textContent, /ожидает подтверждения/);
  await syncTurn();
  assert.equal(a.element('profileRatingPoints').textContent, '3 балла');
  assert.equal(a.element('ratingNotice').textContent, '+3 балла в рейтинг');
  a.element('repeat').onclick();
  correct();
  a.run('navigate(1)');
  assert.equal(a.element('profileRatingPoints').textContent, '3 балла');

  a.run('selectTask(1)');
  selectAnswer((a.run('LESSONS[task].answer') + 1) % 5);
  a.run('navigate(1)');
  a.element('repeat').onclick();
  correct();
  a.run('navigate(1)');
  a.run('selectTask(2); navigate(1)');
  a.element('repeat').onclick();
  correct();
  a.run('navigate(1)');
  assert.equal(a.element('profileRatingPoints').textContent, '3 балла');

  a.run('selectTask(8)');
  correct();
  a.run('navigate(1); selectTask(16)');
  correct();
  a.run('start()');
  a.advance(1700);
  await syncTurn();
  assert.equal(a.element('profileRatingPoints').textContent, '12 баллов');
  a.run('renderRatingDialog()');
  assert.equal(a.element('ratingBadgeCount').textContent, '3 из 6');
  assert.match(a.element('ratingBadges').innerHTML, /is-earned[^]*Все уровни/u);

  await syncTurn();
  const reloaded = accountBrowser(request);
  reloaded.account(user);
  await syncTurn();
  assert.equal(reloaded.element('profileRatingPoints').textContent, '12 баллов');
});

test('a walkthrough opened before scoring stays ineligible after repeat', async () => {
  const prior = {revision: 1, progress: {
    current: '"2024-3-4/1"',
    '2024-3-4/1': '{"step":1,"selected":4,"seen":false}',
  }};
  const visit = accountBrowser(async (_, data) => data ? {revision: 2, progress: {...prior.progress, ...data.progress}} : prior);
  visit.account({id: 30, username: 'Ученик'});
  await syncTurn();
  assert.equal(visit.run('current().step'), 1);
  visit.element('repeat').onclick();
  visit.run('current().selected=LESSONS[task].answer; navigate(1)');
  assert.equal(visit.element('profileRatingPoints').textContent, '0 баллов');
});

function accountBrowser(request, records = new Map(), local = new Map()) {
  const listeners = new Map();
  const storage = values => ({getItem: key => values.get(key), setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)});
  const visit = app(false, null, {
    KenguruAccount: {request}, AbortController, setTimeout, clearTimeout,
    sessionStorage: storage(records), localStorage: storage(local),
    addEventListener: (type, callback) => listeners.set(type, callback),
  });
  visit.account = (user, options = {}) => listeners.get('kenguru:accountchange')({detail: {user, ...options}});
  visit.online = () => listeners.get('online')();
  return visit;
}

const syncTurn = () => new Promise(resolve => setImmediate(resolve));

test('the Russian editions keep their own tasks, years, archive and return position', async () => {
  const visit = app(false, null, {streamProduction: true, location: {hash: '#zadacha=2025-medvezhonok-2-3/20'}});
  await syncTurn();
  assert.equal(visit.element('currentSubject').textContent, 'Русский язык');
  assert.deepEqual(visit.fetched, ['editions/2025-medvezhonok-2-3.js']);
  assert.match(visit.element('scene').innerHTML, /medvezhonok-rebus/);
  assert.equal(visit.element('editionArchive').href, '/archive.html#russian');
  assert.equal(visit.run('activeSet().indices.length'), 28);
  assert.equal((visit.element('yearPicker').innerHTML.match(/<option/g) ?? []).length, 22);
  await visit.run('selectDataset("2025-medvezhonok-4-5")');
  assert.equal(visit.run('activeSet().indices.length'), 30);
  const picker = visit.element('subjectPicker');
  picker.value = 'math';
  picker.change();
  await syncTurn();
  assert.equal(visit.element('currentSubject').textContent, 'Математика');
  assert.doesNotMatch(visit.element('gradePicker').innerHTML, /medvezhonok/);
  picker.value = 'ru';
  picker.change();
  await syncTurn();
  assert.equal(visit.run('selectedDataset'), '2025-medvezhonok-4-5');
});

test('listening, reading and grade-specific numeric answers load through the public edition index', async () => {
  const visit = app(false, null, {streamProduction: true, location: {hash: '#zadacha=2025-british-bulldog-3-4/1'}});
  await syncTurn();
  assert.equal(visit.element('currentSubject').textContent, 'Английский');
  assert.equal(visit.element('listeningAudio').src, 'assets/british-bulldog/2025/listening.mp3');
  assert.deepEqual(taskPickerNumbers(visit), [1, 2, 3, 4, 5]);
  assert.equal(visit.element('taskPoints').textContent, '3 балла');
  visit.run('selectTask(activeSet().indices[5])');
  assert.equal(visit.element('listeningBlock').hidden, true);
  assert.equal(visit.element('readingPassage').hidden, false);
  assert.match(visit.element('readingText').textContent, /London/);
  await visit.run('selectDataset("2026-golden-fleece-3-4")');
  assert.equal(visit.element('taskPoints').textContent, '3 балла');
  await visit.run('selectDataset("2024-kit-4-5")');
  visit.run('selectTask(activeSet().indices[20])');
  assert.equal(visit.element('numericEntry').hidden, false);
  assert.equal(visit.element('answers').hidden, true);
  visit.element('numericAnswer').input({target: {value: '132'}});
  visit.run('navigate(lastStep())');
  assert.match(visit.element('feedback').textContent, /Верно!/);
  assert.equal(visit.element('editionArchive').href, '/archive.html#kit');
  assert.equal(visit.element('listeningBlock').hidden, true);
  visit.run('selectTask(activeSet().indices[17])');
  assert.equal(visit.run('LESSONS[task].steps.length'), 5);
  await visit.run('selectDataset("2019-chip-3-4")');
  visit.run('selectTask(activeSet().indices[19])');
  assert.match(visit.element('answers').innerHTML, />Казуар</);
});

test('British Bulldog sections follow each edition and stay in sync with task navigation', async () => {
  const visit = app(false, null, {streamProduction: true, location: {hash: '#zadacha=2025-british-bulldog-3-4/17'}});
  await syncTurn();
  const picker = visit.element('taskSectionPicker');
  assert.equal(picker.value, '3');
  assert.match(picker.innerHTML, /lang="en">Holiday pictures · № 16–20/);
  assert.equal(visit.element('taskTitle').lang, 'en');
  assert.equal(visit.element('taskSummaryTitle').lang, 'en');
  assert.equal(visit.element('taskSummaryTitle').textContent, visit.element('taskTitle').textContent);
  assert.match(visit.element('taskPicker').innerHTML, /class="task-tab-name" lang="en"/);
  assert.deepEqual(taskPickerNumbers(visit), [16, 17, 18, 19, 20]);
  chooseTaskGroup(visit, 6);
  assert.equal(visit.run('LESSONS[task].number'), 17);
  assert.deepEqual(taskPickerNumbers(visit), [31, 32, 33, 34, 35]);
  await clickTaskCard(visit, 31);
  visit.element('previousTaskShortcut').onclick();
  assert.equal(visit.run('LESSONS[task].number'), 30);
  assert.equal(picker.value, '5');
  assert.deepEqual(taskPickerNumbers(visit), [26, 27, 28, 29, 30]);
  await visit.run('selectDataset("2024-british-bulldog-3-4")');
  assert.match(picker.innerHTML, /lang="en">Picture clues · № 31–35/);
  assert.doesNotMatch(picker.innerHTML, /Holiday pictures/);
  await visit.run('selectDataset("2024-kit-4-5")');
  assert.match(picker.innerHTML, />Числовой ответ · № 19–21/);
  assert.equal(visit.element('taskSummaryTitle').lang, 'ru');
});

test('a direct link loads one edition and its fruit workspace and animations', async () => {
  const visit = app(false, null, {streamProduction: true, location: {hash: '#zadacha=2024-3-4/10'}});
  await syncTurn();
  assert.deepEqual(visit.fetched, ['editions/2024-3-4.js']);
  assert.match(visit.element('scene').innerHTML, /Аня/);
  assert.match(visit.run('checkFruitPreferences()'), /Заполни все клетки/);
  visit.run('(FRUIT_WORK.assignment = FRUIT_WORK_ROWS.map(index => [2, 4, 3, 1, 0][index]))');
  assert.match(visit.run('checkFruitAssignment()'), /Все условия выполнены/);
  visit.run('navigate(1)');
  assert.match(visit.element('scene').innerHTML, /Распределено фруктов/);
  await visit.run('selectDataset("2019-9-10")');
  assert.deepEqual(visit.fetched, ['editions/2024-3-4.js', 'editions/2019-9-10.js']);
  assert.match(visit.element('archiveLabel').textContent, /2019/);
  await visit.run('selectDataset("2024-3-4")');
  assert.equal(visit.fetched.length, 2);
});

test('account progress and rating sync across devices while guest progress stays separate', async () => {
  const account = {id: 17, username: 'Ученик'};
  let server = {revision: 0, progress: {current: '"2024-3-4/2"'}};
  let uploads = 0;
  const request = async (action, data, options) => {
    assert.equal(action, 'progress');
    assert.equal(options.accountId, account.id);
    if (data) {
      assert.equal(data.revision, server.revision);
      server = {revision: server.revision + 1, progress: {...server.progress, ...data.progress}};
      uploads++;
    }
    return server;
  };
  const session = new Map();
  const local = new Map();
  const first = accountBrowser(request, session, local);
  first.run('selectTask(3); current().selected=1; navigate(1)');
  first.account(account);
  await syncTurn();
  assert.equal(first.run('task'), 1);
  assert.equal(uploads, 0);
  first.run('current().selected=LESSONS[task].answer; navigate(lastStep())');
  await syncTurn();
  assert.equal(server.progress['rating:2024-3-4/2'], 'solved');
  assert.equal(JSON.parse(server.progress['2024-3-4/2']).seen, true);
  assert.equal(server.progress['2024-3-4/4'], undefined);

  const second = accountBrowser(request);
  second.account(account);
  await syncTurn();
  assert.equal(second.run('task'), 1);
  assert.equal(second.run('current().step === lastStep()'), true);
  assert.equal(second.element('profileRatingPoints').textContent, '3 балла');

  first.account(null);
  assert.equal(first.run('task'), 3);
  assert.equal(first.run('current().selected'), 1);
  assert.equal(first.element('profileSummary').textContent, 'Профиль');
  const guestReload = accountBrowser(request, session, local);
  assert.equal(guestReload.element('profileSummary').textContent, 'Профиль');
  guestReload.run('selectTask(1)');
  assert.equal(guestReload.run('current().selected'), null);
});

test('concurrent account edits preserve walkthrough completion and the first rating result', async () => {
  const account = {id: 18, username: 'Лиса'};
  let server = {revision: 0, progress: {}};
  let firstWrite = true;
  const visit = accountBrowser(async (_, data) => {
    if (!data) return server;
    if (firstWrite) {
      firstWrite = false;
      server = {revision: 1, progress: {
        '2024-3-4/1': '{"step":4,"selected":null,"seen":true,"reviewOpened":true}',
        'rating:2024-3-4/1': 'reviewed',
      }};
      throw Object.assign(new Error('Conflict'), {status: 409, payload: server});
    }
    assert.equal(data.revision, 1);
    server = {revision: 2, progress: {...server.progress, ...data.progress}};
    return server;
  });
  visit.account(account);
  await syncTurn();
  visit.run('current().selected=LESSONS[task].answer; navigate(1)');
  await syncTurn();
  assert.deepEqual(JSON.parse(server.progress['2024-3-4/1']), {step: 1, selected: 4, seen: true, reviewOpened: true});
  assert.equal(server.progress['rating:2024-3-4/1'], 'reviewed');
  assert.equal(visit.element('profileRatingPoints').textContent, '0 баллов');
  assert.match(visit.element('collectionProgress').textContent, /открыто ответов 1 из 24/);
});

test('previous account responses are ignored and pending offline work retries for its owner', async () => {
  const accountA = {id: 19, username: 'Первый'};
  const accountB = {id: 20, username: 'Другой'};
  let finishA;
  let signalA;
  let offline = true;
  let uploaded;
  const request = async (_, data, options) => {
    if (options.accountId === accountA.id) {
      signalA = options.signal;
      return new Promise(resolve => { finishA = resolve; });
    }
    if (offline) throw new Error('Offline');
    if (data) uploaded = data.progress;
    return {revision: data ? 1 : 0, progress: data?.progress ?? {}};
  };
  const visit = accountBrowser(request);
  visit.account(accountA);
  await syncTurn();
  visit.account(accountB);
  assert.equal(signalA.aborted, true);
  finishA({revision: 3, progress: {current: '"2024-3-4/7"'}});
  await syncTurn();
  assert.equal(visit.run('task'), 0);
  visit.run('selectTask(2); current().selected=LESSONS[task].answer; navigate(1)');
  offline = false;
  visit.online();
  await syncTurn();
  assert.equal(uploaded.current, '"2024-3-4/3"');
  assert.equal(uploaded['rating:2024-3-4/3'], 'solved');
  assert.equal(uploaded['2024-3-4/7'], undefined);
});

test('terminal save errors require an explicit retry and logout clears the local profile', async () => {
  const saved = new Map();
  let attempts = 0;
  let rejecting = true;
  const visit = accountBrowser(async (_, data) => {
    if (!data) return {revision: 0, progress: {}};
    attempts++;
    if (rejecting) throw Object.assign(new Error('Storage limit'), {status: 413});
    return {revision: 1, progress: data.progress};
  }, saved);
  visit.account({id: 10, username: 'Профиль'});
  await syncTurn();
  visit.run('current().selected = LESSONS[task].answer; navigate(1)');
  await syncTurn();
  assert.equal(visit.element('retryProgress').hidden, false);
  assert.equal(visit.element('profileRatingPoints').textContent, '0 баллов');
  visit.online();
  await syncTurn();
  assert.equal(attempts, 1);
  rejecting = false;
  visit.element('retryProgress').click();
  await syncTurn();
  assert.equal(attempts, 2);
  assert.equal(visit.element('profileRatingPoints').textContent, '3 балла');
  assert.equal(visit.element('retryProgress').hidden, true);
  assert.ok(saved.has('kenguru:account-progress:10'));
  visit.element('draftNotes').input({target: {value: 'Мои расчёты'}});
  assert.equal(visit.run('taskNotes.size'), 1);
  visit.account(null, {clearLocal: true});
  assert.equal(saved.has('kenguru:account-progress:10'), false);
  assert.equal(visit.run('taskNotes.size'), 0);
});

test('all grade 5–6 editions have original cards, verified keys and independent year navigation', () => {
  const grade = vm.createContext({});
  const files = [
    'lesson-visuals.js', 'years/grades-5-6-data.js', 'years/grade-5-6-keys.js',
    'years/grade-titles.js', 'years/grades-5-6.js',
  ];
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), grade);
  }
  const editions = grade.KENGURU_ARCHIVE;
  assert.deepEqual(Object.keys(editions).sort(), Array.from({length: 30}, (_, index) => `${1997 + index}-5-6`));
  const menu = app(true, editions);
  menu.run('selectDataset("2024-5-6")');
  assert.equal(menu.element('archiveLabel').textContent, '2024 · 5–6 классы');
  assert.equal(menu.element('gradePicker').disabled, false);
  menu.run('selectYear(2025)');
  assert.equal(menu.element('archiveLabel').textContent, '2025 · 5–6 классы');
  const expectedTitle = 'Недостающая деталь мозаики';
  assert.equal(menu.element('taskTitle').textContent, expectedTitle);
  assert.ok(menu.element('taskPicker').innerHTML.includes(`class="task-tab-name">${expectedTitle}</span>`));
  menu.run('selectYear(1997)');
  assert.equal(menu.element('archiveLabel').textContent, '1997 · 5–6 классы');
  assert.match(menu.element('answers').innerHTML, /<strong>B<\/strong>/);
  menu.run('navigate(1)');
  assert.match(menu.element('feedback').textContent, /Ответ B/u);
  menu.run('selectYear(2019); current().selected=0; navigate(1)');
  assert.match(menu.element('feedback').textContent, /совпал с официальным ответом/u);
  assert.match(menu.element('sceneText').textContent, /Две точки над тремя горизонтальными полосками/u);
  assert.match(menu.element('scene').innerHTML, /grade-key-figures\/2019-01.svg/);
  assert.equal(menu.element('play').hidden, true);
  menu.run('selectYear(2024); selectDataset("2024-3-4"); selectYear(2026)');
  assert.equal(menu.element('archiveLabel').textContent, '2026 · 3–4 классы');
  assert.equal(menu.element('play').hidden, false);

  let count = 0;
  let nativeCount = 0;
  let illustratedKeys = 0;
  for (const {year, lessons, scenes, answerLetters} of Object.values(editions)) {
    const groupSize = year === 2021 ? 8 : 10;
    assert.equal(lessons.length, groupSize * 3);
    assert.equal(answerLetters.join(''), year < 2008 ? 'ABCDE' : 'АБВГД');
    count += lessons.length;
    for (const [index, lesson] of lessons.entries()) {
      assert.equal(lesson.number, index + 1);
      assert.equal(lesson.points, 3 + Math.floor(index / groupSize));
      const verifyNativeKey = year >= 2010 && year <= 2020;
      assert.equal(lesson.officialValueKey, verifyNativeKey);
      assert.ok(Number.isInteger(lesson.answer) && lesson.answer >= 0 && lesson.answer < 5);
      assert.ok(fs.existsSync(path.join(root, 'dist', lesson.originalImage)), lesson.originalImage);
      assert.doesNotMatch(scenes[index](0), /answer-\d+/u);
      const checked = scenes[index](1);
      assert.doesNotMatch(checked, /undefined|NaN|Infinity|answer-\d+\.webp/u);
      if (verifyNativeKey) {
        const [text, letter, image] = grade.KENGURU_GRADE_KEYS[year][index];
        nativeCount += 1;
        assert.equal(answerLetters[lesson.answer], letter);
        assert.equal(lesson.steps.at(-1)[2], `Вариант ${letter}. ${text}`);
        if (image) {
          illustratedKeys += 1;
          assert.ok(checked.includes(image));
          assert.ok(!scenes[index](0).includes(image) || image.includes('/choice-'));
        } else assert.equal(checked, '');
      }
      for (const match of checked.matchAll(/href="(assets\/[^"]+)"/gu)) {
        assert.ok(fs.existsSync(path.join(root, 'dist', match[1])), match[1]);
      }
    }
  }
  assert.equal(count, 894);
  assert.equal(nativeCount, 330);
  assert.equal(illustratedKeys, 37);

  // Enabling the official grade must not award points after a prior review.
  menu.run(`selectDataset('2010-5-6');
    const oldPaperAttempt = new Map([['2010-5-6/1', '{"step":0,"selected":null,"seen":false,"reviewOpened":true}']]);
    activeProfileId = 'historical-account';
    accountProgress = {
      read: key => oldPaperAttempt.get(key),
      write: (key, value) => oldPaperAttempt.set(key, value),
    };
    current().selected = LESSONS[task].answer;`);
  assert.equal(menu.run('recordRatedTransition(1)'), 0);
  assert.equal(menu.run('oldPaperAttempt.get("rating:2010-5-6/1")'), 'reviewed');
  menu.run('selectTask(activeSet().indices[1]); current().selected = LESSONS[task].answer');
  assert.equal(menu.run('recordRatedTransition(1)'), 3);
});

test('rebuilt visual lessons keep the condition separate and each worked scene is usable', () => {
  const context = vm.createContext({});
  const files = [
    'lesson-visuals.js', 'years/grades-5-6-data.js', 'years/grade-conditions.js', 'years/grade-solution-steps.js', 'years/grade-5-6-keys.js',
    'years/visual-2000-five-six.js', 'years/visual-2024-three.js', 'years/visual-2024-four.js',
    'years/visual-2024-five.js', 'years/visual-2026-three.js', 'years/visual-2026-four.js',
    'years/visual-2026-five.js', 'years/grade-titles.js', 'years/grades-5-6.js',
  ];
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), context);
  const grade = context.KENGURU_ARCHIVE;
  const mirrorLesson = grade['2000-5-6'].lessons[0];
  const mirrorScene = grade['2000-5-6'].scenes[0];
  const clockPath = mirrorLesson.conditionImage;
  assert.ok(clockPath.endsWith('.svg'));
  assert.ok(mirrorScene(0, 0).includes(clockPath));
  for (let step = 0; step < mirrorLesson.steps.length; step++) {
    assert.ok(!mirrorScene(step, 0).includes(mirrorLesson.originalImage));
  }
  const clockArt = fs.readFileSync(path.join(root, 'dist', clockPath), 'utf8');
  assert.doesNotMatch(clockArt, /<image\b/iu, 'The mirrored clock must stay sharp when enlarged');
  const appView = app(true, grade);
  appView.run('selectDataset("2026-5-6")');
  assert.match(appView.element('question').textContent, /[а-яё]{3}/iu);
  assert.equal(appView.element('taskCondition').open, true);
  const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
  assert.match(html, /<div id="lessonScene"><div id="sceneWorkbench">/u);
  assert.equal(appView.element('answers').hidden, false);
  assert.equal(appView.element('play').hidden, false);
  assert.match(appView.element('taskPicker').innerHTML, /class="task-tab-name">Плитки на фотографии<\/span>/u);
  appView.run('selectTask(activeSet().indices.find(i => LESSONS[i].title === "Браслет Лены"))');
  assert.match(appView.element('taskPicker').innerHTML, /class="task-tab-name">Браслет Лены<\/span>/u);
  assert.doesNotMatch(appView.element('taskPicker').innerHTML, /повторяющуюся последовательность|Проверь соседство/u);

  for (const [year, limit] of [[2000, 10], [2024, 30], [2026, 30]]) {
    const edition = grade[year + '-5-6'];
    for (let index = 0; index < limit; index++) {
      const lesson = edition.lessons[index];
      const render = edition.scenes[index];
      const id = year + '/' + (index + 1);
      assert.ok(lesson.question && lesson.steps.length >= (year === 2000 ? 3 : 4), id);
      assert.equal(lesson.choices.length, 5, id);
      assert.equal(lesson.paperEdition, false, id);
      assert.doesNotMatch(render(0, 0), /grade-solution-steps|answer-\d+.webp/u, id);
      for (let step = 1; step < lesson.steps.length; step++) {
        assert.match(render(step, 8), /^<svg/u, id);
        assert.doesNotMatch(render(step, 8), /NaN|Infinity|undefined/u, id);
        assert.notEqual(render(step, 8), render(step - 1, 8), id);
      }
    }
  }

  for (const year of [2021, 2022, 2023, 2025]) {
    const edition = grade[year + '-5-6'];
    for (const [index, lesson] of edition.lessons.entries()) {
      assert.ok(lesson.question && lesson.steps.length >= 3);
      assert.doesNotMatch(edition.scenes[index](0, 0), /assets\/grades-5-6\//u);
    }
  }

  assert.equal(appView.run('LESSONS.length'), 1578);
  const namingGaps = appView.run(String.raw`LESSONS.filter(({title}) =>
    !title?.trim() || title.length > 30 || /^(?:Задача|Задание)\s*№?\s*\d+$/iu.test(title)
  ).map(lessonKey).join(",")`);
  assert.equal(namingGaps, '');
  assert.equal(grade['2000-5-6'].lessons[0].title, 'Часы в зеркале');
  assert.equal(appView.run('LESSONS.filter(item => !item.question?.trim()).map(lessonKey).join(",")'), '');
  for (const source of context.KENGURU_GRADES_5_6) {
    const edition = grade[source.id];
    for (const [index, lesson] of edition.lessons.entries()) {
      const [width, height] = source.cards[index];
      const fullCard = `<image href="${lesson.originalImage}" width="${width}" height="${height}"/>`;
      assert.ok(!edition.scenes[index](0, 0).includes(fullCard), edition.id + '/' + lesson.number);
    }
  }
  appView.run('selectTask(CATALOG.find(set => set.id === "1999-5-6").indices[26])');
  const options = appView.element('answers').innerHTML;
  assert.equal((options.match(/<img /gu) ?? []).length, 4);
  assert.match(options, /все площади равны/iu);
  assert.doesNotMatch(options, /src="null"/u);
});

test('the server catalogue matches the task answers and rating points', () => {
  const {buildRatingCatalog} = require('../scripts/build-rating-catalog.cjs');
  assert.equal(buildRatingCatalog(), fs.readFileSync(path.join(root, 'dist', 'api', 'rating-catalog.json'), 'utf8'));
});
