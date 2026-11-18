'use strict';

(() => {
  const archive = globalThis.KENGURU_ARCHIVE ??= {};
  for (const edition of globalThis.KENGURU_GRADES_5_6 ?? []) {
    const {year, id, grades, label, tasksUrl, answersUrl, solutionUrl, cards} = edition;
    const answerLetters = [...(year < 2008 ? 'ABCDE' : 'АБВГД')];
    const groupSize = cards.length / 3;
    const lessons = [];
    const scenes = [];
    for (const [index, [width, height, answer, excerpt]] of cards.entries()) {
      const number = index + 1;
      const padded = String(number).padStart(2, '0');
      const folder = `assets/grades-5-6/${year}`;
      const originalImage = `${folder}/task-${padded}.webp`;
      const statement = `Оригинальное условие и варианты ответа задачи №${number}. Кенгуру ${year}, 5–6 классы.`;
      const steps = [
        ['Условие', 'Реши задачу', 'Выбери ответ и нажми «Далее», чтобы свериться с ключом.'],
        ['Ответ', 'Проверка по официальному ключу', excerpt
          ? 'Ответ напечатан ниже, в выдержке из официального ключа.'
          : 'Сравни выбранный вариант с официальным ответом.'],
      ];
      lessons.push({
        number,
        title: `Задача ${number}`,
        short: 'Условие и официальный ответ',
        skill: '',
        answer,
        choices: ['', '', '', '', ''],
        question: '',
        legacyOriginal: true,
        paperEdition: true,
        answerExcerpt: Boolean(excerpt),
        points: 3 + Math.floor(index / groupSize),
        originalImage,
        steps,
      });
      scenes.push(step => {
        const figures = `<image href="${originalImage}" width="${width}" height="${height}"/>`;
        if (step && excerpt) {
          const [answerWidth, answerHeight] = excerpt;
          const maxWidth = Math.max(width, 275);
          const scale = Math.min(1, (maxWidth - 20) / answerWidth);
          const drawnWidth = answerWidth * scale;
          const drawnHeight = answerHeight * scale;
          const total = Math.ceil(height + drawnHeight + 26);
          return `<svg class="legacy-scene" viewBox="0 0 ${maxWidth} ${total}" role="img" aria-label="${statement} Ниже фрагмент официального ключа.">${figures}<rect x="0" y="${height + 8}" width="${maxWidth}" height="${drawnHeight + 16}" fill="#eaf0e6" rx="6"/><image href="${folder}/answer-${padded}.webp" x="10" y="${height + 16}" width="${drawnWidth}" height="${drawnHeight}"/></svg>`;
        }
        return `<svg class="legacy-scene" viewBox="0 0 ${width} ${height}" role="img" aria-label="${statement}">${figures}</svg>`;
      });
    }
    archive[id] = {year, id, grades, label, answerLetters, sources: {tasksUrl, answersUrl, solutionUrl}, lessons, scenes, paperEdition: true};
  }
})();
