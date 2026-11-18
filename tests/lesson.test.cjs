const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
function app(includeArchive=false,archiveOverride=null,browser={}){const elements=new Map(),handlers={},callbacks=new Map();let time=0,id=0;const element=name=>{if(!elements.has(name))elements.set(name,{innerHTML:'',textContent:'',hidden:false,disabled:false,value:name==='drawingColor'?'#e9693e':'',selectedIndex:0,style:{},attributes:{},classList:{toggle(){}},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,v){this[k]=v}});return elements.get(name)};const ctx={...browser,document:{body:{},getElementById:element,addEventListener(k,v){handlers[k]=v}},requestAnimationFrame(fn){callbacks.set(++id,fn);return id},cancelAnimationFrame(key){callbacks.delete(key)},console};vm.createContext(ctx);const scripts=['lessons.js','four-point-lessons.js','five-point-lessons.js','four-point-scenes.js','five-point-scenes.js',...(includeArchive?['legacy-catalog', 'legacy-editions', '2000-visual', '2000-three', '2000-four', '2000-five', 2000, 2020, 2021, 2022, 2023, 2025, 2026].map(year=>'years/'+year+'.js'):[]),'workspace.js','fruit-workspace.js','profile-rating.js','account-progress.js','app.js'];for(const f of scripts){if(f==='app.js'&&archiveOverride)ctx.KENGURU_ARCHIVE={...(ctx.KENGURU_ARCHIVE||{}),...archiveOverride};vm.runInContext(fs.readFileSync(path.join(root,'dist',f),'utf8'),ctx)}const tick=(ms=16)=>{time+=ms;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(time)};return{run:s=>vm.runInContext(s,ctx),element,tick,advance(ms){for(let left=ms;left>0;left-=16)tick(Math.min(16,left))},handlers}}

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
test('all three groups keep their place and the final task wraps to the first',()=>{const a=app();assert.equal(a.run('LESSONS.length'),24);assert.equal(a.run('SCENES.length'),24);for(const points of [4,5,3]){a.element('levelPicker').click({target:{closest:()=>({dataset:{points:String(points)}})}});assert.equal(a.run('selectedPoints'),points);assert.equal(a.run('LESSONS[task].points'),points);assert.equal((a.element('taskPicker').innerHTML.match(/data-task=/g)||[]).length,8)}a.run('selectTask(13);current().selected=1;navigate(3);selectTask(19)');a.element('levelPicker').click({target:{closest:()=>({dataset:{points:'4'}})}});assert.equal(a.run('task'),13);assert.equal(a.run('current().step'),3);assert.equal(a.run('current().selected'),1);a.run('selectTask(10);navigate(0)');assert.match(a.element('answers').innerHTML,/disks-option-4/);a.run('selectTask(22);navigate(0)');assert.match(a.element('answers').innerHTML,/cookie-choice/);a.run('selectTask(23);navigate(lastStep())');assert.match(a.element('nextTask').textContent,/К первой/);a.element('nextTask').onclick();assert.equal(a.run('task'),0);assert.equal(a.run('selectedPoints'),3)});
test('coin lesson finishes Tonya and Dima before offering an optional check',()=>{const a=app();a.run('selectTask(8)');assert.equal(a.run('LESSONS[8].steps.map(s=>s[0]).join(",")'),'Твой выбор,Правила,Тоня,Дима,Ответ');for(let s=0;s<4;s++){a.run(`navigate(${s})`);assert.equal(a.element('alternative').hidden,true);assert.doesNotMatch(a.element('scene').innerHTML,/все возможные итоги/)}a.run('navigate(4)');assert.equal(a.element('alternative').hidden,false);assert.equal(a.element('alternative').open,false);assert.match(a.element('alternativeTitle').textContent,/Другой способ/);assert.match(a.element('scene').innerHTML,/2 \+ 1 = 3/);assert.equal((a.element('alternativeTable').innerHTML.match(/scope="row"/g)||[]).length,5);a.element('alternative').open=true;a.run('selectTask(9)');assert.equal(a.element('alternative').hidden,true);assert.equal(a.element('alternative').open,false)});
test('fruit scheme begins blank and is filled by the learner, not by deduction order',()=>{const a=app();a.run('selectTask(9);navigate(0)');assert.equal(a.run('FRUIT_WORK.preferences.flat().filter(v=>v===null).length'),25);assert.equal(a.run('FRUIT_WORK.assignment.filter(v=>v===null).length'),5);assert.equal(a.run('FRUIT_WORK_ROWS.map(i=>FOUR_FRUIT_PEOPLE[i]).join(",")'),'Аня,Боря,Коля,Денис,Эльза');assert.equal((a.element('scene').innerHTML.match(/class="fruit-cell unknown"/g)||[]).length,25);assert.doesNotMatch(a.element('scene').innerHTML,/class="fruit-cell likes"/);assert.equal(a.element('drawingLayer').attributes['data-visible'],'false');assert.equal(a.element('drawingTools').hidden,true);a.element('scene').click({target:{closest:selector=>selector==='[data-fruit-row]'?{dataset:{fruitRow:'0',fruitColumn:'2'}}:null}});assert.equal(a.run('FRUIT_WORK.preferences[0][2]'),true);a.run('cycleFruitPreference(0,2)');assert.equal(a.run('FRUIT_WORK.preferences[0][2]'),false);a.run('cycleFruitPreference(0,2)');assert.equal(a.run('FRUIT_WORK.preferences[0][2]'),null);a.element('drawingWorkspace').open=true;a.run('navigate(1)');assert.equal(a.element('drawingLayer').attributes['data-visible'],'true')});
test('fruit checks reject incomplete, incorrect and repeated choices without completing the answer',()=>{const a=app();a.run('selectTask(9)');assert.match(a.run('checkFruitPreferences()'),/Заполни все/);a.run('FRUIT_WORK.preferences=Array.from({length:5},()=>Array(5).fill(true))');assert.match(a.run('checkFruitPreferences()'),/неточности/);assert.equal(a.run('FRUIT_WORK.preferences.flat().every(v=>v===true)'),true);a.run('FRUIT_WORK.preferences=FRUIT_WORK_ROWS.map(source=>FOUR_FRUITS.map((_,column)=>FOUR_FRUIT_PREFS[source].includes(column)))');assert.match(a.run('checkFruitPreferences()'),/соответствует/);assert.equal(a.run('current().selected'),null);assert.match(a.run('checkFruitAssignment()'),/всем пяти/);a.run('FRUIT_WORK.assignment=[2,0,3,4,4]');assert.match(a.run('checkFruitAssignment()'),/все взяли разное/);a.run('FRUIT_WORK.assignment=[0,2,3,4,1]');assert.match(a.run('checkFruitAssignment()'),/не любит/);a.run('FRUIT_WORK.assignment=[2,0,3,4,1]');assert.match(a.run('checkFruitAssignment()'),/Все условия выполнены/);assert.equal(a.run('current().selected'),null);a.run('selectTask(0);selectTask(9)');assert.equal(a.run('FRUIT_WORK.assignment.join(",")'),'2,0,3,4,1');a.element('repeat').onclick();assert.equal(a.run('FRUIT_WORK.assignment.every(v=>v===null)'),true);assert.equal(a.run('FRUIT_WORK.preferences.flat().every(v=>v===null)'),true)});
test('fruit dropdown keeps the selected value through rendering',()=>{const a=app();a.run('selectTask(9)');a.element('scene').change({target:{closest:()=>({dataset:{fruitPerson:'1'},value:'3'})}});assert.equal(a.run('FRUIT_WORK.assignment[1]'),3);assert.match(a.element('scene').innerHTML,/value="3" selected/);assert.equal(a.run('FRUIT_WORK.assignment.filter(v=>v!==null).length'),1)});

test('archive keeps original year sizes, local task numbers and official sources',()=>{const a=app(true);assert.equal(a.run('LESSONS.length'),684);assert.equal(a.run('SCENES.length'),684);assert.equal(a.run('CATALOG.map(s=>s.year).sort().join(",")'),Array.from({length:27},(_,i)=>2000+i).join(','));for(const [year,count] of [...Array.from({length:21},(_,i)=>[2000+i,26]),[2021,18],[2022,24],[2023,24],[2024,24],[2025,24],[2026,24]]){a.run(`selectYear(${year})`);assert.equal(a.run('activeSet().indices.length'),count);assert.equal(a.run('current().step'),0);assert.equal(a.element('gradePicker').disabled,true);assert.match(a.element('gradePicker').innerHTML,/3–4 классы/);assert.equal(a.element('tasksSource').href,`https://${year===2000?"files.mathkang.ru/old":"ipokengu.ru/public/task"}/kenguru_${year}_class_3-4.pdf`);assert.equal(a.element('solutionsSource').hidden,year<=2020);const indices=JSON.parse(a.run('JSON.stringify(activeSet().indices)'));for(let n=0;n<indices.length;n++)assert.equal(a.run(`LESSONS[${indices[n]}].number`),n+1);a.run(`selectTask(activeSet().indices.at(-1));navigate(lastStep())`);assert.equal(a.element('taskNumber').textContent,String(count).padStart(2,'0'));a.element('nextTask').onclick();assert.equal(a.run('LESSONS[task].number'),1);assert.equal(a.run('LESSONS[task].year'),year)}});
test('year navigation preserves answers, steps, point groups and drawings independently',()=>{const a=app(true);a.run('selectYear(2024);selectTask(0);current().selected=2;addMark({type:"pen",color:"#e9693e",points:[[220,30],[240,50]]});navigate(2);selectYear(2020)');assert.equal(a.run('current().selected'),null);assert.equal(a.run('getSheet().marks.length'),0);assert.equal((a.element('taskPicker').innerHTML.match(/data-task=/g)||[]).length,10);a.element('levelPicker').click({target:{closest:()=>({dataset:{points:'4'}})}});assert.equal(a.run('LESSONS[task].number'),11);a.run('current().selected=4;navigate(2);selectYear(2021)');assert.equal((a.element('taskPicker').innerHTML.match(/data-task=/g)||[]).length,6);a.run('selectYear(2020)');assert.equal(a.run('LESSONS[task].number'),11);assert.equal(a.run('current().selected'),4);assert.equal(a.run('current().step'),2);a.run('selectYear(2024)');assert.equal(a.run('task'),0);assert.equal(a.run('current().selected'),2);assert.equal(a.run('current().step'),2);a.run('navigate(0)');assert.equal(a.run('getSheet().marks.length'),1)});
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
  const storage = values => ({getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)});
  const visit = app(false, null, {
    KenguruAccount: {request}, AbortController, setTimeout, clearTimeout,
    sessionStorage: storage(records), localStorage: storage(local),
    addEventListener: (type, callback) => listeners.set(type, callback),
  });
  visit.account = user => listeners.get('kenguru:accountchange')({detail: {user}});
  visit.online = () => listeners.get('online')();
  return visit;
}

const syncTurn = () => new Promise(resolve => setImmediate(resolve));

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
