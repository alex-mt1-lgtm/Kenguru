'use strict';

(() => {
  const archive = globalThis.KENGURU_ARCHIVE ??= {};
  const visual = globalThis.KenguruVisual;
  const cyrillicAnswers = 'АБВГД';

  function circleComparison(step, frame) {
    const outline = '#54877e';
    const fill = ['#347d75', '#43998c', '#60a99d', '#2e807c'];
    const ink = '#172e34';
    const radius = 43;
    const quarter = 'M0 0H43A43 43 0 0 0 0 -43Z';
    if (step === 1) {
      const opacity = .25 + .75 * visual.reveal(frame);
      return visual.svg(`<rect x="225" y="20" width="190" height="190" rx="3" fill="#f1f6ee" stroke="${outline}" stroke-width="2"/>
        <path d="M320 115H415A95 95 0 0 0 320 20Z" fill="${fill[0]}" opacity="${opacity}"/>
        <path d="M320 123V130M415 123V130M320 126H415" fill="none" stroke="${ink}" stroke-width="2"/>
        <text x="367.5" y="154" fill="${ink}" font-size="17" text-anchor="middle">радиус</text>`,
      'Радиус четверти круга равен половине стороны квадрата', '0 0 640 230', 'worked-scene');
    }
    if (step !== 2) return null;

    const far = radius;
    const offsets = [
      [[-far, far], [-far, -far], [far, -far], [far, far]],
      [[0, 0], [0, 0], [0, 0], [0, 0]],
      [[-far, 0], [-far, 0], [far, 0], [far, 0]],
      [[0, far], [-far, -far], [far, -far], [0, far]],
    ];
    const groups = offsets.map((pieces, index) => {
      const x = index % 2 === 0 ? 222 : 418;
      const y = index < 2 ? 95 : 254;
      const start = index * .38;
      const turn = index === 1 ? 0 : 180 * visual.reveal((frame - start) * 2.5);
      const remaining = 1 - visual.reveal((frame - start - 1.2) * 1.15);
      const paths = pieces.map(([dx, dy], piece) =>
        `<path d="${quarter}" fill="${fill[piece]}" stroke="#fffefa"
          stroke-width=".6" transform="translate(${x + dx * remaining} ${y + dy * remaining}) rotate(${90 * piece + turn})"/>`
      ).join('');
      return `<rect x="${x - radius}" y="${y - radius}" width="${radius * 2}" height="${radius * 2}"
        fill="#f1f6ee" stroke="${outline}" stroke-width="1.6"/>${paths}
        <text x="${x - 96}" y="${y + 6}" fill="${ink}" font-size="20" text-anchor="middle">${cyrillicAnswers[index]}</text>`;
    });
    return visual.svg(groups.join(''), 'Четыре четверти каждого рисунка складываются в целый круг',
      '102 0 432 348', 'worked-scene');
  }

  const editions = [...(globalThis.KENGURU_GRADES_7_8 ?? []), ...(globalThis.KENGURU_JUNIOR_SENIOR ?? [])];
  for (const edition of editions) {
    const answerLetters = [...(edition.answerLetters ?? cyrillicAnswers)];
    const {id, year, label, grades, tasksUrl, answersUrl, solutionUrl, cards} = edition;
    const lessons = [];
    const scenes = [];

    for (const {number, title, question, questionNote, options, condition, answer, points, review, keyNote} of cards) {
      const hasReview = review.length > 0;
      const choiceImages = options.map(option => option.image);
      const choices = options.map(option => option.text ?? '');
      const answerLetter = answerLetters[answer];
      const steps = [['Условие', 'Условие задачи', '']];
      for (const [index, stage] of review.entries()) {
        const final = index === review.length - 1;
        steps.push([final ? 'Ответ' : 'Шаг ' + (index + 1), stage.title, stage.text]);
      }
      if (!hasReview) {
        steps.push(['Ответ', 'Проверка по ключу', keyNote ?? (answerLetter ? 'Правильный вариант — ' + answerLetter + '.' : 'Сверь решение с ответом в PDF.')]);
      }

      lessons.push({
        number, title, short: title, question, questionNote, points, answer, choices, choiceImages,
        choiceLayout: {condition, options}, conditionImage: condition?.src, conditionAlt: condition?.alt,
        hideIntroText: true, paperEdition: !hasReview, showCompletedStep: hasReview,
        officialValueKey: answer === null,
        steps,
      });

      const keyedAnswer = visual.answerScene({letter: answerLetter, value: choices[answer]});
      scenes.push((step, frame) => {
        if (!step) return '';
        if (!hasReview) return keyedAnswer;
        const stage = review[step - 1];
        const animation = id === '2026-7-8' && number === 1 ? circleComparison(step, frame) : null;
        return animation ?? (visual.workedScene(stage, frame)
          || (step === review.length ? keyedAnswer : ''));
      });
    }
    archive[id] = {id, year, label, grades, answerLetters, sources: {tasksUrl, answersUrl, solutionUrl}, lessons, scenes};
  }
})();
