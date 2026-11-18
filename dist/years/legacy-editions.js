'use strict';

(() => {
  const latin = ['A', 'B', 'C', 'D', 'E'];
  const cyrillic = ['А', 'Б', 'В', 'Г', 'Д'];
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const archive = globalThis.KENGURU_ARCHIVE ??= {};
  const source = 'https://ipokengu.ru/public/task';

  function renderOriginal(image, width, height, label, mark, formula, frame) {
    let focus = '';
    if (mark) {
      const [x, y, w, h] = mark;
      const dash = Math.min(1, .65 + Math.max(0, frame) / 6);
      focus = `<rect x="${x - 4}" y="${y - 2}" width="${w + 8}" height="${h + 4}" rx="4" fill="none" stroke="#20766d" stroke-width="4" pathLength="1" stroke-dasharray="${dash} 1"/>`;
    }
    const band = formula ? Math.round(width * .12) : 0;
    if (formula) {
      const y = height + band * .5;
      const lineWidth = Math.min(width - 34, Math.max(180, formula.length * width * .027));
      const left = (width - lineWidth) / 2;
      const completion = Math.min(1, .35 + frame / 5);
      const fontSize = Math.min(width * .052, width / (formula.length * .58));
      focus += `<rect x="0" y="${height + 8}" width="${width}" height="${band - 8}" rx="8" fill="#eaf0e6"/>` +
        `<text x="${width / 2}" y="${y}" dominant-baseline="middle" text-anchor="middle" style="font: 700 ${fontSize}px Arial; fill:#172e34">${escape(formula)}</text>` +
        `<line x1="${left}" x2="${left + lineWidth * completion}" y1="${y + band * .29}" y2="${y + band * .29}" stroke="#237e79" stroke-width="3" stroke-linecap="round"/>`;
    }
    return `<svg class="legacy-scene" viewBox="0 0 ${width} ${height + band}" role="img" aria-label="${escape(label)}"><image href="${image}" width="${width}" height="${height}"/>${focus}</svg>`;
  }

  for (const [year, label, tasks] of globalThis.KENGURU_LEGACY ?? []) {
    const letters = year < 2008 ? latin : cyrillic;
    const lessons = [];
    const scenes = [];
    for (const [i, [width, height, wording, marks, key, name, explanation, note]] of tasks.entries()) {
      const number = i + 1;
      const transcript = globalThis.KENGURU_ARCHIVE_TEXT?.[year + '-3-4']?.[number];
      const answer = key === '?' ? null : latin.indexOf(key);
      const title = name;
      const originalImage = `assets/years/${year}/task-${String(number).padStart(2, '0')}.webp`;
      const steps = [
        ['Твоё решение', 'Условие задачи', 'Варианты ответа на карточке. Если нужно рассмотреть детали, открой рисунок крупнее.'],
        ...explanation.map(([heading, text], stage) => [
          stage === explanation.length - 1 ? 'Ответ' : 'Шаг ' + (stage + 1), heading, text,
        ]),
      ];
      const choice = answer === null ? '' : letters[answer];
      const printed = wording && !transcript?.question ? ` ${wording}` : '';
      const description = `Условие и варианты задачи ${number} из оригинала.${printed}`;
      lessons.push({
        number,
        title,
        short: name,
        skill: '',
        answer,
        choices: transcript?.choices ?? ['', '', '', '', ''],
        question: transcript?.question ?? '',
        questionNote: [note, transcript?.figure].filter(Boolean).join(' '),
        legacyOriginal: true,
        points: i < 10 ? 3 : i < 20 ? 4 : 5,
        originalImage,
        steps,
      });
      const formulas = steps.map(([, , message], step) => step
        ? message.match(/\d+(?:[.,]\d+)?(?:\s*[+−–×·÷:=]\s*\d+(?:[.,]\d+)?){2,}/gu)?.find(part => part.includes('=')) : null);
      scenes.push((step, frame) => {
        const final = step === steps.length - 1;
        return renderOriginal(originalImage, width, height,
          description + (final && choice ? ` Ответ ${choice}.` : ''), final ? marks[answer] : null, formulas[step], frame);
      });
    }

    archive[year] = {
      year,
      id: year + '-3-4',
      grades: [3, 4],
      label,
      answerLetters: letters,
      sources: {
        tasksUrl: `${source}/kenguru_${year}_class_3-4.pdf`,
        answersUrl: `${source}/kenguru_${year}_answers.pdf`,
        solutionUrl: null,
      },
      lessons,
      scenes,
    };
  }
})();
