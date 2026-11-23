'use strict';
const streamedEditions = globalThis.KenguruEditions;
const CATALOG = [];
let EXTRA_ARCHIVES = [];

function applyChoiceLayout(lesson, layout) {
  if (!layout) return;
  lesson.choiceLayout = layout;
  lesson.conditionImage = layout.condition?.src;
  lesson.choices = layout.options.map(option => option.text ?? '');
  lesson.choiceImages = layout.options.map(option => option.image);
}

if (streamedEditions) {
  for (const [id, year, grades, label, numbers, ratingPoints, subject = 'math'] of globalThis.KENGURU_EDITION_INDEX) {
    const indices = numbers.map((number, offset) => LESSONS.push({
      number, datasetId: id, year, ratingPoints: Number(ratingPoints[offset]) || 0,
    }) - 1);
    CATALOG.push({id, year, grades, label, indices, subject});
  }
} else {
  if (typeof FOUR_POINT_LESSONS !== 'undefined') LESSONS.push(...FOUR_POINT_LESSONS);
  if (typeof FIVE_POINT_LESSONS !== 'undefined') LESSONS.push(...FIVE_POINT_LESSONS);
  const defaultSet = {id: '2024-3-4', year: 2024, grades: [3, 4], label: '3–4 классы', sources: {
    tasksUrl: 'assets/kenguru/kenguru_2024_class_3-4.pdf',
    answersUrl: 'assets/kenguru/kenguru_2024_answers.pdf',
    solutionUrl: 'assets/kenguru/kenguru_2024_solution.pdf',
  }, indices: []};
  LESSONS.forEach((lesson, index) => {
    Object.assign(lesson, {points: lesson.points || 3, number: index + 1, year: 2024,
      datasetId: defaultSet.id, originalImage: lesson.originalImage || `assets/original-${index + 1}.png`});
    defaultSet.indices.push(index);
  });
  CATALOG.push(defaultSet);
  EXTRA_ARCHIVES = Object.values(globalThis.KENGURU_ARCHIVE ?? {}).flat()
    .filter(set => set.id !== defaultSet.id).sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
    .concat(globalThis.MEDVEZHONOK_EDITIONS ?? [], globalThis.SUBJECT_EDITIONS ?? []);
  for (const set of EXTRA_ARCHIVES) {
    const indices = set.lessons.map((lesson, index) => LESSONS.push({
      ...lesson, number: lesson.number ?? index + 1, year: set.year, datasetId: set.id,
    }) - 1);
    CATALOG.push({...set, indices});
  }
  for (const lesson of LESSONS) applyChoiceLayout(lesson,
    globalThis.KENGURU_CHOICE_LAYOUTS?.[lesson.datasetId + '/' + lesson.number]);
}

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
let selectedDataset = '2024-3-4';
const datasetLast = {'2024-3-4': 0};
let browsedSection = null;
const lessonKey = lesson => lesson.datasetId + '/' + lesson.number;
const taskHash = index => '#zadacha=' + lessonKey(LESSONS[index]);
const taskInUrl = () => LESSONS.findIndex((_, index) => taskHash(index) === globalThis.location?.hash);
const progressPrefix = 'kenguru:attempt:';
let activeProfileId = '';
let accountProfile = null;
let accountProgress = null;
let accountResume = false;
let ratingAttempt = null;
let announcedSync = false;
let ready = false;
let queuedAccount;
const fruitByProfile = new Map();

function renderProfile() {
  const name = accountProfile?.name;
  $('profileSummary').textContent = name ?? 'Профиль';
  $('profileToggle').setAttribute('aria-label', name ? `Профиль: ${name}` : 'Профиль');
  renderRatingSummary();
}

function switchProfile(id, {resume = false, preferredTask = -1} = {}) {
  if (id === activeProfileId) return;
  finishMark();
  pause();
  fruitByProfile.set(activeProfileId, {...FRUIT_WORK});
  activeProfileId = id;
  const signedInProfile = id === accountProfile?.id;
  resetFruitWorkspace();
  if (fruitByProfile.has(id)) Object.assign(FRUIT_WORK, fruitByProfile.get(id));
  showTaskDrawing();
  workspaceTask = null;
  alternativeTask = null;
  for (const key of Object.keys(datasetLast)) delete datasetLast[key];
  lastSubjectTask.clear();
  restoreProgress();
  renderProfile();
  const position = signedInProfile || resume ? savedTaskIndex() : -1;
  const next = preferredTask >= 0 ? preferredTask : position >= 0 ? position : resume ? 0 : task;
  selectTask(next, 'replaceState', !signedInProfile);
  if ($('profileRatingDialog').open) renderRatingDialog();
}

function readProfileValue(profileId, key) {
  return profileId ? accountProgress?.read(key) : globalThis.sessionStorage?.getItem(progressPrefix + key);
}

function writeProfileValue(profileId, key, value, firstAnswer) {
  if (profileId) accountProgress?.write(key, value, firstAnswer);
  else globalThis.sessionStorage?.setItem(progressPrefix + key, value);
}

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
    return JSON.parse(readProfileValue(activeProfileId, key) ?? 'null');
  } catch {
    return null;
  }
}

function writeProgress(key, value) {
  try {
    writeProfileValue(activeProfileId, key, JSON.stringify(value));
  } catch {
    // Progress from the current visit is still available in memory.
  }
}

function savedTaskIndex(key = 'current') {
  const recent = readProgress(key);
  return LESSONS.findIndex(lesson => lessonKey(lesson) === recent);
}

function restoreProgress(changed) {
  LESSONS.forEach((lesson, index) => {
    if (!lesson.steps) return;
    if (changed && !changed.has(lessonKey(lesson))) return;
    Object.assign(states[index], {step: 0, frame: 0, elapsed: 0, selected: null, seen: false});
    const saved = readProgress(lessonKey(lesson));
    if (!saved) return;
    const step = Number.isInteger(saved.step) && saved.step >= 0 && saved.step < lesson.steps.length ? saved.step : 0;
    const selected = Number.isInteger(saved.selected) && saved.selected >= 0 && saved.selected < (Number.isInteger(lesson.numericAnswer) ? 1000000 : lesson.choices.length) ? saved.selected : null;
    Object.assign(states[index], {step, selected, seen: saved.seen === true});
  });
  workVariant = states[0].selected ?? 0;
}

function renderSyncStatus() {
  const {state: sync, code} = accountProgress?.status() ?? {};
  const notice = $('progressStatus');
  const retry = $('retryProgress');
  if (['sending', 'local', 'blocked'].includes(sync)) announcedSync = true;
  notice.textContent = !announcedSync ? '' :
    sync === 'sending' ? 'Прогресс пока на этом устройстве. Сохраняем в аккаунте…' :
    sync === 'local' ? 'Прогресс пока на этом устройстве. Повторим сохранение при подключении.' :
    sync === 'blocked' ? (code === 413 ? 'Сервер отклонил сохранение из-за размера данных. Изменения остаются в этой вкладке.' :
      'Не удалось сохранить прогресс в аккаунте. Изменения остаются в этой вкладке. Повтори сохранение.') :
    sync === 'saved' ? 'Прогресс сохранён в аккаунте.' : '';
  retry.hidden = sync !== 'blocked';
  if (!ratingAttempt) return;
  const awarded = ratingAttempt.reduce((sum, entry) =>
    sum + (accountProgress?.confirmedAward(entry.key) ? entry.points : 0), 0);
  const confirmed = ratingAttempt.map(entry => accountProgress?.confirmed(entry.key));
  $('ratingNotice').textContent = awarded ? `+${formatRatingPoints(awarded)} в рейтинг` :
    confirmed.every(value => value === 'solved') ? 'Баллы за эту задачу уже сохранены.' :
    confirmed.every(Boolean) ? 'Ответ проверен. Баллы за эту попытку не начислены.' :
    'Ответ ожидает подтверждения рейтинга.';

}

function refreshAccountProgress(changed) {
  renderSyncStatus();
  const resume = accountResume;
  if (activeProfileId !== accountProfile?.id || !changed.size) return;
  const currentChanged = changed.has(lessonKey(LESSONS[task]));
  if (currentChanged) {
    finishMark();
    pause();
  }
  restoreProgress(changed);
  const recent = resume && changed.has('current') ? savedTaskIndex() : -1;
  if (resume) accountResume = false;
  if (recent >= 0 && recent !== task) selectTask(recent, 'replaceState', false);
  else if (currentChanged) render();
  else renderPicker();
  renderRatingSummary();
  if ($('profileRatingDialog').open) renderRatingDialog();
}

function changeAccount({user, restored, clearLocal}) {
  if (!ready && streamedEditions) {
    queuedAccount = {user, restored, clearLocal};
    return;
  }
  const id = user ? `account:${encodeURIComponent(user.id)}` : '';
  if ((accountProfile?.id ?? '') === id) {
    if (user) {
      accountProfile.name = user.username;
      renderProfile();
    }
    return;
  }
  const previous = activeProfileId;
  const wasAccount = activeProfileId === accountProfile?.id;
  finishMark();
  accountProgress?.close({clear: clearLocal});
  accountProgress = null;
  accountProfile = null;
  ratingAttempt = null;
  announcedSync = false;
  renderSyncStatus();
  if (user) {
    accountProfile = {id, name: user.username};
    accountProgress = createAccountProgress(user, refreshAccountProgress);
    const preferredTask = restored ? linkedTask : -1;
    accountResume = preferredTask < 0;
    switchProfile(id, {preferredTask, resume: wasAccount});
    accountProgress.refresh();
  } else if (wasAccount) {
    switchProfile('', {resume: true});
  } else {
    renderProfile();
    if ($('profileRatingDialog').open) renderRatingDialog();
  }
  if (clearLocal && previous) {
    fruitByProfile.delete(previous);
    for (const drafts of [sheets, taskNotes]) {
      for (const key of drafts.keys()) if (key.startsWith(previous + ':')) drafts.delete(key);
    }
  }
}

function saveLessonProgress(index = task) {
  const key = lessonKey(LESSONS[index]);
  const {step, selected, seen} = states[index];
  const previous = readProgress(key);
  if (index === task && activeProfileId === accountProfile?.id) {
    accountResume = false;
    writeProgress('current', key);
  }
  // Keep the fact that the learner has seen the walkthrough even after a repeat.
  writeProgress(key, {
    step, selected,
    seen: seen || previous?.seen === true,
    reviewOpened: step > 0 || previous?.step > 0 || previous?.reviewOpened === true,
  });
}
const activeSet=()=>CATALOG.find(set=>set.id===selectedDataset);
const subjectOf = set => set.subject ?? 'math';
const subjectNames = {math: 'Математика', ru: 'Русский язык', 'british-bulldog': 'Английский язык',
  'golden-fleece': 'История и культура', kit: 'Информатика', chip: 'Окружающий мир'};
const compactSubject = {'british-bulldog': 'Английский', 'golden-fleece': 'История', chip: 'Окруж. мир'};
const lastSubjectTask = new Map();
const answerLetter=index=>(activeSet().answerLetters||LETTERS)[index];
function visibleTasks(set) {
  return set.indices.filter(i => !LESSONS[i].matching || LESSONS[i].matching.start === LESSONS[i].number);
}

function matchingParts() {
  const group = LESSONS[task].matching;
  return group ? activeSet().indices.filter(i => LESSONS[i].matching?.start === group.start) : [];
}

function nextTaskIndex(){const indices=visibleTasks(activeSet());return indices[(indices.indexOf(task)+1)%indices.length]}
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
function cubePhoto(option=-1,focus=-1){const meta=option<0?{w:165,h:143,points:[[30,65],[69,100],[101,14],[128,48]]}:CUBE_PHOTOS[option];return svg(`<image href="assets/${option<0?'cubes-remaining.svg':'cubes-'+option+'.svg'}" width="${meta.w}" height="${meta.h}"/>${cubeMarkers(meta.points,focus)}`,`${option<0?'Рисунок из условия':'Вариант '+LETTERS[option]}. ${CUBE_COLUMN_NAMES.map((name,i)=>`${name}: ${(option<0?TARGET_HEIGHTS:CUBE_HEIGHTS[option])[i]}`).join('; ')}`,`-5 -5 ${meta.w+10} ${meta.h+10}`)}
function cubeRemoval(progress){const t=Math.max(0,Math.min(1,progress)),ease=t*t*(3-2*t),dx=ease*95,dy=ease*95;return svg(`<image href="assets/cubes-4.svg" width="149" height="155"/><path d="M65 0H126V44L96 55L65 44Z" fill="#fffefa"/><polygon points="66,44 96,35 124,44 96,53" fill="#aaa" stroke="#333" stroke-width="1.2"/><g transform="translate(${dx} ${dy})"><polygon points="66,12 96,3 124,12 96,21" fill="#f1c495" stroke="#b65d19" stroke-width="1.3"/><polygon points="66,12 96,21 96,53 66,44" fill="#e7ac79" stroke="#b65d19" stroke-width="1.3"/><polygon points="96,21 124,12 124,44 96,53" fill="#d58b52" stroke="#b65d19" stroke-width="1.3"/></g>`,t===1?'Из Д убран один верхний кубик. Осталось 2, 1, 3, 2 кубика в столбиках.':'Убираем только верхний кубик заднего столбика варианта Д','-5 -5 245 165')}
function cubeCountTable(option=-1,focus=-1,removed=false){return `<table class="cube-counts"><caption>Сколько кубиков в столбике?</caption><thead><tr><th scope="col">Сравниваем</th>${CUBE_COLUMN_NAMES.map((name,i)=>`<th scope="col"><span style="background:${CUBE_COLUMN_COLORS[i]}">${i+1}</span>${name}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">В условии</th>${TARGET_HEIGHTS.map((n,i)=>`<td class="${i===focus?'cube-needed':''}">${n}</td>`).join('')}</tr>${option<0?'':`<tr><th scope="row">${removed?'После удаления':'Вариант '+LETTERS[option]}</th>${(removed?TARGET_HEIGHTS:CUBE_HEIGHTS[option]).map((n,i)=>`<td class="${n<TARGET_HEIGHTS[i]?'cube-short':n>TARGET_HEIGHTS[i]?'cube-extra':'cube-match'} ${i===focus?'cube-focus':''}">${n}${n===TARGET_HEIGHTS[i]?'<small>совпало</small>':n<TARGET_HEIGHTS[i]?'<small>не хватает</small>':'<small>лишний</small>'}</td>`).join('')}</tr>`}</tbody></table>`}
function cubesScene(step,frame){if(step===0)return '<figure class="target-cubes"><img src="assets/cubes-target.svg" alt="Рисунок из условия: оставшаяся конструкция и упавший кубик справа"><figcaption>Что осталось после падения кубика</figcaption></figure>';const option=step===1?-1:step<=5?step-2:4,focus=step===2||step===3?3:step===4?2:step===5?0:step===6?2:-1,progress=step===8?1:step===7?Math.min(frame/5,1):0,removed=progress===1;
const reference=`<section class="cube-photo-card"><h3>После падения · условие</h3>${cubePhoto(-1,focus)}</section>`,candidate=option<0?'':`<section class="cube-photo-card ${step<=5?'cube-rejected':'cube-candidate'}"><h3>${step<=5?'Проверяем ':''}Вариант ${LETTERS[option]}${step<=5?' · не подходит':removed?' · совпало':''}</h3>${step>=7?cubeRemoval(progress):cubePhoto(option,focus)}</section>`;
const rule=step===1?'Можно вернуть ровно 1 кубик. Другие кубики не переставляем.':step===2||step===3?'Справа нужно 2, а есть 1. Удаление кубика не может добавить недостающий.':step===4?'Сзади нужно 3, а есть 2. Удалением нельзя сделать столбик выше.':step===5?'Слева нужно 2, а есть 1. Удалением нельзя получить недостающий кубик.':step===6?'Три столбика совпадают. Сзади ровно один лишний кубик: 4 − 1 = 3.':removed?'Все четыре столбика совпали: 2 · 1 · 3 · 2.':'Убираем только оранжевый верхний кубик. Другие не двигаем.';
return `<div class="cube-walkthrough"><div class="cube-photo-pair ${option<0?'cube-reference-only':''}">${reference}${candidate}</div>${cubeCountTable(option,focus,removed)}<p class="cube-rule">${rule}</p>${step===8?'<p class="cube-verdict">А ✕ · Б ✕ · В ✕ · Г ✕ · <strong>Д ✓</strong></p>':''}</div>`}

function tilesScene(step, frame) {
  const revealLimit = [0, 1, 2, 6][step];
  const shown = revealLimit === undefined ? 6 : Math.min(Math.floor(frame), revealLimit);
  let drawing = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 11; col++) {
      const x = 110 + col * 36, y = 4 + row * 34;
      const grey = (col + row) % 2 === 0;
      drawing += `<rect x="${x}" y="${y}" width="35" height="33" fill="${grey ? '#9da9a5' : '#fffefa'}" stroke="#c3cec5"/>`;
      if (col >= 2 && col < 9 && row >= 1 && row < 7 && row > shown) {
        drawing += `<rect x="${x}" y="${y}" width="36" height="34" fill="#f5dfb4"/>`;
      }
    }
  }
  if (shown === 0) drawing += text(308,145,'КЕНГУРУ 2024','poster-title');
  drawing += '<rect x="182" y="38" width="252" height="204" fill="none" stroke="#e9693e" stroke-width="2"/>';
  if (step === 0) return svg(drawing, 'Шахматная мозаика. Часть плиток закрыта плакатом.');
  for (let row = 1; row <= shown; row++) drawing += text(535,27+row*34,row%2?3:4,'row-count');
  const caption = step === 1 ? 'Под плакатом: 6 рядов по 7 плиток'
    : shown === 6 ? '3 + 4 + 3 + 4 + 3 + 4 = 21' : 'Открыто рядов: ' + shown;
  return svg(drawing + text(320,299,caption), `Шахматная мозаика. Плакат закрывает 7 столбцов и 6 рядов. Открыто рядов: ${shown}.`);
}
const SCENES=[areaScene,fireScene,tableScene,footballScene,numbersScene,stickersScene,cubesScene,tilesScene];
if(typeof FOUR_POINT_SCENES!=='undefined')SCENES.push(...FOUR_POINT_SCENES);
if(typeof FIVE_POINT_SCENES!=='undefined')SCENES.push(...FIVE_POINT_SCENES);
for(const set of EXTRA_ARCHIVES)SCENES.push(...set.scenes);

async function loadEdition(id) {
  const set = CATALOG.find(entry => entry.id === id);
  const {edition, layouts, descriptions} = await streamedEditions.load(id);
  if (set.sources) return;
  const {indices} = set;
  const {sources, answerLetters, sections, titleLanguage} = edition;
  Object.assign(set, {sources, answerLetters, sections, titleLanguage});
  if (edition.fruitPuzzle) fruitPuzzle = edition.fruitPuzzle;
  for (const [offset, index] of indices.entries()) {
    const lesson = LESSONS[index];
    const key = lessonKey(lesson);
    Object.assign(lesson, edition.lessons[offset], {graphicDescriptions: descriptions[key]});
    applyChoiceLayout(lesson, layouts[key]);
    SCENES[index] = edition.scenes[offset] ?? SCENES[index];
  }
  restoreProgress(new Set(indices.map(index => lessonKey(LESSONS[index]))));
}
// Keep live SVG nodes and only change their attributes/text. This avoids replacing
// the whole scene on every display frame and leaves the drawing layer untouched.
function patchNode(target,source){if(target.nodeType!==source.nodeType||target.nodeName!==source.nodeName){target.replaceWith(source.cloneNode(true));return}if(target.nodeType===3){if(target.nodeValue!==source.nodeValue)target.nodeValue=source.nodeValue;return}if(target.nodeType!==1)return;
for(const attr of Array.from(target.attributes))if(!source.hasAttribute(attr.name))target.removeAttribute(attr.name);for(const attr of Array.from(source.attributes))if(target.getAttribute(attr.name)!==attr.value)target.setAttribute(attr.name,attr.value);
const children=Array.from(source.childNodes);for(let i=0;i<children.length;i++){if(target.childNodes[i])patchNode(target.childNodes[i],children[i]);else target.appendChild(children[i].cloneNode(true))}while(target.childNodes.length>children.length)target.lastChild.remove()}
let lastScene='';
function sceneMarkup(lesson, step, frame) {
  if (lesson.matching) return '';
  if (step !== 0) return SCENES[task](step, frame);
  if (task === 0) return squareWorkScene();
  if (task === 9) return fruitWorkspaceScene();
  if (lesson.choiceLayout) {
    const figure = lesson.choiceLayout.condition;
    if (figure?.items?.length) return conditionItemsMarkup(figure.items);
    return figure?.src
      ? `<svg class="legacy-scene" role="img" aria-label="${escapeAnswerText(figure.alt ?? 'Рисунок из условия задачи')}" viewBox="0 0 ${figure.width} ${figure.height}" style="max-width:${figure.width}px"><image href="${figure.src}" width="${figure.width}" height="${figure.height}"/></svg>`
      : '';
  }
  if (!lesson.question && lesson.legacyOriginal) return '';
  return SCENES[task](step, frame);
}
function renderScene() {
  const lesson = LESSONS[task];
  const st = current();
  const fullFrame = reducedMotion || (!playing && st.elapsed === 0 && lesson.showCompletedStep);
  const frame = fullFrame ? sceneDuration(task, st.step) / FRAME_MS : st.frame;
  const markup = sceneMarkup(lesson, st.step, frame);
  if (markup === lastScene) return;
  lastScene = markup;
  const container = $('scene');
  if (container.firstElementChild && typeof document.createElement === 'function') {
    const template = document.createElement('template');
    template.innerHTML = markup;
    if (template.content.childElementCount === 1 && container.childElementCount === 1) {
      patchNode(container.firstElementChild, template.content.firstElementChild);
      return;
    }
  }
  container.innerHTML = markup;
}

function renderButtons(id, attribute, markup) {
  const container = $(id);
  const focused = document.activeElement;
  const value = focused?.parentElement === container ? focused.getAttribute(attribute) : null;
  container.innerHTML = markup;
  if (value !== null && !container.hidden) {
    container.querySelector(`[${attribute}="${value}"]`)?.focus({preventScroll: true});
  }
}

function escapeAnswerText(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function linguisticMarkup(value) {
  return value.split(/(<\/?(?:em|strong|u)>)/g)
    .map((part, index) => index % 2 ? part : escapeAnswerText(part)).join('');
}

function choiceTextMarkup(value, presentation, formatted) {
  const text = formatted ? linguisticMarkup(formatted) : escapeAnswerText(value);
  if (presentation === 'mirror-letters') {
    return `<span class="choice-word">${[...value].map(letter =>
      `<span class="choice-mirror-horizontal">${escapeAnswerText(letter)}</span>`).join('')}</span>`;
  }
  return `<span${presentation ? ` class="choice-word choice-${presentation}"` : ''}>${text}</span>`;
}

function choiceImageMarkup(path, option, alt = '') {
  const rasterSize = option?.pixelWidth && option?.pixelHeight
    ? ` data-raster style="--choice-width:${option.pixelWidth}px;--choice-height:${option.pixelHeight}px"`
    : '';
  return `<img src="${escapeAnswerText(path)}" alt="${escapeAnswerText(alt)}"${rasterSize}>`;
}

function conditionItemsMarkup(items) {
  return '<div class="named-figures">' + items.map(({src, caption, alt}, index) => {
    const label = caption || 'Рисунок ' + (index + 1);
    return `<figure><button class="figure-thumbnail" type="button" data-condition-item="${index}" aria-haspopup="dialog"
      aria-label="${escapeAnswerText('Увеличить ' + label)}">${choiceImageMarkup(src, null, alt ?? '')}</button>
      <figcaption>${escapeAnswerText(label)}</figcaption></figure>`;
  }).join('') + '</div>';
}

function graphicAnswerDescription(lesson, index) {
  return lesson.graphicDescriptions?.[index]
    ?? globalThis.KENGURU_GRAPHIC_ANSWER_DESCRIPTIONS?.[lessonKey(lesson)]?.[index];
}

function renderMatching(lesson, step) {
  const parts = matchingParts();
  const rows = parts.map((i, offset) => {
    const part = LESSONS[i];
    const figure = part.choiceLayout.condition.items?.[0] ?? part.choiceLayout.condition;
    const label = 'Рисунок ' + (offset + 1);
    const options = part.choices.map((choice, n) => '<option value="' + n + '"' +
      (states[i].selected === n ? ' selected' : '') + '>' + answerLetter(n) + ' · ' + escapeAnswerText(choice) + '</option>');
    const control = step === 0
      ? '<select data-match="' + i + '" aria-label="' + label + ', выбери ответ"><option value="">Выбери ответ</option>' + options.join('') + '</select>'
      : '<span>' + (states[i].selected === null ? 'Ответ пропущен' : 'Твой выбор — ' + answerLetter(states[i].selected)) + '</span>';
    const solution = step === lastStep() || step === offset + 1
      ? '<strong>' + (offset + 1) + ' — ' + answerLetter(part.answer) + ' · ' + escapeAnswerText(part.choices[part.answer]) + '</strong>' : '';
    return '<div class="matching-item"><b>' + label + '</b><button class="figure-thumbnail" type="button" aria-haspopup="dialog" data-match-image="' + offset +
      '" aria-label="Увеличить рисунок ' + (offset + 1) + '"><img src="' + escapeAnswerText(figure.src) + '" alt="' +
      escapeAnswerText(figure.alt) + '"></button>' + control + solution + '</div>';
  });
  $('matchingAnswers').innerHTML = rows.join('');
}

function renderAnswers() {
  const st = current();
  const lesson = LESSONS[task];
  const options = lesson.choiceLayout?.options;
  const illustrated = task === 0 || task === 6 || Boolean(lesson.choiceImages?.some(Boolean)
    || options?.some(option => option.image));
  const numeric = Number.isInteger(lesson.numericAnswer);
  $('numericEntry').hidden = !numeric || st.step !== 0;
  if (numeric) $('numericAnswer').value = st.selected ?? '';
  $('matchingAnswers').hidden = !lesson.matching;
  if (lesson.matching) renderMatching(lesson, st.step);
  $('answers').hidden = Boolean(lesson.matching) || numeric || st.step !== 0;
  $('openChoiceZoom').hidden = !illustrated || Boolean(lesson.matching) || numeric;
  $('answers').className = 'answer-list' + (illustrated ? ' illustrated-answers' : '')
    + (options && illustrated ? ' separated-answers' : '');
  const markup = lesson.choices.map((value, i) => {
    const option = options?.[i];
    let description = graphicAnswerDescription(lesson, i) ?? option?.description ?? value;
    let picture = '';
    if (task === 0) {
      description = squareDescription(i);
      picture = square(i, false, false);
    } else if (task === 6) {
      description = CUBE_COLUMN_NAMES.map((name, col) => name + ': ' + CUBE_HEIGHTS[i][col]).join(', ');
      picture = `<img src="assets/cubes-${i}.svg" alt="">`;
    } else if (option?.image || lesson.choiceImages?.[i]) {
      picture = choiceImageMarkup(option?.image ?? lesson.choiceImages[i], option);
    }
    const label = escapeAnswerText('Выбрать ответ ' + answerLetter(i) + (description ? ': ' + description : ''));
    const visibleText = option ? option.text : picture ? '' : value;
    return `<button class="answer ${st.selected === i ? 'selected' : ''}" data-answer="${i}" aria-label="${label}" aria-pressed="${st.selected === i}">
      ${picture}<strong>${answerLetter(i)}</strong>${visibleText ? choiceTextMarkup(visibleText, option?.presentation, lesson.formattedChoices?.[i]) : ''}
    </button>`;
  }).join('');
  renderButtons('answers', 'data-answer', markup);
}

const taskPlural = new Intl.PluralRules('ru');
function pointsLabel(points, numeric = true) { return points ? formatRatingPoints(points) : numeric ? 'Числовой ответ' : 'Без баллов'; }

function splitTaskGroup(title, indices, language) {
  const groups = [];
  for (let start = 0; start < indices.length; start += 5) {
    groups.push({title, indices: indices.slice(start, start + 5), language});
  }
  return groups;
}

function taskGroups(set) {
  const {sections, titleLanguage} = set;
  const indices = visibleTasks(set);
  if (sections) {
    return sections.flatMap(({title, start}, index) => {
      const end = sections[index + 1]?.start ?? Infinity;
      const group = indices.filter(i => LESSONS[i].number >= start && LESSONS[i].number < end);
      return splitTaskGroup(title, group, titleLanguage);
    });
  }
  const numbers = indices.filter(i => Number.isInteger(LESSONS[i].numericAnswer));
  const choices = indices.filter(i => !Number.isInteger(LESSONS[i].numericAnswer));
  const points = [...new Set(choices.map(i => LESSONS[i].points))].sort((a, b) => a - b);
  const groups = points.flatMap(value => splitTaskGroup(pointsLabel(value), choices.filter(i => LESSONS[i].points === value)));
  return groups.concat(splitTaskGroup('Числовой ответ', numbers));
}

function taskNumberRange(indices) {
  const numbers = indices.map(i => LESSONS[i].number);
  if (numbers.length > 1 && numbers.every((number, index) => number === numbers[0] + index)) {
    return numbers[0] + '–' + numbers.at(-1);
  }
  return numbers.join(', ');
}

function renderTaskPicker(set) {
  const groups = taskGroups(set);
  const sectionPicker = $('taskSectionPicker');
  const sectionIndex = browsedSection ?? groups.findIndex(group => group.indices.includes(task));
  if (sectionPicker.getAttribute('data-edition') !== set.id) {
    sectionPicker.innerHTML = groups.map(({title, indices, language}, index) => {
      const lang = language ? ` lang="${escapeAnswerText(language)}"` : '';
      return `<option value="${index}"${lang}>${escapeAnswerText(title)} · № ${taskNumberRange(indices)}</option>`;
    }).join('');
    sectionPicker.setAttribute('data-edition', set.id);
  }
  sectionPicker.value = String(sectionIndex);

  const titleLang = set.titleLanguage ? ` lang="${escapeAnswerText(set.titleLanguage)}"` : '';
  renderButtons('taskPicker', 'data-task', groups[sectionIndex].indices.map(i => {
    const lesson = LESSONS[i];
    const {number, title} = lesson;
    const name = escapeAnswerText(title);
    const active = i === task;
    const seen = states[i].seen;
    return `<button class="task-tab ${active ? 'current-task' : ''}" data-task="${i}" aria-label="Задача ${number}. ${name}${seen ? '. Ответ открыт' : ''}" title="${name}" ${active ? 'aria-current="page"' : ''}>
      <span class="task-tab-number">${String(number).padStart(2, '0')}</span>
      <span class="task-tab-name"${titleLang}>${name}</span>${seen ? '<i aria-hidden="true">✓</i>' : ''}
    </button>`;
  }).join(''));
}

function renderPicker() {
  const set = activeSet();
  const {indices} = set;
  const yearPicker = $('yearPicker');
  const subject = subjectOf(set);
  const editions = CATALOG.filter(item => subjectOf(item) === subject);
  $('lessonPage').setAttribute('data-subject', subject);
  $('currentSubject').textContent = compactSubject[subject] ?? subjectNames[subject];
  $('sourceAdaptation').hidden = subject !== 'ru';
  $('editionToggle').setAttribute('data-subject', subject);
  $('subjectPicker').value = subject;
  if (!yearPicker.innerHTML || yearPicker.getAttribute('data-subject') !== subject) {
    const years = [...new Set(editions.map(item => item.year))].sort((a, b) => b - a);
    yearPicker.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
    yearPicker.setAttribute('data-subject', subject);
  }
  yearPicker.value = String(set.year);

  const variants = editions.filter(item => item.year === set.year)
    .sort((a, b) => a.grades[0] - b.grades[0] || a.grades.at(-1) - b.grades.at(-1));
  $('gradePicker').innerHTML = variants.map(item =>
    `<option value="${item.id}" ${item.id === selectedDataset ? 'selected' : ''}>${item.label}</option>`
  ).join('');
  $('gradePicker').disabled = variants.length === 1;
  $('gradeField').hidden = variants.length === 1;
  $('archiveLabel').textContent = `${set.year} · ${set.label}`;
  const firstGrade = set.grades[0];
  const lastGrade = set.grades.at(-1);
  const shortGrade = firstGrade === lastGrade ? String(firstGrade) : `${firstGrade}–${lastGrade}`;
  $('archiveShortLabel').textContent = `${set.year} · ${shortGrade}`;
  $('editionToggle').setAttribute('aria-label', `${subjectNames[subject]}, ${set.year} · ${set.label}. Выбрать предмет и выпуск`);
  const gradeGroup = ['1-2', '3-4', '5-6', '7-8', '9-11'][Math.min(4, Math.floor((firstGrade - 1) / 2))];
  const russianHash = set.year === 2025 ? 'russian' : 'russian-' + set.year;
  const archiveHash = subject === 'ru' ? russianHash : subject === 'math' ? 'grades-' + gradeGroup : subject;
  $('editionArchive').href = '/archive.html#' + archiveHash;
  $('allEditions').href = $('editionArchive').href;
  const visible = visibleTasks(set);
  const position = visible.indexOf(task);
  $('previousTaskShortcut').setAttribute('aria-disabled', String(position <= 0));
  $('nextTaskShortcut').setAttribute('aria-disabled', String(position === visible.length - 1));

  renderTaskPicker(set);
  $('collectionProgress').textContent = `открыто ответов ${indices.filter(i => states[i].seen).length} из ${indices.length}`;
  for (const [id, key] of [['tasksReader', 'tasksUrl'], ['answersReader', 'answersUrl'], ['solutionsReader', 'solutionUrl']]) {
    const link = $(id);
    const reader = set.sources.readers?.[key];
    link.hidden = !reader;
    link.href = reader || '';
  }
  $('tasksSource').href = set.sources.tasksUrl;
  $('tasksSource').textContent = set.sources.reviewedKey ? 'Исходный бланк в PDF' : 'Задания в PDF';
  $('answersSource').textContent = set.sources.reviewedKey ? 'Ответы редакции в PDF' : 'Ответы в PDF';
  $('answersSource').hidden = !set.sources.answersUrl;
  if (set.sources.answersUrl) $('answersSource').href = set.sources.answersUrl;
  $('solutionsSource').hidden = !set.sources.solutionUrl;
  $('solutionsSource').href = set.sources.solutionUrl || '';
  const illustrationSources = $('lessonIllustrationSources');
  const creditHref = illustrationCredits(set);
  illustrationSources.hidden = !creditHref;
  if (creditHref) illustrationSources.href = creditHref;

}


function playLabel(){$('play').textContent=playing?'Ⅱ Пауза':task===6&&current().step===7?'▶ Убрать кубик':'▶ Смотреть';$('play').setAttribute('aria-label',playing?'Приостановить анимацию и показ':task===6&&current().step===7?'Убрать верхний кубик и проверить вариант Д':'Включить анимацию и автоматический показ');$('play').setAttribute('aria-pressed',String(playing));$('stage').classList.toggle('is-playing',playing);renderWorkspace()}
let alternativeTask=null;
function renderAlternative(){const section=$('alternative'),method=LESSONS[task].alternative,visible=!!method&&current().step===lastStep();section.hidden=!visible;if(!visible||alternativeTask!==task)section.open=false;alternativeTask=task;if(!visible)return;$('alternativeTitle').textContent=method.title;$('alternativeText').textContent=method.text;$('alternativeConclusion').textContent=method.conclusion;$('alternativeTable').innerHTML='<thead><tr>'+method.headings.map(heading=>`<th scope="col">${heading}</th>`).join('')+'</tr></thead><tbody>'+method.rows.map(([count,cells])=>`<tr><th scope="row">${count}</th><td>${cells}</td></tr>`).join('')+'</tbody>'}
let shownConditionTask = -1;
function renderCondition(lesson, step) {
  const details = $('taskCondition');
  const question = $('question');
  const note = $('questionNote');
  const picture = $('conditionImage');
  const passage = $('readingPassage');
  const audio = $('listeningAudio');
  if (shownConditionTask !== task) {
    details.open = true;
    passage.open = true;
    if (audio.getAttribute?.('src') !== (lesson.audio ?? null)) {
      audio.pause?.();
      if (lesson.audio) audio.src = lesson.audio;
      else audio.removeAttribute?.('src');
      audio.load?.();
    }
  }
  const material = (lesson.context ?? '').split(/\n\s*\n/);
  const instruction = material.shift();
  const reading = material.join('\n\n');
  const lead = $('sectionInstruction');
  lead.hidden = !instruction || instruction === lesson.question;
  lead.textContent = instruction;
  passage.hidden = !reading;
  $('readingText').textContent = reading;
  lead.lang = $('readingText').lang = question.lang = $('answers').lang = lesson.language ?? 'ru';
  $('listeningBlock').hidden = !lesson.audio;
  shownConditionTask = task;

  if (lesson.formattedQuestion) question.innerHTML = linguisticMarkup(lesson.formattedQuestion);
  else question.textContent = lesson.question ?? '';
  question.hidden = !lesson.question;
  note.textContent = lesson.questionNote ?? '';
  note.hidden = !lesson.questionNote;

  const figure = lesson.choiceLayout?.condition;
  const source = !lesson.matching && step > 0 && !figure?.items?.length && (figure?.src ?? lesson.conditionImage);
  picture.hidden = !source;
  if (source && picture.getAttribute?.('src') !== source) {
    picture.src = source;
    picture.alt = figure?.alt ?? lesson.conditionAlt ?? 'Рисунок из условия задачи';
  }
  const pictures = $('conditionPictures');
  pictures.hidden = !step || Boolean(lesson.matching) || !figure?.items?.length;
  if (!pictures.hidden) {
    const markup = conditionItemsMarkup(figure.items);
    if (pictures.innerHTML !== markup) pictures.innerHTML = markup;
  }
}

function render() {
  const st = current();
  const lesson = LESSONS[task];
  const [chapter, title, explanation] = lesson.steps[st.step];
  const final = st.step === lastStep();
  const focused = document.activeElement;
  if (final) st.seen = true;
  $('taskNumber').textContent = String(lesson.number).padStart(2, '0');
  $('taskPoints').textContent = lesson.matching ? 'По ' + formatRatingPoints(lesson.points) + ' за пару' : pointsLabel(lesson.points, Number.isInteger(lesson.numericAnswer));
  const titleLanguage = activeSet().titleLanguage ?? 'ru';
  for (const id of ['taskTitle', 'taskSummaryTitle']) {
    $(id).textContent = lesson.title;
    $(id).lang = titleLanguage;
  }
  $('taskSummaryTitle').title = lesson.title;
  $('taskSkill').textContent = lesson.skill;
  $('taskSkill').hidden = !lesson.skill;
  renderCondition(lesson, st.step);
  $('chapterTag').textContent = chapter;
  $('counter').textContent = `${String(st.step + 1).padStart(2, '0')} / ${String(lesson.steps.length).padStart(2, '0')}`;
  $('sceneTitle').textContent = title;
  $('sceneTitle').hidden = st.step === 0 && title === 'Условие задачи';
  $('sceneText').textContent = explanation;
  $('sceneText').hidden = st.step === 0 && lesson.hideIntroText === true;
  arrangeOpeningScene(lesson, st.step);
  renderButtons('chapters', 'data-step', lesson.steps.map(([name], i) =>
    `<button data-step="${i}" class="${i === st.step ? 'active' : ''}" ${i === st.step ? 'aria-current="step"' : ''}><span>${String(i + 1).padStart(2, '0')}</span> ${name}</button>`
  ).join(''));
  renderScene();
  renderFigureControls(lesson, st.step);
  renderAnswers();
  renderPicker();
  renderWorkspace();
  renderAlternative();
  const feedback = $('feedback');
  const numeric = Number.isInteger(lesson.numericAnswer);
  const choice = st.selected === null ? '' : numeric ? `Твой ответ — ${st.selected}.` : `Твой выбор — ${answerLetter(st.selected)}.`;
  if (lesson.matching) {
    const parts = matchingParts();
    feedback.textContent = final ? 'Ответ: ' + parts.map((i, n) => (n + 1) + ' — ' + answerLetter(LESSONS[i].answer)).join(', ') + '.'
      : st.step === 0 ? 'Подбери ответ к каждому рисунку и нажми «Далее».' : '';
  } else if (st.step === 0) {
    const check = lesson.paperEdition ? ' Сверь его с официальным ключом.' : ' Проверим его в разборе.';
    feedback.textContent = numeric ? 'Введи целое число и нажми «Далее».' : choice ? choice + check : 'Выбери ответ. Затем нажми «Далее» и проверь своё решение.';
  } else if (final && numeric) {
    feedback.textContent = (st.selected === lesson.numericAnswer ? 'Верно! ' : choice + ' ') + 'Ответ: ' + lesson.numericAnswer + '.';
  } else if (final && lesson.officialValueKey) {
    feedback.textContent = Number.isInteger(lesson.answer) && st.selected === lesson.answer
      ? 'Твой выбор совпал с официальным ответом.' : choice;
  } else if (final && lesson.archiveAnswer) {
    feedback.textContent = [choice, 'В официальном ключе указан ответ ' + lesson.archiveAnswer + '. Этот результат не влияет на рейтинг.'].filter(Boolean).join(' ');
  } else if (final && lesson.keyConflict) {
    feedback.textContent = [choice, lesson.keyConflict].filter(Boolean).join(' ');
  } else if (final && lesson.acceptedAnswers) {
    const accepted = lesson.acceptedAnswers;
    const summary = accepted.length === lesson.choices.length ? 'Организатор засчитал любой вариант.'
      : 'Организатор засчитал варианты ' + accepted.map(answerLetter).join(', ') + '.';
    feedback.textContent = [accepted.includes(st.selected) ? 'Твой вариант засчитан.' : choice, summary].filter(Boolean).join(' ');
  } else if (final && lesson.answer === null) {
    feedback.textContent = [choice, 'Для этой задачи в официальном ключе нет ответа.'].filter(Boolean).join(' ');
  } else if (final) {
    const result = st.selected === lesson.answer ? 'Верно! Твоё решение подтвердилось.' : choice;
    const option = lesson.choiceLayout?.options[lesson.answer];
    const value = task === 0 || task === 6 ? '' : option?.description ?? lesson.choices[lesson.answer];
    const answer = answerLetter(lesson.answer) + (value ? ': ' + value : '');
    const punctuation = /[.!?]$/u.test(answer) ? '' : '.';
    feedback.textContent = [result, `Ответ ${answer}${punctuation}`].filter(Boolean).join(' ');
  } else if (lesson.author || lesson.guided) {
    feedback.textContent = '';
  } else {
    feedback.textContent = 'Нажми «Смотреть», чтобы оживить схему. Пауза остановит и анимацию, и переходы.';
  }
  $('play').hidden = Boolean(lesson.paperEdition);
  $('keyboardHint').hidden = Boolean(lesson.paperEdition);
  $('back').disabled = st.step === 0;
  $('next').hidden = final;
  $('nextTask').hidden = !final;
  $('nextTask').textContent = task === activeSet().indices.at(-1) ? 'К первой задаче года ↻' : 'Следующая задача →';
  if ((focused === $('next') && final) || (focused === $('nextTask') && !final) || (focused === $('back') && st.step === 0)) {
    $(final ? 'nextTask' : 'next').focus({preventScroll: true});
  }
  $('progress').style.width = ((st.step + 1) / lesson.steps.length * 100) + '%';
  $('sourceNote').textContent = `${activeSet().sources.contest ?? 'Кенгуру'} ${lesson.year} · ${activeSet().label} · задача №${lesson.number}`
    + (lesson.author ? ' · ' + lesson.author : '');
  playLabel();
}
function sceneDuration(t,s){if(s===0)return 1500;if(t>=8)return s===lastStep(t)?4500:6500;if(t===6)return s===7?4000:s===8?4200:6500;if(t===1&&(s===2||s===3)){const length=s===2?FIRE_DISTANCES[FIRE_SPLIT]:FIRE_DISTANCES.at(-1)-FIRE_DISTANCES[FIRE_SPLIT];return length/FIRE_SPEED*1000+400}if(t===3)return[0,1600,3000,3600,2600][s];if((t===0||t===6)&&s===3)return 3600;if(t===7)return[0,1800,2100,4200,2800][s];return s===4?3000:s===1?3000:4200}
function pause(){playing=false;if(clock!==null)cancelAnimationFrame(clock);clock=null;lastTimestamp=null;playLabel()}
function resetPosition(st){st.frame=0;st.elapsed=0}
function showLessonStep(step) {
  const parts = matchingParts();
  if (step > 0 && current().step === 0 && parts.some(i => states[i].selected === null)) {
    $('feedback').textContent = 'Выбери ответ для каждого рисунка.';
    if (playing) pause();
    return;
  }
  const awards = [];
  for (const index of parts.length ? parts : [task]) {
    const points = recordRatedTransition(step, index);
    if (points) awards.push({key: 'rating:' + lessonKey(LESSONS[index]), points});
    if (index === task) continue;
    states[index].step = step;
    if (step === lastStep()) states[index].seen = true;
    saveLessonProgress(index);
  }
  if (awards.length) ratingAttempt = awards;
  renderSyncStatus();
  current().step = step;
  resetPosition(current());
  render();
  saveLessonProgress();
}
function navigate(n){finishMark();pause();showTaskDrawing();showLessonStep(Math.max(0,Math.min(lastStep(),n)))}
let navigationRequest = 0;

function selectTask(n, historyMethod = 'pushState', savePosition = true) {
  if (!LESSONS[n]) return;
  const request = ++navigationRequest;
  const lesson = LESSONS[n];
  const activate = () => {
    if (request !== navigationRequest) return;
    $('lessonLoadStatus').textContent = '';
    const set = CATALOG.find(item => item.id === lesson.datasetId);
    const index = lesson.matching ? set.indices.find(i => LESSONS[i].number === lesson.matching.start) : n;
    activateTask(index, historyMethod, savePosition);
    if (streamedEditions && !ready) {
      ready = true;
      $('lessonPage').classList.remove('lesson-initializing');
      if (queuedAccount) changeAccount(queuedAccount);
      queuedAccount = undefined;
    }
  };
  if (lesson.steps) {
    activate();
    return;
  }
  pause();
  $('lessonLoadStatus').textContent = 'Загружаем задачу…';
  return loadEdition(lesson.datasetId).then(activate, () => {
    if (request !== navigationRequest) return;
    const status = $('lessonLoadStatus');
    status.textContent = 'Не удалось загрузить задачу. ';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Повторить';
    retry.addEventListener('click', () => selectTask(n, historyMethod, savePosition), {once: true});
    status.append(retry);
  });
}

function activateTask(n, historyMethod, savePosition) {
  finishMark();
  pause();
  if (n !== task && detailDialog.open) {
    detailOpener = null;
    detailDialog.close();
  }
  task = n;
  browsedSection = null;
  ratingAttempt = null;
  $('ratingNotice').textContent = '';
  const lesson = LESSONS[n];
  selectedDataset = lesson.datasetId;
  datasetLast[selectedDataset] = n;
  lastSubjectTask.set(subjectOf(activeSet()), n);
  const hash = taskHash(n);
  if (globalThis.location && location.hash !== hash) {
    const path = location.pathname ? location.pathname + location.search : '';
    globalThis.history?.[historyMethod](null, '', path + hash);
  }
  if (savePosition) {
    accountResume = false;
    writeProgress('current', lessonKey(lesson));
    writeProgress('current:' + subjectOf(activeSet()), lessonKey(lesson));
  }
  render();
}
function selectDataset(id) {
  const set = CATALOG.find(item => item.id === id);
  if (set) return selectTask(datasetLast[id] ?? set.indices[0]);
}
function selectYear(year) {
  const variants = CATALOG.filter(set => subjectOf(set) === subjectOf(activeSet()) && set.year === year);
  const {grades} = activeSet();
  const sameGrades = variants.find(set => set.grades.join('-') === grades.join('-'));
  const overlappingGrades = variants.find(set => set.grades.some(grade => grades.includes(grade)));
  const recent = variants.find(set => datasetLast[set.id] !== undefined);
  const edition = sameGrades ?? overlappingGrades ?? recent ?? variants[0];
  if (edition) return selectDataset(edition.id);
}
function animate(timestamp){if(!playing)return;const delta=lastTimestamp===null?0:Math.min(Math.max(0,timestamp-lastTimestamp),80);lastTimestamp=timestamp;const st=current();st.elapsed+=delta;st.frame=st.elapsed/FRAME_MS;renderScene();
if(st.elapsed>=sceneDuration(task,st.step)){if(st.step<lastStep()){showLessonStep(st.step+1)}else{pause();render();return}}if(playing)clock=requestAnimationFrame(animate)}
function start(){if(LESSONS[task].paperEdition)return;finishMark();if(playing){pause();return}if(current().step===0&&current().selected===null){$('feedback').textContent='Сначала выбери свой ответ. Затем нажми «Далее» или «Смотреть».';return}if(current().elapsed>=sceneDuration(task,current().step))resetPosition(current());showTaskDrawing();playing=true;lastTimestamp=null;playLabel();clock=requestAnimationFrame(animate)}
function closeEditionMenu() {
  $('editionMenu').open = false;
  $('editionToggle').focus?.();
}

$('subjectPicker').addEventListener('change', () => {
  const subject = $('subjectPicker').value;
  const first = CATALOG.find(set => subjectOf(set) === subject);
  if (!first) { location.assign('/archive.html#' + subject); return; }
  const saved = savedTaskIndex('current:' + subject);
  const savedSet = saved >= 0 && CATALOG.find(set => set.id === LESSONS[saved].datasetId);
  selectTask(lastSubjectTask.get(subject) ?? (savedSet && subjectOf(savedSet) === subject ? saved : first.indices[0]));
});
$('yearPicker').addEventListener('change', () => {
  const selected = selectYear(Number($('yearPicker').value));
  const closeSingleEdition = () => { if ($('gradePicker').disabled) closeEditionMenu(); };
  if (selected) selected.then(closeSingleEdition);
  else closeSingleEdition();
});
const detailDialog = $('detailZoom');
const detailViewport = $('detailViewport');
const detailMedia = $('detailMedia');
let detailGallery = [];
let detailIndex = 0;
let detailMagnified = false;
let detailSource = null;
let detailOpener = null;
let detailDrag = null;
let detailHeight = 0;

function illustrationCredits(set) {
  const subject = subjectOf(set);
  return subject === 'chip' || subject === 'golden-fleece' ? 'assets/' + subject + '/illustrations.html' : '';
}

function sceneHasFigures(markup) {
  return /<(?:img|svg)(?:\s|>)/i.test(markup) && !markup.includes('answer-key-scene');
}

function renderFigureControls(lesson, step) {
  const figure = lesson.choiceLayout?.condition;
  const named = (figure?.detailItems ?? figure?.items)?.length;
  const hasCondition = !lesson.matching && (named || figure?.src || lesson.conditionImage
    || task !== 9 && sceneHasFigures(step ? sceneMarkup(lesson, 0, 0) : lastScene));
  let hasScene = step > 0 && sceneHasFigures(lastScene);
  if (hasScene && hasCondition && $('scene').querySelectorAll) {
    const conditionSources = new Set(conditionDetailItems(lesson)
      .filter(item => item.src).map(item => new URL(item.detailSrc || item.src, document.baseURI).href));
    const sceneItems = detailSceneItems($('scene'), 'Схема разбора');
    hasScene = sceneItems.some(item => !item.src
      || !conditionSources.has(new URL(item.detailSrc || item.src, document.baseURI).href));
  }
  const conditionButton = $('openLegacyZoom');
  conditionButton.hidden = !hasCondition;
  const label = named > 1 ? 'Увеличить рисунки' : 'Увеличить рисунок';
  conditionButton.textContent = hasScene ? label + ' условия' : label;
  $('openSceneZoom').hidden = !hasScene;
}

function detailSceneItems(container, label, lesson = LESSONS[task]) {
  const graphics = Array.from(container.querySelectorAll('svg:not(.answer-key-scene), img[src]'))
    .filter(node => !node.parentElement?.closest('svg'));
  const condition = lesson.choiceLayout?.condition;
  const sources = [condition, ...(condition?.items ?? []), ...(lesson.choiceLayout?.options ?? [])];
  const masters = new Map(sources.filter(item => item?.detailSrc).map(item => [
    new URL(item.src ?? item.image, document.baseURI).href, item.detailSrc,
  ]));
  return graphics.map((node, index) => {
    const title = graphics.length === 1 ? label : label + ' ' + (index + 1);
    const alt = node.getAttribute('aria-label') ?? node.getAttribute('alt') ?? label;
    const image = node.firstElementChild;
    const resource = node.localName === 'img' ? node.currentSrc || node.getAttribute('src')
      : node.matches('.legacy-scene, .worked-scene') && node.childElementCount === 1 && image.localName === 'image'
        ? image.getAttribute('href') : null;
    if (resource) return {title, alt, src: resource, detailSrc: masters.get(new URL(resource, document.baseURI).href),
      preview: node.localName === 'img' ? node : null, width: image?.width?.baseVal?.value, height: image?.height?.baseVal?.value};
    return {title, alt, svg: node};
  });
}

function conditionDetailItems(lesson) {
  const figure = lesson.choiceLayout?.condition;
  const items = figure?.detailItems ?? figure?.items;
  const thumbnails = current().step ? $('conditionPictures') : $('scene');
  if (items?.length) return items.map((item, index) => ({
    ...item, title: item.caption || 'Рисунок ' + (index + 1),
    preview: figure.detailItems ? null : thumbnails.querySelector(`[data-condition-item="${index}"] img`),
  }));
  const title = 'Рисунок к задаче ' + lesson.number;
  const src = figure?.src ?? lesson.conditionImage;
  if (src) return [{src, detailSrc: figure?.detailSrc, title,
    alt: figure?.alt ?? lesson.conditionAlt ?? 'Рисунок из условия задачи'}];
  if (!current().step) return detailSceneItems($('scene'), title);
  const template = document.createElement('template');
  template.innerHTML = sceneMarkup(lesson, 0, 0);
  return detailSceneItems(template.content, title);
}

function isVectorDetail(src) {
  return /^(?:data:image\/svg\+xml[;,])|\.svg(?:[?#]|$)/i.test(src);
}

function detailPreviewSize(item) {
  if (item.svg) {
    const {width, height} = item.svg.viewBox.baseVal;
    return {width, height, maxScale: Infinity};
  }
  return {
    width: item.preview?.naturalWidth || item.pixelWidth || item.width,
    height: item.preview?.naturalHeight || item.pixelHeight || item.height,
    // A master keeps the same crop. Its preview gives the aspect ratio, not the pixel limit.
    maxScale: item.detailSrc || isVectorDetail(item.src) ? Infinity : 1.5,
  };
}

function setDetailFrameHeight(height, viewportChanged = false) {
  const multi = detailGallery.length > 1;
  if (multi && detailHeight && !viewportChanged) return;
  const controlsHeight = detailDialog.offsetHeight - detailViewport.offsetHeight;
  if (multi) {
    const availableWidth = Math.max(1, detailViewport.clientWidth - 16);
    const heights = detailGallery.map(item => {
      if (!item.src && !item.svg) return 0;
      const {width, height, maxScale} = detailPreviewSize(item);
      if (!(width > 0 && height > 0)) return 850;
      return Math.ceil(height * Math.min(availableWidth / width, maxScale)) + 18;
    });
    height = Math.max(height, ...heights);
  }
  detailHeight = height + controlsHeight;
  detailDialog.style.setProperty('--detail-height', detailHeight + 'px');
}

function resizeDetail(recenter = false, viewportChanged = false) {
  if (!detailDialog.open || !detailSource) return;
  const {width, height, vector} = detailSource;
  const previous = detailMedia.getBoundingClientRect();
  const viewport = detailViewport.getBoundingClientRect();
  const zoomCenter = detailMagnified ? detailGallery[detailIndex]?.zoomCenter : null;
  const focusX = recenter || !previous.width ? zoomCenter?.x ?? .5 : (viewport.left + viewport.width / 2 - previous.left) / previous.width;
  const focusY = recenter || !previous.height ? zoomCenter?.y ?? .5 : (viewport.top + viewport.height / 2 - previous.top) / previous.height;
  // Measure the area without scrollbars. Both the inset and the first view keep the entire frame visible.
  detailViewport.dataset.panning = 'false';
  if (detailGallery.length === 1 && !vector && width <= 220) {
    detailDialog.style.setProperty('--detail-width', '480px');
  }
  const fitByWidth = Math.min(Math.max(1, detailViewport.clientWidth - 16) / width, vector ? Infinity : 1.5);
  const preferredHeight = Math.max(104, Math.ceil(height * fitByWidth) + 18);
  setDetailFrameHeight(preferredHeight, viewportChanged);
  const fit = Math.min(fitByWidth, Math.max(1, detailViewport.clientHeight - 16) / height);
  const scale = detailMagnified ? Math.min(vector ? Infinity : 2, fit * 2) : fit;
  detailMedia.style.width = Math.max(1, Math.floor(width * scale)) + 'px';
  detailMedia.style.height = Math.max(1, Math.floor(height * scale)) + 'px';
  const scrollable = detailMagnified && (width * scale + 16 > detailViewport.clientWidth
    || height * scale + 16 > detailViewport.clientHeight);
  detailViewport.dataset.panning = String(scrollable);
  if (scrollable) {
    detailViewport.scrollLeft = 8 + focusX * detailMedia.offsetWidth - detailViewport.clientWidth / 2;
    detailViewport.scrollTop = 8 + focusY * detailMedia.offsetHeight - detailViewport.clientHeight / 2;
  }
  const scaleButton = $('detailScale');
  scaleButton.disabled = false;
  scaleButton.textContent = detailMagnified ? 'Целиком' : 'Крупнее';
  const sizeHint = !vector && scale > 1 ? 'Исходник ' + width + ' × ' + height + ' пикс.' : '';
  const panHint = scrollable ? 'Перемещай рисунок' : '';
  $('detailHint').textContent = sizeHint || panHint;
}

function showDetailSvg(node, alt) {
  const clone = node.cloneNode(true);
  const descendants = [clone, ...clone.querySelectorAll('*')];
  const ids = new Map(descendants.filter(child => child.id).map(child => [child.id, 'detail-copy-' + child.id]));
  for (const child of descendants) {
    if (child.id) child.id = ids.get(child.id);
    child.removeAttribute('tabindex');
    for (const attr of Array.from(child.attributes)) {
      let value = attr.value.replace(/url\(#([^)]+)\)/g, (match, id) => ids.has(id) ? 'url(#' + ids.get(id) + ')' : match);
      if (attr.localName === 'href' && value.startsWith('#') && ids.has(value.slice(1))) value = '#' + ids.get(value.slice(1));
      if (value !== attr.value) attr.value = value;
    }
  }
  clone.setAttribute('role', 'img');
  clone.setAttribute('aria-label', alt);
  clone.removeAttribute('aria-labelledby');
  clone.removeAttribute('aria-describedby');
  const {width, height} = clone.viewBox.baseVal;
  if (!width || !height) return false;
  detailMedia.replaceChildren(clone);
  detailSource = {width, height, vector: true};
  resizeDetail(true);
  return true;
}

function loadDetailImage(item, src, fallback) {
  const img = document.createElement('img');
  img.id = 'detailImage';
  img.alt = item.alt ?? '';
  img.draggable = false;
  detailMedia.hidden = true;
  detailMedia.replaceChildren(img);
  img.addEventListener('load', () => {
    if (!detailDialog.open || !img.isConnected) return;
    detailSource = {width: img.naturalWidth, height: img.naturalHeight,
      vector: isVectorDetail(img.currentSrc)};
    if (detailSource.width && detailSource.height) {
      detailMedia.hidden = false;
      resizeDetail(true);
    }
  });
  img.addEventListener('error', () => {
    if (!detailDialog.open || !img.isConnected) return;
    if (fallback) loadDetailImage(item, fallback);
    else {
      detailMedia.hidden = true;
      $('detailError').hidden = false;
    }
  });
  img.src = src;
}

function showDetail(index) {
  if (index < 0 || index >= detailGallery.length) return;
  if (document.activeElement === $('detailScale')) {
    $(index < detailIndex ? 'detailPrev' : 'detailNext').focus({preventScroll: true});
  }
  detailIndex = index;
  detailSource = null;
  detailMagnified = false;
  detailViewport.dataset.panning = 'false';
  detailViewport.dataset.text = 'false';
  detailViewport.scrollLeft = detailViewport.scrollTop = 0;
  detailMedia.style.width = detailMedia.style.height = '';
  detailMedia.hidden = false;
  const item = detailGallery[index];
  $('detailTitle').textContent = item.title;
  $('detailCaption').innerHTML = item.src ? item.text ?? '' : '';
  $('detailNavigation').hidden = detailGallery.length < 2;
  $('detailCount').textContent = (index + 1) + ' / ' + detailGallery.length;
  $('detailPrev').setAttribute('aria-disabled', String(index === 0));
  $('detailNext').setAttribute('aria-disabled', String(index === detailGallery.length - 1));
  $('detailHint').textContent = '';
  $('detailScale').disabled = true;
  $('detailScale').textContent = 'Крупнее';
  $('detailError').hidden = true;
  if (detailGallery.length > 1) setDetailFrameHeight(104);
  detailMedia.replaceChildren();
  if (item.svg && showDetailSvg(item.svg, item.alt)) return;
  if (item.src) {
    loadDetailImage(item, item.detailSrc || item.src, item.detailSrc !== item.src ? item.src : null);
  } else if (item.text) {
    detailMedia.innerHTML = item.text;
    detailViewport.dataset.text = 'true';
    setDetailFrameHeight(detailMedia.offsetHeight + 18);
  } else {
    detailMedia.hidden = true;
    $('detailError').hidden = false;
  }
}

function openDetail(items, index, opener) {
  if (!items[index] || detailDialog.open) return;
  if (playing) pause();
  detailHeight = 0;
  detailDialog.style.removeProperty('--detail-height');
  detailDialog.style.removeProperty('--detail-width');
  detailGallery = items;
  detailOpener = opener;
  const noun = opener.id === 'openChoiceZoom' ? 'вариант' : 'рисунок';
  $('detailPrev').setAttribute('aria-label', 'Предыдущий ' + noun);
  $('detailNext').setAttribute('aria-label', 'Следующий ' + noun);
  const credit = $('detailCredit');
  const creditHref = illustrationCredits(activeSet());
  credit.hidden = !current().step || !creditHref;
  if (!credit.hidden) credit.href = creditHref;
  $('detailTitle').textContent = items[index].title;
  detailDialog.showModal();
  showDetail(index);
}

$('detailRetry').onclick = () => {
  showDetail(detailIndex);
  $('detailClose').focus();
};
detailDialog.addEventListener('close', () => {
  if (detailDialog.open) return;
  detailMedia.replaceChildren();
  detailSource = null;
  detailGallery = [];
  detailDrag = null;
  detailOpener?.focus({preventScroll: true});
  detailOpener = null;
});
detailDialog.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey
      || (event.target === detailViewport && detailViewport.dataset.panning === 'true')) return;
  const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
  if (direction && detailGallery.length > 1) {
    event.preventDefault();
    showDetail(detailIndex + direction);
  }
});
$('detailPrev').onclick = () => showDetail(detailIndex - 1);
$('detailNext').onclick = () => showDetail(detailIndex + 1);
$('detailScale').onclick = () => {
  detailMagnified = !detailMagnified;
  resizeDetail(true);
};
detailViewport.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0 || detailViewport.dataset.panning !== 'true'
      || !detailMedia.contains(event.target)) return;
  event.preventDefault();
  detailDrag = {x: event.clientX + detailViewport.scrollLeft, y: event.clientY + detailViewport.scrollTop};
  detailViewport.setPointerCapture(event.pointerId);
  detailViewport.focus({preventScroll: true});
});
detailViewport.addEventListener('pointermove', event => {
  if (!detailDrag) return;
  detailViewport.scrollLeft = detailDrag.x - event.clientX;
  detailViewport.scrollTop = detailDrag.y - event.clientY;
});
detailViewport.addEventListener('lostpointercapture', () => { detailDrag = null; });
globalThis.addEventListener?.('resize', () => resizeDetail(false, true));

$('openLegacyZoom').onclick = () => openDetail(conditionDetailItems(LESSONS[task]), 0, $('openLegacyZoom'));
$('openSceneZoom').onclick = () => openDetail(detailSceneItems($('scene'), 'Схема разбора'), 0, $('openSceneZoom'));
for (const id of ['stage', 'conditionPictures']) {
  $(id).addEventListener('click', event => {
    const button = event.target.closest('[data-condition-item]');
    if (button) openDetail(conditionDetailItems(LESSONS[task]), Number(button.dataset.conditionItem), button);
  });
}
$('openChoiceZoom').onclick = () => {
  const lesson = LESSONS[task];
  const items = lesson.choices.map((value, index) => {
    const option = lesson.choiceLayout?.options[index];
    const title = 'Вариант ' + answerLetter(index);
    if (task === 0) return {title, alt: squareDescription(index), svg: $('answers').querySelector(`[data-answer="${index}"] svg`)};
    const src = task === 6 ? 'assets/cubes-' + index + '.svg' : option?.image ?? lesson.choiceImages?.[index];
    const caption = option ? option.text : src ? '' : value;
    const preview = src ? $('answers').querySelector(`[data-answer="${index}"] img`) : null;
    return {title, src, preview, detailSrc: option?.detailSrc, pixelWidth: option?.pixelWidth, pixelHeight: option?.pixelHeight, text: caption
      ? choiceTextMarkup(caption, option?.presentation, lesson.formattedChoices?.[index]) : '',
      alt: graphicAnswerDescription(lesson, index) ?? option?.description ?? caption ?? title};
  });
  openDetail(items, current().selected ?? 0, $('openChoiceZoom'));
};
$('gradePicker').addEventListener('change', () => {
  selectDataset($('gradePicker').value);
  closeEditionMenu();
});

const compactNavigation = globalThis.matchMedia?.('(max-width: 850px)');
function arrangeOpeningScene(lesson, step) {
  if (!compactNavigation) return;
  const belowChoices = compactNavigation.matches && step === 0 && Boolean(lesson?.question);
  const scene = $('lessonScene');
  const draft = $('drawingWorkspace');
  const controls = $('draftControls');
  const openingDraft = $('openingDraftControls');
  const title = $('sceneTitle');
  const explanation = $('sceneText');
  const paper = $('draftBoard');
  const focused = document.activeElement;

  if (belowChoices) {
    if (draft.parentElement !== openingDraft) {
      openingDraft.before(title, explanation);
      openingDraft.append(draft);
      openingDraft.after(paper);
    }
    // The first task has the same squares on its answer buttons and in its scratch workspace.
    if (task === 0 || lesson.openingFigure) {
      if (scene.parentElement !== $('lessonSupplement')) paper.before(scene);
      if (controls.nextElementSibling !== $('stage')) $('stage').before(controls);
    } else {
      if (scene.parentElement === $('lessonSupplement')) $('openChoiceZoom').before(scene);
      if (controls.previousElementSibling !== $('stage')) $('stage').after(controls);
    }
  } else if (draft.parentElement !== controls) {
    if (scene.parentElement === $('lessonSupplement')) $('openChoiceZoom').before(scene);
    scene.before(title, explanation);
    controls.prepend(draft);
    $('sceneWorkbench').prepend(controls);
    $('sceneWorkbench').append(paper);
  }
  if (focused !== document.activeElement) focused?.focus({preventScroll: true});
}

function arrangeNavigation() {
  const compact = compactNavigation.matches;
  $('chapterNavigation').open = !compact;
  $(compact ? 'chapterSlot' : 'lessonAside').append($('chapterNavigation'));
  arrangeOpeningScene(LESSONS[task], current().step);
}
if (compactNavigation) {
  arrangeNavigation();
  compactNavigation.addEventListener('change', arrangeNavigation);
}

function selectAdjacentTask(offset) {
  const indices = visibleTasks(activeSet());
  const destination = indices[indices.indexOf(task) + offset];
  if (destination !== undefined) return selectTask(destination);
}
$('previousTaskShortcut').onclick = () => selectAdjacentTask(-1);
$('nextTaskShortcut').onclick = () => selectAdjacentTask(1);

$('taskSectionPicker').addEventListener('change', event => {
  browsedSection = Number(event.target.value);
  renderTaskPicker(activeSet());
});
$('taskPicker').addEventListener('click', async e => {
  const button = e.target.closest('[data-task]');
  if (!button) return;
  await selectTask(Number(button.dataset.task));
  $('taskNavigation').open = false;
  $('taskNavigationToggle').focus();
});
$('chapters').addEventListener('click', e => {
  const button = e.target.closest('[data-step]');
  if (!button) return;
  navigate(Number(button.dataset.step));
  if (compactNavigation?.matches && e.detail > 0) {
    $('chapterNavigation').open = false;
    $('lessonPlayer').scrollIntoView({block: 'start'});
  }
});
$('matchingAnswers').addEventListener('change', event => {
  const select = event.target.closest('[data-match]');
  if (!select || current().step !== 0) return;
  const index = Number(select.dataset.match);
  states[index].selected = select.value === '' ? null : Number(select.value);
  saveLessonProgress(index);
});
$('matchingAnswers').addEventListener('click', event => {
  const button = event.target.closest('[data-match-image]');
  if (!button) return;
  const gallery = matchingParts().map((i, n) => {
    const figure = LESSONS[i].choiceLayout.condition;
    const image = figure.detailItems?.[0] ?? figure.items?.[0] ?? figure;
    return {...image, title: 'Рисунок ' + (n + 1)};
  });
  openDetail(gallery, Number(button.dataset.matchImage), button);
});
$('numericAnswer').addEventListener('input', event => {
  if (!Number.isInteger(LESSONS[task].numericAnswer) || current().step !== 0) return;
  const value = event.target.value.trim();
  current().selected = /^\d{1,6}$/.test(value) ? Number(value) : null;
  $('feedback').textContent = value && current().selected === null ? 'Введи целое число от 0 до 999999.' : '';
  saveLessonProgress();
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
  const followUp = LESSONS[task].paperEdition ? 'Сверь его с официальным ключом.' : 'Проверим его в разборе.';
  $('feedback').textContent = `Твой выбор — ${answerLetter(current().selected)}. ${followUp}`;
  saveLessonProgress();
});
$('next').onclick = () => navigate(current().step + 1);
$('back').onclick = () => navigate(current().step - 1);
$('nextTask').onclick = async () => {
  await selectTask(nextTaskIndex());
  $('taskTitle').focus?.();
  $('lesson').scrollIntoView?.({block: 'start'});
};
$('play').onclick = start;
$('repeat').onclick = () => {
  finishMark();
  pause();
  showTaskDrawing();
  if (task === 9) resetFruitWorkspace();
  ratingAttempt = null;
  $('ratingNotice').textContent = '';
  for (const index of matchingParts()) {
    Object.assign(states[index], {step: 0, frame: 0, elapsed: 0, selected: null});
    saveLessonProgress(index);
  }
  Object.assign(current(), {step: 0, frame: 0, elapsed: 0, selected: null});
  render();
  saveLessonProgress();
};
const lessonMenus = [$('profileMenu'), $('editionMenu'), $('draftNotesMenu'), $('draftSurfaceMenu')];

document.addEventListener('click', e => {
  for (const menu of lessonMenus) {
    if (menu.open && !menu.contains(e.target)) menu.open = false;
  }
});

document.addEventListener('keydown', e => {
  if (document.querySelector?.('dialog[open]')) return;
  if (e.key === 'Escape') {
    const menu = lessonMenus.find(item => item.open);
    if (menu) {
      menu.open = false;
      menu.querySelector('summary').focus();
    } else {
      const disclosure = compactNavigation?.matches ? '.lesson-disclosure[open]' : '#taskNavigation[open]';
      const navigation = e.target.closest?.(disclosure);
      if (navigation) {
        navigation.open = false;
        navigation.querySelector('summary').focus();
      }
    }
    return;
  }
  if (lessonMenus.some(menu => menu.open && menu.contains(e.target))) return;
  if (streamedEditions && !ready) return;
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey ||
    e.target.closest?.('.lesson-header, .task-navigation, .draft-controls')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const fromChapter = e.target.closest?.('#chapters button');
    navigate(current().step + (e.key === 'ArrowRight' ? 1 : -1));
    if (fromChapter) $('chapters').querySelector('[aria-current="step"]')?.focus();
  }
  if (e.code === 'Space' && e.target === document.body) {e.preventDefault(); start()}
});
document.addEventListener('visibilitychange', () => {if (document.hidden) pause()});
globalThis.addEventListener?.('hashchange', () => {
  const linkedTask = taskInUrl();
  if (linkedTask !== -1) selectTask(linkedTask, 'replaceState');
});
setupWorkspace();
setupFruitWorkspace();
setupProfileRating();
startFreshAttemptOnArrival();
renderProfile();
restoreProgress();
const linkedTask = taskInUrl();
globalThis.addEventListener?.('kenguru:accountchange', event => changeAccount(event.detail));
globalThis.addEventListener?.('online', () => accountProgress?.refresh());
globalThis.addEventListener?.('offline', renderSyncStatus);
globalThis.addEventListener?.('focus', () => accountProgress?.refresh());
$('retryProgress').addEventListener('click', () => accountProgress?.retry());
if (globalThis.KenguruAccount) globalThis.KenguruAccount.flushProgress = () => {
  finishMark();
  return accountProgress?.flush() ?? true;
};
selectTask(linkedTask === -1 ? Math.max(savedTaskIndex(), 0) : linkedTask, 'replaceState');
