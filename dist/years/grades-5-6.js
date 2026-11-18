'use strict';

(() => {
  const archive = globalThis.KENGURU_ARCHIVE ??= {};
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  for (const edition of globalThis.KENGURU_GRADES_5_6 ?? []) {
    const {year, id, grades, label, tasksUrl, answersUrl, solutionUrl, cards} = edition;
    const answerLetters = [...(year < 2008 ? 'ABCDE' : 'АБВГД')];
    const groupSize = cards.length / 3;
    const lessons = [];
    const scenes = [];
    for (const [index, [width, height, answer, excerpt, version]] of cards.entries()) {
      const number = index + 1;
      const transcript = globalThis.KENGURU_ARCHIVE_TEXT?.[id]?.[number];
      const padded = String(number).padStart(2, '0');
      const folder = `assets/grades-5-6/${year}`;
      const imageUrl = (kind, revision) => `${folder}/${kind}-${padded}.webp${revision ? '?v=' + revision : ''}`;
      const originalImage = imageUrl('task');
      const statement = `Печатная карточка задачи №${number}, Кенгуру ${year}, 5–6 классы.`;
      const sceneDescription = escape([statement, transcript?.figure].filter(Boolean).join(' '));
      const answerText = transcript?.answerText;
      const steps = [
        ['Условие', 'Реши задачу', ''],
        ['Ответ', 'Проверка по официальному ключу', answerText || (excerpt
          ? 'Ответ показан в выдержке из официального ключа.' : 'Сравни выбранный вариант с официальным ответом.')],
      ];
      lessons.push({
        number,
        title: `Задача ${number}`,
        short: 'Условие и официальный ответ',
        skill: '',
        answer,
        choices: transcript?.choices ?? ['', '', '', '', ''],
        question: transcript?.question ?? '',
        questionNote: transcript?.figure ?? '',
        legacyOriginal: true,
        paperEdition: true,
        answerExcerpt: Boolean(excerpt),
        points: 3 + Math.floor(index / groupSize),
        originalImage,
        originalImageVersion: version,
        steps,
      });
      scenes.push(step => {
        const figures = `<image href="${imageUrl('task', version)}" width="${width}" height="${height}"/>`;
        if (step && excerpt) {
          const [answerWidth, answerHeight, answerVersion] = excerpt;
          const maxWidth = Math.max(width, 275);
          const scale = Math.min(1, (maxWidth - 20) / answerWidth);
          const drawnWidth = answerWidth * scale;
          const drawnHeight = answerHeight * scale;
          const total = Math.ceil(height + drawnHeight + 26);
          return `<svg class="legacy-scene" viewBox="0 0 ${maxWidth} ${total}" role="img" aria-label="${sceneDescription} Ниже фрагмент официального ключа.">${figures}<rect x="0" y="${height + 8}" width="${maxWidth}" height="${drawnHeight + 16}" fill="#eaf0e6" rx="6"/><image href="${imageUrl('answer', answerVersion)}" x="10" y="${height + 16}" width="${drawnWidth}" height="${drawnHeight}"/></svg>`;
        }
        return `<svg class="legacy-scene" viewBox="0 0 ${width} ${height}" role="img" aria-label="${sceneDescription}">${figures}</svg>`;
      });
    }
    archive[id] = {year, id, grades, label, answerLetters, sources: {tasksUrl, answersUrl, solutionUrl}, lessons, scenes, paperEdition: true};
  }
})();
