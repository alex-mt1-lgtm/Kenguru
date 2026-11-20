'use strict';

globalThis.makeSubjectEdition = function (meta, rows) {
  const {subject, year, grade, contest, letters, tasksFile, answersFile, language} = meta;
  const folder = 'assets/' + subject + '/' + year + '/';
  const grades = grade.split('-').map(Number);
  const lessons = rows.map(row => {
    const {title, question, choices, figure, optionFigures, steps, context, audio, numericAnswer} = row;
    const options = choices.map((text, i) => {
      const image = optionFigures?.[i];
      if (!image) return {text};
      return {text: row.showOptionText ? text : '', image: image.src,
        description: row.showOptionText ? text + '. ' + image.alt : image.alt,
        pixelWidth: image.width, pixelHeight: image.height};
    });
    return {
      title, question, choices, language, context, guided: true, hideIntroText: true,
      skill: contest, answer: row.answer ?? null, points: row.points ?? meta.points,
      ...(Number.isInteger(numericAnswer) ? {numericAnswer, questionNote: 'В тренировочном рейтинге за эту задачу баллы не начисляются.'} : {}),
      ...(audio ? {audio: folder + 'listening.mp3'} : {}),
      ...(figure || optionFigures ? {choiceLayout: {condition: figure, options},
        choiceImages: options.map(option => option.image),
        ...(figure ? {conditionImage: figure.src, conditionAlt: figure.alt} : {})} : {}),
      steps: [
        ['Выбор', 'Условие задачи', ''],
        ...steps.map((explanation, index) => index === steps.length - 1
          ? ['Проверка', 'Проверка', explanation]
          : [index ? 'Шаг ' + (index + 1) : 'Первый шаг', 'Рассуждение', explanation]),
        ['Ответ', 'Ответ', ''],
      ],
    };
  });
  return {
    id: year + '-' + subject + '-' + grade, year, grades, label: grades.join('–') + ' классы',
    ...(meta.sections ? {sections: meta.sections} : {}),
    ...(meta.titleLanguage ? {titleLanguage: meta.titleLanguage} : {}),
    subject, answerLetters: [...letters], sources: {
      contest, tasksUrl: folder + tasksFile, answersUrl: folder + answersFile,
      ...(meta.reviewedKey ? {reviewedKey: true} : {}),
    },
    lessons, scenes: lessons.map(() => () => ''),
  };
};
