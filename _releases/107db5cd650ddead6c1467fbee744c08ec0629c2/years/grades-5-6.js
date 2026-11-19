'use strict';

(() => {
  const archive = globalThis.KENGURU_ARCHIVE ??= {};
  const visual = globalThis.KenguruVisual;
  const officialSolutions = globalThis.KENGURU_GRADE_SOLUTION_STEPS ?? {};
  const nativeConditions = globalThis.KENGURU_GRADE_CONDITIONS ?? {};
  const nativeKeys = globalThis.KENGURU_GRADE_KEYS ?? {};
  const visualLessons = globalThis.KenguruVisualLessons ?? {};
  const editorialTitles = globalThis.KENGURU_GRADE_TITLES ?? {};

  function conditionScene(path, width, height, label) {
    return visual.svg(`<image href="${visual.escape(path)}" width="${width}" height="${height}"/>`,
      label, `0 0 ${width} ${height}`, 'legacy-scene').replace('<svg ', `<svg style="max-width:${width}px" `);
  }

  function answerDiagram(path, sourceWidth, sourceHeight) {
    const scale = Math.min(420 / sourceWidth, 300 / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const x = (420 - width) / 2;
    const drawing = visual.svg(`<image href="${visual.escape(path)}" x="${x}" y="8" width="${width}" height="${height}"/>`,
      'Рисунок к официальному ответу', `0 0 420 ${height + 16}`, 'worked-scene');
    return path.endsWith('.svg') ? drawing
      : drawing.replace('<svg ', `<svg style="max-width:${840 / scale}px;margin-inline:auto" `);
  }

  function officialSteps(stages) {
    return stages.map(({text, title}, index) => [
      index === stages.length - 1 ? 'Ответ' : `Шаг ${index + 1}`,
      title ?? (index === 0 ? 'Начинаем решение' : index === stages.length - 1 ? 'Проверяем ответ' : 'Продолжаем решение'),
      text,
    ]);
  }

  function createEdition(edition) {
    const {year, id, grades, label, tasksUrl, answersUrl, solutionUrl, cards} = edition;
    const answerLetters = [...(year < 2008 ? 'ABCDE' : 'АБВГД')];
    const groupSize = cards.length / 3;
    const lessons = [];
    const scenes = [];

    for (const [index, [width, height, letterKey]] of cards.entries()) {
      const number = index + 1;
      const padded = String(number).padStart(2, '0');
      const folder = `assets/grades-5-6/${year}`;
      const originalImage = `${folder}/task-${padded}.webp`;
      const description = `Условие задачи №${number}. Кенгуру ${year}, 5–6 классы.`;
      const custom = visualLessons[year]?.[number];
      const native = nativeConditions[year]?.[number];
      const official = officialSolutions[year]?.[number]?.steps;
      const question = custom?.question ?? native?.question ?? '';
      const choices = custom?.choices ?? native?.choices ?? ['', '', '', '', ''];
      const paperEdition = !custom && !official?.length;
      const intro = ['Условие', 'Условие задачи', 'Выбери ответ и нажми «Далее».'];
      const officialKey = nativeKeys[year]?.[index];
      const [answerText, answerLetter, answerImage, answerWidth, answerHeight] = officialKey ?? [];
      const answer = officialKey && answerLetter ? answerLetters.indexOf(answerLetter) : letterKey;
      const answerStep = officialKey
        ? ['Ответ', 'Официальный ответ', answerLetter ? `Вариант ${answerLetter}. ${answerText}` : answerText]
        : ['Ответ', 'Проверяем ответ', 'Сравни свой выбор с официальным ответом.'];
      const steps = custom?.steps ?? [intro, ...(official?.length ? officialSteps(official) : [answerStep])];
      const figure = native?.image;
      const title = custom?.title ?? editorialTitles[year]?.[index] ?? `Задача ${number}`;

      lessons.push({
        number,
        title,
        short: custom?.short ?? title,
        skill: custom?.skill ?? '',
        answer,
        choices,
        choiceImages: custom ? custom.choiceImages : native?.choiceImages,
        question,
        conditionImage: custom?.conditionImage ?? (!custom ? figure : undefined),
        legacyOriginal: !custom || Boolean(custom.originalAtStart),
        hideIntroText: !custom,
        paperEdition,
        showCompletedStep: !paperEdition,
        officialValueKey: Boolean(officialKey),
        points: 3 + Math.floor(index / groupSize),
        originalImage,
        steps,
      });

      const initialScene = !question || custom?.originalAtStart
        ? conditionScene(originalImage, width, height, description)
        : figure && !custom ? conditionScene(figure, native.imageWidth, native.imageHeight, description) : '';
      const key = officialKey
        ? (answerImage ? answerDiagram(answerImage, answerWidth, answerHeight) : '')
        : visual.answerScene({letter: answerLetters[answer], value: choices[answer]});
      scenes.push((step, frame) => {
        if (custom && !(step === 0 && custom.originalAtStart)) return custom.scene(step, frame);
        if (step === 0) return initialScene;
        if (paperEdition) return key;
        // An empty stage is appropriate when this part of the proof has only a verbal argument.
        return visual.workedScene(official[step - 1], frame) || (step === steps.length - 1 ? key : '');
      });
    }

    return {year, id, grades, label, answerLetters, sources: {tasksUrl, answersUrl, solutionUrl}, lessons, scenes, paperEdition: true};
  }

  for (const edition of globalThis.KENGURU_GRADES_5_6 ?? []) {
    archive[edition.id] = createEdition(edition);
  }
})();
