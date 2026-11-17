'use strict';
// Marks on lesson diagrams follow the individual step. Scratch paper and
// written notes belong to the task and remain available throughout its solution.
const sheets = new Map();
const taskNotes = new Map();
const PAPER_VIEWBOX = '0 0 640 300';
const PAPER_GRID = {x: 0, y: 0, dx: 20, dy: 20, cols: 32, rows: 15};
const paperGridMarkup = '<path stroke="#cbd9cb" stroke-width="1" fill="none" d="'
  + Array.from({length: PAPER_GRID.cols - 1}, (_, i) => `M${(i + 1) * PAPER_GRID.dx} 0V300`).join(' ')
  + ' ' + Array.from({length: PAPER_GRID.rows - 1}, (_, i) => `M0 ${(i + 1) * PAPER_GRID.dy}H640`).join(' ')
  + '"/>';
let workVariant = 0;
let drawingTool = 'pointer';
let drawingSurface = 'scene';
let workspaceTask = null;
let draft = null;
let workingMarks = null;
let activeSheet = null;
let activePointer = null;

function hasInteractiveScene() {
  return task === 9 && current().step === 0;
}

function sheetKey() {
  if (drawingSurface !== 'scene') return `${task}:paper:${drawingSurface}`;
  const variant = task === 0 && current().step === 0 ? workVariant : '';
  return `${task}:${current().step}:${variant}`;
}

function getSheet(key=sheetKey()){if(!sheets.has(key))sheets.set(key,{marks:[],past:[]});return sheets.get(key)}
function commitMarks(marks,key=sheetKey()){const sheet=getSheet(key);sheet.past.push(sheet.marks);if(sheet.past.length>80)sheet.past.shift();sheet.marks=marks}
function addMark(mark,key=sheetKey()){commitMarks([...getSheet(key).marks,mark],key)}
function undoDrawing(){finishMark();const sheet=getSheet();if(sheet.past.length)sheet.marks=sheet.past.pop();renderWorkspace()}
function clearDrawing(){finishMark();if(getSheet().marks.length)commitMarks([]);renderWorkspace()}
function squareWorkScene(){return svg(`<rect x="210" y="20" width="192" height="192" fill="#fffefa" stroke="#172e34" stroke-width="2"/><path d="${CUTS[workVariant]}" transform="translate(210 20) scale(48)" class="cut"/>`+text(306,265,`Рисунок ${LETTERS[workVariant]}`),`Рисунок ${LETTERS[workVariant]}. ${squareDescription(workVariant)}`)}

function drawingGrid(){if(drawingSurface==='grid')return PAPER_GRID;if(drawingSurface!=='scene')return null;const step=current().step;if(task===0){if(step===2||(step===3&&current().frame===0))return{x:210,y:20,dx:48,dy:48,cols:4,rows:4};if(step===1)return{x:200,y:20,dx:53,dy:53,cols:4,rows:4}}if(task===2)return{x:102,y:15,dx:62,dy:58,cols:7,rows:4};if(task===7)return{x:110,y:4,dx:36,dy:34,cols:11,rows:8};return null}
function cellAt(point,grid=drawingGrid()){if(!grid)return null;const col=Math.floor((point[0]-grid.x)/grid.dx),row=Math.floor((point[1]-grid.y)/grid.dy);if(col<0||row<0||col>=grid.cols||row>=grid.rows)return null;return[grid.x+col*grid.dx,grid.y+row*grid.dy,grid.dx,grid.dy]}
function ladderGeometry(a,b){const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1)return{rails:[],rungs:[]};const normal=[-(b[1]-a[1])/length*8,(b[0]-a[0])/length*8],offset=(p,sign)=>[p[0]+normal[0]*sign,p[1]+normal[1]*sign];const rails=[[offset(a,-1),offset(b,-1)],[offset(a,1),offset(b,1)]],rungs=[];const count=Math.max(1,Math.floor(length/16));for(let i=0;i<=count;i++){const t=i/count,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];rungs.push([offset(p,-1),offset(p,1)])}return{rails,rungs}}
function markMarkup(mark){const color=mark.color,points=mark.points||[];if(mark.type==='fill')return mark.cells.map(([x,y,w,h])=>`<rect x="${x+1}" y="${y+1}" width="${w-2}" height="${h-2}" fill="${color}" fill-opacity=".4"/>`).join('');if(!points.length)return'';if(mark.type==='ladder'){const lines=ladderGeometry(points[0],points.at(-1));return [...lines.rails,...lines.rungs].map(([a,b])=>`<path d="M${a.join(' ')}L${b.join(' ')}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')}if(mark.type==='arrow'&&points.length>1)return arrowMarkup(points[0],points.at(-1),color);if(points.length===1)return `<circle cx="${points[0][0]}" cy="${points[0][1]}" r="2" fill="${color}"/>`;return `<polyline points="${points.map(p=>p.join(',')).join(' ')}" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`}
function pointSegmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
function markHit(mark,p){if(mark.type==='fill')return mark.cells.some(([x,y,w,h])=>p[0]>=x&&p[0]<=x+w&&p[1]>=y&&p[1]<=y+h);const points=mark.points||[];return points.some((a,i)=>pointSegmentDistance(p,a,points[i+1]||a)<(mark.type==='ladder'?18:12))}
function arrowMarkup(start, end, color) {
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const size = Math.min(16, Math.hypot(end[0] - start[0], end[1] - start[1]) / 3);
  const wings = [angle - Math.PI / 6, angle + Math.PI / 6].map(a => [
    end[0] - size * Math.cos(a), end[1] - size * Math.sin(a)
  ]);
  return `<path d="M${start.join(' ')}L${end.join(' ')} M${wings[0].join(' ')}L${end.join(' ')}L${wings[1].join(' ')}" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function canDrawWith(tool) {
  if (tool === 'fill') return Boolean(drawingGrid());
  if (tool === 'ladder') return task === 1 && drawingSurface === 'scene';
  return true;
}

// The overlay shares the actual SVG viewport. HTML scenes use a normalized
// coordinate system that covers their entire visible rectangle.
function syncDrawingViewport() {
  const layer = $('drawingLayer');
  const surface = drawingSurface === 'scene' || playing || !$('drawingWorkspace').open
    ? $('scene') : $('draftPaper');
  const diagram = surface === $('scene') ? surface.firstElementChild : surface;
  const svgDiagram = diagram?.localName === 'svg' ? diagram : null;
  layer.setAttribute('viewBox', svgDiagram?.getAttribute('viewBox') || PAPER_VIEWBOX);
  layer.setAttribute('preserveAspectRatio', svgDiagram
    ? svgDiagram.getAttribute('preserveAspectRatio') || 'xMidYMid meet' : 'none');
  const target = svgDiagram || surface;
  if (!target.getBoundingClientRect) return;
  const rect = target.getBoundingClientRect();
  const stage = $('stage').getBoundingClientRect();
  layer.style.setProperty('--drawing-left', `${rect.left - stage.left}px`);
  layer.style.setProperty('--drawing-top', `${rect.top - stage.top}px`);
  layer.style.setProperty('--drawing-width', `${rect.width}px`);
  layer.style.setProperty('--drawing-height', `${rect.height}px`);
}

function renderWorkspace() {
  const workspace = $('drawingWorkspace');
  const interactive = hasInteractiveScene();
  if (workspaceTask !== task) {
    workspaceTask = task;
    drawingSurface = 'scene';
    drawingTool = 'pointer';
    $('draftNotes').value = taskNotes.get(task) || '';
  }
  if (!canDrawWith(drawingTool)) drawingTool = 'pointer';
  const paperVisible = workspace.open && !playing && drawingSurface !== 'scene';
  $('scene').hidden = paperVisible;
  const paper = $('draftPaper');
  paper.hidden = !paperVisible;
  paper.setAttribute('data-paper', drawingSurface);
  paper.innerHTML = drawingSurface === 'grid' ? paperGridMarkup : '';
  paper.setAttribute('preserveAspectRatio', 'none');
  $('drawingSurface').value = drawingSurface;
  const drawingUnavailable = interactive && !paperVisible;
  $('drawingTools').hidden = Boolean(playing) || drawingUnavailable;

  const layer = $('drawingLayer');
  layer.hidden = !workspace.open || playing || drawingUnavailable;
  const sheet = getSheet();
  const editingSheet = activeSheet === sheetKey();
  const marks = editingSheet && workingMarks ? workingMarks : sheet.marks;
  const preview = editingSheet && draft ? [...marks, draft] : marks;
  layer.innerHTML = preview.map(markMarkup).join('');
  layer.setAttribute('data-tool', drawingTool);
  $('undoDrawing').disabled = !sheet.past.length;
  $('clearDrawing').disabled = !sheet.marks.length;
  $('variantLabel').hidden = !(task === 0 && current().step === 0);
  $('workVariant').selectedIndex = workVariant;

  if (document.querySelectorAll) {
    for (const button of document.querySelectorAll('#drawingTools [data-tool]')) {
      button.hidden = !canDrawWith(button.dataset.tool);
      button.setAttribute('aria-pressed', String(button.dataset.tool === drawingTool));
    }
  }
  const hints = {
    pointer: 'Выбери инструмент, чтобы рисовать.',
    fill: 'Нажми на клетку или проведи по нескольким.',
    ladder: 'Проведи от начала лестницы к её концу.',
    eraser: 'Проведи по пометке, чтобы стереть её.',
    pen: 'Рисуй пальцем или мышью.',
    line: 'Проведи от начала линии к её концу.',
    arrow: 'Проведи в сторону, куда должна смотреть стрелка.'
  };
  $('drawingHint').textContent = playing ? 'Поставь показ на паузу, чтобы рисовать.'
    : drawingUnavailable ? 'Заполняй схему в задаче. Для рисования выбери отдельный лист.' : hints[drawingTool];
  if (workspace.open && !layer.hidden) syncDrawingViewport();
}

function finishMark() {
  if (activeSheet === null) return;
  if (workingMarks !== null) {
    if (workingMarks.length !== getSheet(activeSheet).marks.length ||
        workingMarks.some((mark, i) => mark !== getSheet(activeSheet).marks[i])) {
      commitMarks(workingMarks, activeSheet);
    }
  } else if (draft) {
    const [start] = draft.points;
    const end = draft.points.at(-1);
    if (draft.type === 'fill' ? draft.cells.length > 0
        : Boolean(start) && (draft.type !== 'ladder' || Math.hypot(end[0] - start[0], end[1] - start[1]) >= 8)) {
      addMark(draft, activeSheet);
    }
  }
  draft = null;
  workingMarks = null;
  activeSheet = null;
  activePointer = null;
  renderWorkspace();
}

function pointerPoint(event, clamp = false) {
  const layer = $('drawingLayer');
  const matrix = layer.getScreenCTM();
  if (!matrix) return null;
  const point = layer.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const p = point.matrixTransform(matrix.inverse());
  const box = layer.viewBox.baseVal;
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  if (!clamp && (p.x < box.x || p.x > right || p.y < box.y || p.y > bottom)) return null;
  return [Math.max(box.x, Math.min(right, p.x)), Math.max(box.y, Math.min(bottom, p.y))];
}

function extendMark(point){if(workingMarks!==null){workingMarks=workingMarks.flatMap(mark=>{if(mark.type!=='fill')return markHit(mark,point)?[]:[mark];const cells=mark.cells.filter(([x,y,w,h])=>!(point[0]>=x&&point[0]<x+w&&point[1]>=y&&point[1]<y+h));return cells.length?[{...mark,cells}]:[]})}else if(draft?.type==='fill'){const from=draft.lastPoint||point,grid=drawingGrid(),steps=Math.max(1,Math.ceil(Math.hypot(point[0]-from[0],point[1]-from[1])/((grid?Math.min(grid.dx,grid.dy):30)/3)));for(let i=0;i<=steps;i++){const t=i/steps,cell=cellAt([from[0]+(point[0]-from[0])*t,from[1]+(point[1]-from[1])*t]);if(cell&&!draft.cells.some(c=>c[0]===cell[0]&&c[1]===cell[1]))draft.cells.push(cell)}draft.lastPoint=point}else if(draft?.type==='pen'){const last=draft.points.at(-1);if(Math.hypot(point[0]-last[0],point[1]-last[1])>=2)draft.points.push(point)}else if(draft)draft.points=[draft.points[0],point];renderWorkspace()}
function showTaskDrawing() {
  drawingSurface = 'scene';
  drawingTool = 'pointer';
}

function setupWorkspace() {
  const layer = $('drawingLayer');
  const workspace = $('drawingWorkspace');
  workspace.addEventListener('toggle', () => { finishMark(); renderWorkspace(); });
  $('draftNotes').addEventListener('input', event => taskNotes.set(task, event.target.value));
  $('drawingSurface').addEventListener('change', event => {
    const surface = event.target.value;
    finishMark();
    pause();
    drawingSurface = surface;
    renderWorkspace();
  });
  $('drawingTools').addEventListener('click', event => {
    const button = event.target.closest('[data-tool]');
    if (!button || button.hidden || !canDrawWith(button.dataset.tool)) return;
    finishMark();
    pause();
    drawingTool = button.dataset.tool;
    renderWorkspace();
  });
  $('workVariant').addEventListener('change', () => {
    const selectedVariant = $('workVariant').selectedIndex;
    finishMark();
    pause();
    workVariant = selectedVariant;
    renderScene();
    renderWorkspace();
  });
  $('drawingColor').addEventListener('input', () => { finishMark(); pause(); });
  $('undoDrawing').onclick = () => { pause(); undoDrawing(); };
  $('clearDrawing').onclick = () => { pause(); clearDrawing(); };

  layer.addEventListener('pointerdown', event => {
    if (drawingTool === 'pointer' || event.button !== 0 || activePointer !== null) return;
    const point = pointerPoint(event);
    if (!point) return;
    event.preventDefault();
    activeSheet = sheetKey();
    activePointer = event.pointerId;
    if (drawingTool === 'eraser') workingMarks = getSheet().marks.slice();
    else draft = {type: drawingTool, color: $('drawingColor').value, points: [point], cells: []};
    layer.setPointerCapture(event.pointerId);
    extendMark(point);
  });
  layer.addEventListener('pointermove', event => {
    if (activePointer !== event.pointerId) return;
    const point = pointerPoint(event, true);
    if (point) extendMark(point);
  });
  layer.addEventListener('pointerup', event => {
    if (activePointer !== event.pointerId) return;
    const point = pointerPoint(event, true);
    if (point) extendMark(point);
    finishMark();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    layer.addEventListener(type, event => { if (activePointer === event.pointerId) finishMark(); });
  }
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => { if (!layer.hidden) syncDrawingViewport(); });
    observer.observe($('stage'));
    observer.observe($('scene'));
  }
}
