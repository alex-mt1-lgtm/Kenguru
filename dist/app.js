'use strict';
if(typeof FOUR_POINT_LESSONS!=='undefined')LESSONS.push(...FOUR_POINT_LESSONS);
if(typeof FIVE_POINT_LESSONS!=='undefined')LESSONS.push(...FIVE_POINT_LESSONS);
const CATALOG=[{id:'2024-3-4',year:2024,grades:[3,4],label:'3–4 классы',sources:{tasksUrl:'https://ipokengu.ru/public/task/kenguru_2024_class_3-4.pdf',answersUrl:'https://ipokengu.ru/public/task/kenguru_2024_answers.pdf',solutionUrl:'https://ipokengu.ru/public/task/kenguru_2024_solution.pdf'},indices:[]}];
LESSONS.forEach((lesson,i)=>{lesson.points=lesson.points||3;lesson.number=i+1;lesson.year=2024;lesson.datasetId='2024-3-4';lesson.originalImage=lesson.originalImage||`assets/original-${i+1}.png`;CATALOG[0].indices.push(i)});
const EXTRA_ARCHIVES=Object.values(globalThis.KENGURU_ARCHIVE||{}).flatMap(value=>Array.isArray(value)?value:[value]).filter(set=>set.year!==2024).sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id));
for(const set of EXTRA_ARCHIVES){const entry={...set,indices:[]};set.lessons.forEach((lesson,i)=>{entry.indices.push(LESSONS.length);LESSONS.push({...lesson,number:lesson.number??i+1,year:set.year,datasetId:set.id})});CATALOG.push(entry)}

const $=id=>document.getElementById(id),LETTERS=['А','Б','В','Г','Д'];
const CUTS=['M1 0V2H3V4','M0 4L4 0','M1 4V1H2V3H3V0','M0 1L4 3','M1 4V1H2V3H3V1H4'];
const CUT_DESCRIPTIONS = [
  'От верхнего края в одной клетке от левого угла: две клетки вниз, две вправо и две вниз.',
  'Прямая от нижнего левого угла до верхнего правого.',
  'От нижнего края в одной клетке от левого угла: три клетки вверх, одна вправо, две вниз, одна вправо и три вверх.',
  'Прямая от левого края в одной клетке от верха до правого края в трёх клетках от верха.',
  'От нижнего края в одной клетке от левого угла: три клетки вверх, одна вправо, две вниз, одна вправо, две вверх и одна вправо.',
];
const REGIONS=[[[0,0],[1,0],[1,2],[3,2],[3,4],[0,4]],[[0,0],[4,0],[0,4]],[[0,0],[3,0],[3,3],[2,3],[2,1],[1,1],[1,4],[0,4]],[[0,0],[4,0],[4,3],[0,1]],[[1,4],[1,1],[2,1],[2,3],[3,3],[3,1],[4,1],[4,4]]];
const ORANGE=[],GREEN=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++)((x===1&&y>=1)||(x===2&&y===3)||(x===3&&y>=1)?ORANGE:GREEN).push([x,y]);
const FOOTBALL=[1,4,7,10,2,5,8,11,3,6,9,1];
// Each row lists disjoint walkable platforms, from bottom to top.
const PLATFORMS=[[[0,95],[108,190],[207,300]],[[0,54],[73,111],[126,300]],[[0,54],[72,166],[190,300]],[[0,138],[163,300]],[[0,68],[86,145],[163,300]]];
// [lower level, lower x, upper x]; each ladder changes level by one.
const LADDERS=[[0,12,32],[0,72,92],[0,148,168],[0,228,248],[1,10,30],[1,80,100],[1,133,153],[1,259,279],[2,5,25],[2,235,255],[3,15,35],[3,98,118],[3,185,205]];
const FIRE_ROUTE=[[40,0],[72,0],[92,1],[80,1],[100,2],[153,2],[133,1],[259,1],[279,2],[235,2],[255,3],[185,3],[205,4],[280,4]];
const CUBE_HEIGHTS=[[2,2,4,1],[3,1,4,1],[3,1,2,3],[1,2,3,3],[2,1,4,2]],TARGET_HEIGHTS=[2,1,3,2];
const states=LESSONS.map(()=>({step:0,frame:0,elapsed:0,selected:null,seen:false}));
let task=0,playing=false,clock=null,lastTimestamp=null;
let selectedPoints=3,selectedDataset='2024-3-4';const groupLast={'2024-3-4:3':0,'2024-3-4:4':8,'2024-3-4:5':16},datasetLast={'2024-3-4':0};
const lessonKey = lesson => lesson.datasetId + '/' + lesson.number;
const taskHash = index => '#zadacha=' + lessonKey(LESSONS[index]);
const taskInUrl = () => LESSONS.findIndex((_, index) => taskHash(index) === globalThis.location?.hash);
const progressPrefix = 'kenguru:attempt:';

function startFreshAttemptOnArrival() {
  // A new tab can inherit a copy of its opener's sessionStorage. Keep work
  // only on refresh or history restoration, and start clean on a fresh visit.
  const navigation = globalThis.performance?.getEntriesByType?.('navigation')[0];
  if (navigation?.type !== 'navigate') return;
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) return;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(progressPrefix)) storage.removeItem(key);
    }
  } catch {
    // A browser without storage still supports an in-memory attempt.
  }
}

function readProgress(key) {
  try {
    return JSON.parse(globalThis.sessionStorage?.getItem(progressPrefix + key) ?? 'null');
  } catch {
    return null;
  }
}

function writeProgress(key, value) {
  try {
    globalThis.sessionStorage?.setItem(progressPrefix + key, JSON.stringify(value));
  } catch {
    // Progress from the current visit is still available in memory.
  }
}

function restoreProgress() {
  LESSONS.forEach((lesson, index) => {
    const saved = readProgress(lessonKey(lesson));
    if (!saved) return;
    const step = Number.isInteger(saved.step) && saved.step >= 0 && saved.step < lesson.steps.length ? saved.step : 0;
    const selected = Number.isInteger(saved.selected) && saved.selected >= 0 && saved.selected < lesson.choices.length ? saved.selected : null;
    Object.assign(states[index], {step, selected, seen: saved.seen === true});
  });
  workVariant = states[0].selected ?? 0;
}

function saveLessonProgress() {
  const key = lessonKey(LESSONS[task]);
  const {step, selected, seen} = current();
  // Repeating this task keeps its completed marker within this attempt.
  writeProgress(key, {step, selected, seen: seen || readProgress(key)?.seen === true});
}
const activeSet=()=>CATALOG.find(set=>set.id===selectedDataset);
function nextTaskIndex(){const indices=activeSet().indices;return indices[(indices.indexOf(task)+1)%indices.length]}
const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const FRAME_MS=600;
const current=()=>states[task];
const lastStep=(t=task)=>LESSONS[t].steps.length-1;
const svg=(inside,label,box='0 0 640 300')=>`<svg viewBox="${box}" role="img" aria-label="${label}">${inside}</svg>`;
const text=(x,y,s,cls='diagram-text')=>`<text x="${x}" y="${y}" class="${cls}">${s}</text>`;
const squareDescription = i => 'Квадрат 4 на 4 клетки. Линия разреза. ' + CUT_DESCRIPTIONS[i];
function square(i,fill=false,showGrid=true){return svg(`<rect width="4" height="4" fill="${fill?'#237e79':'#fffefa'}"/>${fill?`<polygon points="${REGIONS[i].map(p=>p.join(',')).join(' ')}" fill="#e9693e"/>`:''}${(showGrid?[1,2,3]:[]).map(n=>`<path class="grid-line" d="M${n} 0V4M0 ${n}H4"/>`).join('')}<path class="cut" d="${CUTS[i]}"/><rect class="outline" width="4" height="4"/>`,`Рисунок ${LETTERS[i]}. ${squareDescription(i)}`,'-.2 -.2 4.4 4.4')}
function areaScene(s,f){if(s===1)return svg(Array.from({length:16},(_,i)=>`<rect x="${200+i%4*53}" y="${20+Math.floor(i/4)*53}" width="51" height="51" rx="4" fill="#e5eee1"/>${text(225+i%4*53,52+Math.floor(i/4)*53,i+1)}`).join('')+text(305,270,'4 × 4 = 16 клеток'),'16 равных клеток в квадрате');if(s===4)return '<div class="result-figures">'+LETTERS.map((l,i)=>`<div>${square(i,true)}<b>${l}</b><span>${i===4?'7 и 9':'8 и 8'}</span></div>`).join('')+'</div>';
const comparison=s===3,phase=comparison?Math.min(f/5,1):0;let r='';[ORANGE,GREEN].forEach((a,g)=>a.forEach(([x,y],i)=>{const startX=210+x*48,startY=20+y*48,endX=70+i*54,endY=g?160:70;const xx=startX+(endX-startX)*phase,yy=startY+(endY-startY)*phase;r+=`<rect x="${xx}" y="${yy}" width="46" height="46" rx="4" fill="${g?'#237e79':'#e9693e'}"/>${text(xx+23,yy+29,i+1,'cell-number')}`}));return svg(r+text(315,270,comparison?'7 оранжевых · 9 зелёных · разница 2':'3 + 1 + 3 = 7 · 16 − 7 = 9'),'Оранжевая часть 7 клеток, зелёная 9 клеток')}
function fireScene(s,f){const X=x=>35+x*1.85,Y=y=>265-y*53;let out='';PLATFORMS.forEach((row,l)=>row.forEach(([a,b])=>out+=`<path d="M${X(a)} ${Y(l)}H${X(b)}" stroke="#172e34" stroke-width="9"/><path d="M${X(a)} ${Y(l)}H${X(b)}" stroke="#eab94e" stroke-width="5"/>`));function ladder(l,a,b,dead=false){const x1=X(a),y1=Y(l)-5,x2=X(b),y2=Y(l+1)+4;out+=`<path d="M${x1-5} ${y1}L${x2-5} ${y2}M${x1+5} ${y1}L${x2+5} ${y2}" stroke="${dead?'#9da49a':'#756248'}" fill="none" stroke-width="2"/>`;for(let t=.15;t<1;t+=.19){let x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;out+=`<path d="M${x-5} ${y}H${x+5}" stroke="#756248" stroke-width="1.6"/>`}}LADDERS.forEach(v=>ladder(...v));
// Original overhanging ladder ends do not connect to another platform.
out+=`<path d="M${X(10)} 292L${X(20)} 269M${X(107)} ${Y(2)-4}L${X(118)} ${Y(2)-27}M${X(205)} ${Y(2)+27}L${X(216)} ${Y(2)+4}" stroke="#9da49a" stroke-width="7" stroke-dasharray="2 4"/>`;
const motion=fireMotion(s,f);const path=motion.points;
if(path.length>1){out+=`<polyline id="fire-trail" points="${path.map(([x,y])=>`${X(x)},${Y(y)-7}`).join(' ')}" fill="none" stroke="#e9693e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`}
let n=0;for(let i=1;i<FIRE_ROUTE.length;i++)if(FIRE_ROUTE[i][1]!==FIRE_ROUTE[i-1][1]){n++;if(motion.distance>=FIRE_DISTANCES[i]-0.01)out+=text((X(FIRE_ROUTE[i][0])+X(FIRE_ROUTE[i-1][0]))/2+13,(Y(FIRE_ROUTE[i][1])+Y(FIRE_ROUTE[i-1][1]))/2,n,'route-number')}
const pos=path[path.length-1];out+=text(X(pos[0]),Y(pos[1])-15,'🧑‍🚒','figure-emoji')+text(X(282),Y(4)-12,'🔥','figure-emoji');return svg(out,`Пожарный движется по площадкам и лестницам. Пройдено ${motion.climbs} из 6 лестниц`)}
// Distances use rendered coordinates, so walking and climbing have the same speed.
const FIRE_DISTANCES=[0];for(let i=1;i<FIRE_ROUTE.length;i++){const a=FIRE_ROUTE[i-1],b=FIRE_ROUTE[i];FIRE_DISTANCES.push(FIRE_DISTANCES[i-1]+Math.hypot((b[0]-a[0])*1.85,(b[1]-a[1])*53))}
const FIRE_SPLIT=6,FIRE_SPEED=120;
function fireMotion(step,frame){const from=step>=3?FIRE_DISTANCES[FIRE_SPLIT]:0,to=step<2?0:step===2?FIRE_DISTANCES[FIRE_SPLIT]:FIRE_DISTANCES.at(-1);const distance=step===4?to:Math.min(to,from+Math.max(0,frame)*FRAME_MS/1000*FIRE_SPEED);const points=[FIRE_ROUTE[0].slice()];let climbs=0;
for(let i=1;i<FIRE_ROUTE.length;i++){const a=FIRE_ROUTE[i-1],b=FIRE_ROUTE[i];if(distance>=FIRE_DISTANCES[i]){points.push(b.slice());if(a[1]!==b[1])climbs++}else{const t=(distance-FIRE_DISTANCES[i-1])/(FIRE_DISTANCES[i]-FIRE_DISTANCES[i-1]);if(t>0)points.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);break}}return{points,distance,climbs}}

function tableScene(s,f){let out='',n=0;for(let y=0;y<4;y++)for(let x=0;x<7;x++){const rows=s>=1&&y<2,col=s>=2&&x===0,white=s>=3&&!rows&&!col;out+=`<rect x="${102+x*62}" y="${15+y*58}" width="59" height="55" rx="3" fill="${col?'#eab94e':rows?'#92c7a1':'#fffefa'}" stroke="#b7c8be"/>`;if(white){n++;if(s===4||n<=f*2)out+=text(131+x*62,50+y*58,n)}}return svg(out+text(320,285,s===0?'4 ряда × 7 столбцов = 28':s===1?'Закрашено 2 × 7 = 14':s===2?'В столбце только 2 новые клетки':'Осталось 2 × 6 = 12'),'Таблица 4 на 7. Два ряда и один столбец закрашены; 12 белых клеток')}
function footballScene(s,f){const pos=n=>{const a=Math.PI/2+(n-1)*2*Math.PI/11;return[320+115*Math.cos(a),140+115*Math.sin(a)]};const first=[0,0,1,5,10][s],last=[0,1,5,10,11][s];const progress=Math.min(last,first+Math.max(0,f)),count=Math.floor(progress),fraction=progress-count;let out='<circle cx="320" cy="140" r="115" fill="#edf3e8" stroke="#cedbcf"/>';
for(let i=1;i<=Math.ceil(progress);i++){const a=pos(FOOTBALL[i-1]),end=pos(FOOTBALL[i]),t=i<=count?1:fraction,b=[a[0]+(end[0]-a[0])*t,a[1]+(end[1]-a[1])*t];out+=`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="${i===11?'#e9693e':'#8ab4ac'}" stroke-width="${i===Math.ceil(progress)?4:1.5}"/>`}
for(let n=1;n<=11;n++){const [x,y]=pos(n),active=n===FOOTBALL[count];out+=`<circle cx="${x}" cy="${y}" r="15" fill="${active?'#e9693e':'#fffefa'}" stroke="#237e79"/>${text(x,y+5,n,active?'player-number active-number':'player-number')}`}
const a=pos(FOOTBALL[count]),b=pos(FOOTBALL[Math.min(count+1,11)]),ball=[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction];out+=text(ball[0],ball[1]-19,'⚽','figure-emoji')+text(520,160,fraction?'Мяч в полёте':'У №'+FOOTBALL[count],'diagram-text')+text(320,294,s===4?'Последний пас: 9 → 1':FOOTBALL.slice(0,count+1).join(' → '),'pass-sequence');return svg(out,`Передачи мяча: ${FOOTBALL.slice(0,count+1).join(', ')}`)}

function numbersScene(s,f){const nums=['4897','4898','4899'],visible=[[false,false,false,true],[false,true,true,true],[true,true,false,false]];let out='';for(let row=0;row<3;row++){const x0=60+row*195;for(let i=0;i<4;i++){let reveal=s>=3||(s===2&&row===2)||(s===1&&i===3);if(s===1&&row===2&&f<2)reveal=false;if(s===2&&row===2&&i>f)reveal=false;if(s===3&&!visible[row][i]&&row*2+i>f+2)reveal=false;const shown=visible[row][i]||reveal;out+=`<rect x="${x0+i*38}" y="95" width="34" height="60" rx="6" fill="${visible[row][i]?'#eaf0e6':'#d7edf2'}"/>${text(x0+i*38+17,136,shown?nums[row][i]:'?','digit')}`}if(row<2)out+=text(x0+166,132,'→')}if(s>=3)out+=text(320,205,'Каждый раз +1');if(s===4)out+=text(320,255,'Стёрто: 489 · 4 · 99','answer-equation');return svg(out,'Три последовательных числа: 4897, 4898, 4899. Стёрты 489, 4 и 99')}
function stickersScene(s,f){const prices=s<2||(s===2&&f<3)?[1,2,3]:[1,2,4];let out='';const icons=['★','♥','✿'];prices.forEach((p,i)=>{const x=95+i*185;out+=`<rect x="${x}" y="35" width="120" height="160" rx="22" fill="${['#f8e2b0','#dcebdd','#f8d9cb'][i]}"/><circle cx="${x+60}" cy="95" r="37" fill="#fffefa"/>${text(x+60,112,icons[i],'sticker-icon')}${text(x+60,170,s===0?'? руб.':p+' руб.','price')}`;if(s>=1)for(let c=0;c<p;c++)if(s!==1||c+i*2<=f)out+=`<circle cx="${x+23+c*24}" cy="220" r="10" fill="#eab94e" stroke="#ab812d"/>`});out+=text(320,280,s===0?'Три разные цены · всего 7 рублей':s===1?'1 + 2 + 3 = 6 · нужен ещё 1 рубль':s===2?'1 → 2: повтор · 2 → 3: повтор · 3 → 4: подходит':'1 + 2 + 4 = 7 рублей',s===2?'pass-sequence':'diagram-text');return svg(out,s===0?'Три наклейки, цены неизвестны':'Цены наклеек: '+prices.join(', ')+' рубля')}
const CUBE_COLUMN_NAMES=['Слева','В середине','Сзади','Справа'];
const CUBE_COLUMN_COLORS=['#236baf','#9b4fb1','#b65d19','#237e79'];
const CUBE_PHOTOS=[{w:161,h:171,points:[[31,101],[65,92],[100,14],[130,123]]},{w:160,h:171,points:[[30,64],[66,117],[100,14],[128,126]]},{w:163,h:130,points:[[31,19],[65,73],[97,38],[129,14]]},{w:164,h:138,points:[[32,91],[64,56],[98,14],[130,28]]},{w:149,h:155,points:[[30,90],[65,125],[97,14],[127,81]]}];
function cubeMarkers(points,focus=-1){return points.map(([x,y],i)=>`<g>${i===focus?`<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#c44f2d" stroke-width="3"/>`:''}<circle cx="${x}" cy="${y}" r="9" fill="${CUBE_COLUMN_COLORS[i]}"/><text x="${x}" y="${y+3.5}" text-anchor="middle" style="font:bold 10px Arial;fill:white">${i+1}</text></g>`).join('')}
function cubePhoto(option=-1,focus=-1){const meta=option<0?{w:165,h:143,points:[[30,65],[69,100],[101,14],[128,48]]}:CUBE_PHOTOS[option];return svg(`<image href="assets/${option<0?'cubes-remaining.png':'cubes-'+option+'.png'}" width="${meta.w}" height="${meta.h}"/>${cubeMarkers(meta.points,focus)}`,`${option<0?'Рисунок из условия':'Вариант '+LETTERS[option]}. ${CUBE_COLUMN_NAMES.map((name,i)=>`${name}: ${(option<0?TARGET_HEIGHTS:CUBE_HEIGHTS[option])[i]}`).join('; ')}`,`-5 -5 ${meta.w+10} ${meta.h+10}`)}
function cubeRemoval(progress){const t=Math.max(0,Math.min(1,progress)),ease=t*t*(3-2*t),dx=ease*95,dy=ease*95;return svg(`<image href="assets/cubes-4.png" width="149" height="155"/><path d="M65 0H126V44L96 55L65 44Z" fill="#fffefa"/><polygon points="66,44 96,35 124,44 96,53" fill="#aaa" stroke="#333" stroke-width="1.2"/><g transform="translate(${dx} ${dy})"><polygon points="66,12 96,3 124,12 96,21" fill="#f1c495" stroke="#b65d19" stroke-width="1.3"/><polygon points="66,12 96,21 96,53 66,44" fill="#e7ac79" stroke="#b65d19" stroke-width="1.3"/><polygon points="96,21 124,12 124,44 96,53" fill="#d58b52" stroke="#b65d19" stroke-width="1.3"/></g>`,t===1?'Из Д убран один верхний кубик. Осталось 2, 1, 3, 2 кубика в столбиках.':'Убираем только верхний кубик заднего столбика варианта Д','-5 -5 245 165')}
function cubeCountTable(option=-1,focus=-1,removed=false){return `<table class="cube-counts"><caption>Сколько кубиков в столбике?</caption><thead><tr><th scope="col">Сравниваем</th>${CUBE_COLUMN_NAMES.map((name,i)=>`<th scope="col"><span style="background:${CUBE_COLUMN_COLORS[i]}">${i+1}</span>${name}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">В условии</th>${TARGET_HEIGHTS.map((n,i)=>`<td class="${i===focus?'cube-needed':''}">${n}</td>`).join('')}</tr>${option<0?'':`<tr><th scope="row">${removed?'После удаления':'Вариант '+LETTERS[option]}</th>${(removed?TARGET_HEIGHTS:CUBE_HEIGHTS[option]).map((n,i)=>`<td class="${n<TARGET_HEIGHTS[i]?'cube-short':n>TARGET_HEIGHTS[i]?'cube-extra':'cube-match'} ${i===focus?'cube-focus':''}">${n}${n===TARGET_HEIGHTS[i]?'<small>совпало</small>':n<TARGET_HEIGHTS[i]?'<small>не хватает</small>':'<small>лишний</small>'}</td>`).join('')}</tr>`}</tbody></table>`}
function cubesScene(step,frame){if(step===0)return '<figure class="target-cubes"><img src="assets/cubes-target.png" alt="Рисунок из условия: оставшаяся конструкция и упавший кубик справа"><figcaption>Что осталось после падения кубика</figcaption></figure>';const option=step===1?-1:step<=5?step-2:4,focus=step===2||step===3?3:step===4?2:step===5?0:step===6?2:-1,progress=step===8?1:step===7?Math.min(frame/5,1):0,removed=progress===1;
const reference=`<section class="cube-photo-card"><h3>После падения · условие</h3>${cubePhoto(-1,focus)}</section>`,candidate=option<0?'':`<section class="cube-photo-card ${step<=5?'cube-rejected':'cube-candidate'}"><h3>${step<=5?'Проверяем ':''}Вариант ${LETTERS[option]}${step<=5?' · не подходит':removed?' · совпало':''}</h3>${step>=7?cubeRemoval(progress):cubePhoto(option,focus)}</section>`;
const rule=step===1?'Можно вернуть ровно 1 кубик. Другие кубики не переставляем.':step===2||step===3?'Справа нужно 2, а есть 1. Удаление кубика не может добавить недостающий.':step===4?'Сзади нужно 3, а есть 2. Удалением нельзя сделать столбик выше.':step===5?'Слева нужно 2, а есть 1. Удалением нельзя получить недостающий кубик.':step===6?'Три столбика совпадают. Сзади ровно один лишний кубик: 4 − 1 = 3.':removed?'Все четыре столбика совпали: 2 · 1 · 3 · 2.':'Убираем только оранжевый верхний кубик. Другие не двигаем.';
return `<div class="cube-walkthrough"><div class="cube-photo-pair ${option<0?'cube-reference-only':''}">${reference}${candidate}</div>${cubeCountTable(option,focus,removed)}<p class="cube-rule">${rule}</p>${step===8?'<p class="cube-verdict">А ✕ · Б ✕ · В ✕ · Г ✕ · <strong>Д ✓</strong></p>':''}</div>`}

function tilesScene(s,f){let out='';const show=s===0?0:s===1?Math.min(Math.floor(f),1):s===2?Math.min(Math.floor(f),2):s===3?Math.min(Math.floor(f),6):6;for(let y=0;y<8;y++)for(let x=0;x<11;x++){const hidden=x>=2&&x<9&&y>=1&&y<7,grey=(x+y)%2===0;out+=`<rect x="${110+x*36}" y="${4+y*34}" width="35" height="33" fill="${grey?'#9da9a5':'#fffefa'}" stroke="#c3cec5"/>`;if(hidden&&y>show)out+=`<rect x="${110+x*36}" y="${4+y*34}" width="36" height="34" fill="#f5dfb4"/>`}if(show===0)out+=text(308,145,'КЕНГУРУ 2024','poster-title');if(s>0)for(let y=1;y<=show;y++)out+=text(535,27+y*34,y%2?3:4,'row-count');out+=`<rect x="182" y="38" width="252" height="204" fill="none" stroke="#e9693e" stroke-width="2"/>`;out+=text(320,299,s===0?'Под плакатом: 6 рядов по 7 плиток':show===6?'3 + 4 + 3 + 4 + 3 + 4 = 21':'Открыто рядов: '+show);return svg(out,`Шахматный узор. Плакат закрывает 7 столбцов и 6 рядов. Открыто ${show} рядов`)}
const SCENES=[areaScene,fireScene,tableScene,footballScene,numbersScene,stickersScene,cubesScene,tilesScene];
if(typeof FOUR_POINT_SCENES!=='undefined')SCENES.push(...FOUR_POINT_SCENES);
if(typeof FIVE_POINT_SCENES!=='undefined')SCENES.push(...FIVE_POINT_SCENES);
for(const set of EXTRA_ARCHIVES)SCENES.push(...set.scenes);
// Keep live SVG nodes and only change their attributes/text. This avoids replacing
// the whole scene on every display frame and leaves the drawing layer untouched.
function patchNode(target,source){if(target.nodeType!==source.nodeType||target.nodeName!==source.nodeName){target.replaceWith(source.cloneNode(true));return}if(target.nodeType===3){if(target.nodeValue!==source.nodeValue)target.nodeValue=source.nodeValue;return}if(target.nodeType!==1)return;
for(const attr of Array.from(target.attributes))if(!source.hasAttribute(attr.name))target.removeAttribute(attr.name);for(const attr of Array.from(source.attributes))if(target.getAttribute(attr.name)!==attr.value)target.setAttribute(attr.name,attr.value);
const children=Array.from(source.childNodes);for(let i=0;i<children.length;i++){if(target.childNodes[i])patchNode(target.childNodes[i],children[i]);else target.appendChild(children[i].cloneNode(true))}while(target.childNodes.length>children.length)target.lastChild.remove()}
let lastScene='';
function renderScene(){const st=current(),frame=reducedMotion?sceneDuration(task,st.step)/FRAME_MS:st.frame;const markup=task===0&&st.step===0?squareWorkScene():task===9&&st.step===0?fruitWorkspaceScene():SCENES[task](st.step,frame);if(markup===lastScene)return;lastScene=markup;const container=$('scene');if(container.firstElementChild&&typeof document.createElement==='function'){const template=document.createElement('template');template.innerHTML=markup;if(template.content.childElementCount===1&&container.childElementCount===1)patchNode(container.firstElementChild,template.content.firstElementChild);else container.innerHTML=markup}else container.innerHTML=markup}

function renderButtons(id, attribute, markup) {
  const container = $(id);
  const focused = document.activeElement;
  const value = focused?.parentElement === container ? focused.getAttribute(attribute) : null;
  container.innerHTML = markup;
  if (value !== null && !container.hidden) {
    container.querySelector(`[${attribute}="${value}"]`)?.focus({preventScroll: true});
  }
}

function renderAnswers() {
  const st = current();
  const lesson = LESSONS[task];
  const illustrated = task === 0 || task === 6 || Boolean(lesson.choiceImages);
  $('answers').hidden = st.step !== 0;
  $('answers').className = 'answer-list' + (illustrated ? ' illustrated-answers' : '');
  const markup = lesson.choices.map((value, i) => {
    let description = value;
    let picture = '';
    if (task === 0) {
      description = squareDescription(i);
      picture = square(i, false, false);
    } else if (task === 6) {
      description = CUBE_COLUMN_NAMES.map((name, col) => name + ': ' + CUBE_HEIGHTS[i][col]).join(', ');
      picture = `<img src="assets/cubes-${i}.png" alt="">`;
    } else if (lesson.choiceImages) {
      picture = `<img src="${lesson.choiceImages[i]}" alt="">`;
    }
    const label = ('Выбрать ответ ' + LETTERS[i] + ': ' + description).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    return `<button class="answer ${st.selected === i ? 'selected' : ''}" data-answer="${i}" aria-label="${label}" aria-pressed="${st.selected === i}">
      ${picture}<strong>${LETTERS[i]}</strong>${illustrated ? '' : `<span>${value}</span>`}
    </button>`;
  }).join('');
  renderButtons('answers', 'data-answer', markup);
}

function pointsLabel(points){return points===5?'5 баллов':points+' балла'}
function renderPicker() {
  const set = activeSet();
  const {indices} = set;
  const group = indices.filter(index => LESSONS[index].points === selectedPoints);
  const years = [...new Set(CATALOG.map(item => item.year))].sort((a, b) => a - b);
  renderButtons('yearPicker', 'data-year', years.map(year =>
    `<button data-year="${year}" class="${year === set.year ? 'active-year' : ''}" aria-pressed="${year === set.year}">${year}</button>`
  ).join(''));

  const variants = CATALOG.filter(item => item.year === set.year);
  $('gradePicker').innerHTML = variants.map(item =>
    `<option value="${item.id}" ${item.id === selectedDataset ? 'selected' : ''}>${item.label}${item.grades.length > 1 ? ' · общий вариант' : ''}</option>`
  ).join('');
  $('gradePicker').disabled = variants.length === 1;
  $('edition').textContent = `${set.year} · ${set.label}`;
  $('archiveLabel').textContent = `КЕНГУРУ–${set.year} · ${set.label.toUpperCase()} · ${indices.length} ЗАДАЧ`;

  const levels = [3, 4, 5].map(points => ({points, count: indices.filter(i => LESSONS[i].points === points).length}));
  renderButtons('levelPicker', 'data-points', levels.filter(level => level.count).map(({points, count}) =>
    `<button data-points="${points}" aria-pressed="${selectedPoints === points}" class="${selectedPoints === points ? 'active-level' : ''}">${pointsLabel(points)} <span>${count} задач</span></button>`
  ).join(''));
  renderButtons('taskPicker', 'data-task', group.map(i => {
    const {number, short} = LESSONS[i];
    const active = i === task;
    return `<button class="task-tab ${active ? 'current-task' : ''}" data-task="${i}" ${active ? 'aria-current="page"' : ''}>
      <span>${String(number).padStart(2, '0')}</span>${short}${states[i].seen ? '<i aria-label="Ответ открыт">✓</i>' : ''}
    </button>`;
  }).join(''));
  $('collectionProgress').textContent = `${set.year}: открыто ответов ${indices.filter(i => states[i].seen).length} из ${indices.length} · Сейчас задачи на ${pointsLabel(selectedPoints)}`;
  $('archiveCount').textContent = LESSONS.length;
  $('tasksSource').href = set.sources.tasksUrl;
  $('answersSource').href = set.sources.answersUrl || set.sources.tasksUrl;
  $('solutionsSource').hidden = !set.sources.solutionUrl;
  $('solutionsSource').href = set.sources.solutionUrl || '';
  $('sourceNote').textContent = set.sources.solutionUrl
    ? 'Условия и ответы сверены с официальными материалами. Схемы и объяснения созданы для уроков.'
    : 'Условия и ответы сверены с официальным вариантом и ключом. Разборы подготовлены для уроков; в архиве этого года отдельный файл официальных решений не опубликован.';
}


function playLabel(){$('play').textContent=playing?'Ⅱ Пауза':task===6&&current().step===7?'▶ Убрать кубик':'▶ Смотреть';$('play').setAttribute('aria-label',playing?'Приостановить анимацию и показ':task===6&&current().step===7?'Убрать верхний кубик и проверить вариант Д':'Включить анимацию и автоматический показ');$('play').setAttribute('aria-pressed',String(playing));$('stage').classList.toggle('is-playing',playing);renderWorkspace()}
let alternativeTask=null;
function renderAlternative(){const section=$('alternative'),method=LESSONS[task].alternative,visible=!!method&&current().step===lastStep();section.hidden=!visible;if(!visible||alternativeTask!==task)section.open=false;alternativeTask=task;if(!visible)return;$('alternativeTitle').textContent=method.title;$('alternativeText').textContent=method.text;$('alternativeConclusion').textContent=method.conclusion;$('alternativeTable').innerHTML='<thead><tr>'+method.headings.map(heading=>`<th scope="col">${heading}</th>`).join('')+'</tr></thead><tbody>'+method.rows.map(([count,cells])=>`<tr><th scope="row">${count}</th><td>${cells}</td></tr>`).join('')+'</tbody>'}
function render() {
  const st = current();
  const lesson = LESSONS[task];
  const [chapter, title, explanation] = lesson.steps[st.step];
  const final = st.step === lastStep();
  const focused = document.activeElement;
  if (final) st.seen = true;
  $('taskNumber').textContent = String(lesson.number).padStart(2, '0');
  $('taskPoints').textContent = '/ НА ' + pointsLabel(lesson.points).toUpperCase();
  $('taskTitle').textContent = lesson.title;
  $('taskSkill').textContent = lesson.skill;
  $('question').textContent = lesson.question;
  $('questionNote').hidden = !lesson.questionNote;
  $('questionNote').textContent = lesson.questionNote ?? '';
  $('chapterTag').textContent = `ЗАДАЧА ${lesson.number} · ${chapter.toUpperCase()}`;
  $('counter').textContent = `0${st.step + 1} / ${String(lesson.steps.length).padStart(2, '0')}`;
  $('sceneTitle').textContent = title;
  $('sceneText').textContent = explanation;
  renderButtons('chapters', 'data-step', lesson.steps.map(([name], i) =>
    `<button data-step="${i}" class="${i === st.step ? 'active' : ''}" ${i === st.step ? 'aria-current="step"' : ''}><span>0${i + 1}</span>${name}</button>`
  ).join(''));
  renderScene();
  renderAnswers();
  renderPicker();
  renderWorkspace();
  renderAlternative();
  const feedback = $('feedback');
  const choice = st.selected === null ? '' : `Твой выбор — ${LETTERS[st.selected]}.`;
  if (st.step === 0) {
    feedback.textContent = choice ? choice + ' Проверим его в разборе.' : 'Выбери ответ. Затем нажми «Далее» и проверь своё решение.';
  } else if (final) {
    const result = st.selected === lesson.answer ? 'Верно! Твоё решение подтвердилось.' : choice;
    const answer = LETTERS[lesson.answer] + (task === 0 || task === 6 ? '' : ': ' + lesson.choices[lesson.answer]);
    feedback.textContent = [result, `Ответ ${answer}.`].filter(Boolean).join(' ');
  } else {
    feedback.textContent = 'Нажми «Смотреть», чтобы оживить схему. Пауза остановит и анимацию, и переходы.';
  }
  $('back').disabled = st.step === 0;
  $('next').hidden = final;
  $('nextTask').hidden = !final;
  $('nextTask').textContent = task === activeSet().indices.at(-1) ? 'К первой задаче года ↻' : 'Следующая задача →';
  if ((focused === $('next') && final) || (focused === $('nextTask') && !final) || (focused === $('back') && st.step === 0)) {
    $(final ? 'nextTask' : 'next').focus({preventScroll: true});
  }
  $('progress').style.width = ((st.step + 1) / lesson.steps.length * 100) + '%';
  $('original').src = lesson.originalImage;
  $('original').alt = `Оригинал задачи №${lesson.number}, Кенгуру–${lesson.year}, ${activeSet().label}`;
  playLabel();
}
function sceneDuration(t,s){if(s===0)return 1500;if(t>=8)return s===lastStep(t)?4500:6500;if(t===6)return s===7?4000:s===8?4200:6500;if(t===1&&(s===2||s===3)){const length=s===2?FIRE_DISTANCES[FIRE_SPLIT]:FIRE_DISTANCES.at(-1)-FIRE_DISTANCES[FIRE_SPLIT];return length/FIRE_SPEED*1000+400}if(t===3)return[0,1600,3000,3600,2600][s];if((t===0||t===6)&&s===3)return 3600;if(t===7)return[0,1800,2100,4200,2800][s];return s===4?3000:s===1?3000:4200}
function pause(){playing=false;if(clock!==null)cancelAnimationFrame(clock);clock=null;lastTimestamp=null;playLabel()}
function resetPosition(st){st.frame=0;st.elapsed=0}
function navigate(n){finishMark();pause();showTaskDrawing();current().step=Math.max(0,Math.min(lastStep(),n));resetPosition(current());render();saveLessonProgress()}
function selectTask(n, historyMethod = 'pushState') {
  if (!LESSONS[n]) return;
  finishMark();
  pause();
  task = n;
  const lesson = LESSONS[n];
  selectedPoints = lesson.points;
  selectedDataset = lesson.datasetId;
  groupLast[selectedDataset + ':' + selectedPoints] = n;
  datasetLast[selectedDataset] = n;
  const hash = taskHash(n);
  if (globalThis.location && location.hash !== hash) globalThis.history?.[historyMethod](null, '', hash);
  writeProgress('current', lessonKey(lesson));
  $('copyTaskStatus').textContent = '';
  $('newAttempt').href = hash;
  render();
}
function selectDataset(id){const set=CATALOG.find(item=>item.id===id);if(set)selectTask(datasetLast[id]??set.indices[0])}
function selectYear(year){const variants=CATALOG.filter(set=>set.year===year),last=variants.find(set=>datasetLast[set.id]!==undefined);if(variants.length)selectDataset((last||variants[0]).id)}
function animate(timestamp){if(!playing)return;const delta=lastTimestamp===null?0:Math.min(Math.max(0,timestamp-lastTimestamp),80);lastTimestamp=timestamp;const st=current();st.elapsed+=delta;st.frame=st.elapsed/FRAME_MS;renderScene();
if(st.elapsed>=sceneDuration(task,st.step)){if(st.step<lastStep()){st.step++;resetPosition(st);render();saveLessonProgress()}else{pause();render();return}}if(playing)clock=requestAnimationFrame(animate)}
function start(){finishMark();if(playing){pause();return}if(current().step===0&&current().selected===null){$('feedback').textContent='Сначала выбери свой ответ. Затем нажми «Далее» или «Смотреть».';return}if(current().elapsed>=sceneDuration(task,current().step))resetPosition(current());showTaskDrawing();playing=true;lastTimestamp=null;playLabel();clock=requestAnimationFrame(animate)}
$('yearPicker').addEventListener('click',e=>{const button=e.target.closest('[data-year]');if(button)selectYear(Number(button.dataset.year))});
$('gradePicker').addEventListener('change',()=>{const id=$('gradePicker').value;selectDataset(id)});
$('levelPicker').addEventListener('click',e=>{const button=e.target.closest('[data-points]');if(button){const points=Number(button.dataset.points);selectTask(groupLast[selectedDataset+':'+points]??activeSet().indices.find(i=>LESSONS[i].points===points))}});
$('taskPicker').addEventListener('click', e => {
  const button = e.target.closest('[data-task]');
  if (button) selectTask(Number(button.dataset.task));
});
$('chapters').addEventListener('click', e => {
  const button = e.target.closest('[data-step]');
  if (button) navigate(Number(button.dataset.step));
});
$('answers').addEventListener('click', e => {
  const button = e.target.closest('[data-answer]');
  if (!button) return;
  current().selected = Number(button.dataset.answer);
  if (task === 0) {
    workVariant = current().selected;
    renderScene();
    renderWorkspace();
  }
  renderAnswers();
  $('feedback').textContent = `Твой выбор — ${LETTERS[current().selected]}. Проверим его в разборе.`;
  saveLessonProgress();
});
$('copyTaskLink').onclick = async () => {
  const hash = taskHash(task);
  const url = new URL(hash, location.href);
  let message;
  try {
    await navigator.clipboard.writeText(url.href);
    message = 'Ссылка скопирована.';
  } catch {
    if (taskHash(task) !== hash) return;
    history.replaceState(null, '', hash);
    message = 'Скопируй ссылку из адресной строки.';
  }
  if (taskHash(task) === hash) $('copyTaskStatus').textContent = message;
};
$('next').onclick = () => navigate(current().step + 1);
$('back').onclick = () => navigate(current().step - 1);
$('nextTask').onclick = () => {
  selectTask(nextTaskIndex());
  $('taskTitle').focus?.();
  $('lesson').scrollIntoView?.({block: 'start'});
};
$('play').onclick = start;
$('repeat').onclick = () => {
  finishMark();
  pause();
  showTaskDrawing();
  if (task === 9) resetFruitWorkspace();
  Object.assign(current(), {step: 0, frame: 0, elapsed: 0, selected: null});
  render();
  saveLessonProgress();
};
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowRight') {e.preventDefault(); navigate(current().step + 1)}
  if (e.key === 'ArrowLeft') {e.preventDefault(); navigate(current().step - 1)}
  if (e.code === 'Space' && e.target === document.body) {e.preventDefault(); start()}
});
document.addEventListener('visibilitychange', () => {if (document.hidden) pause()});
globalThis.addEventListener?.('hashchange', () => {
  const linkedTask = taskInUrl();
  if (linkedTask !== -1) selectTask(linkedTask, 'replaceState');
});
setupWorkspace();
setupFruitWorkspace();
startFreshAttemptOnArrival();
restoreProgress();
const linkedTask = taskInUrl();
const recentTask = readProgress('current');
const recentIndex = LESSONS.findIndex(lesson => lessonKey(lesson) === recentTask);
selectTask(linkedTask === -1 ? Math.max(recentIndex, 0) : linkedTask, 'replaceState');
if (linkedTask !== -1) $('lesson').scrollIntoView?.({block: 'start'});
