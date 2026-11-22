'use strict';

globalThis.makeMedvezhonokEdition = function (year, grade, rows) {
  const letters = 'АБВГД';
  const plain = value => value.replace(/<\/?(?:em|strong|u)>/g, '');
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const grades = grade.split('-').map(Number);
  const lessons = rows.map(({author, question, choices, key, review, figure, unrated}, index) => {
    const [title, idea, check] = review;
    const answer = letters.indexOf(key);
    const textChoices = choices.map(plain);
    const options = figure?.options?.map(({src, description, pixelWidth, pixelHeight}, i) => ({
      image: src, description, pixelWidth, pixelHeight, text: figure.onlyPictures ? '' : textChoices[i],
    })) ?? textChoices.map(text => ({text}));
    return {
      number: index + 1, title, author, question: plain(question), choices: textChoices,
      ...(plain(question) !== question ? {formattedQuestion: question} : {}),
      ...(textChoices.some((value,i) => value !== choices[i]) ? {formattedChoices: choices} : {}),
      ...(unrated ? {questionNote: unrated, archiveAnswer: key} : {}),
      ...(figure ? {
        choiceLayout: {options, condition: figure.condition},
        choiceImages: options.map(option => option.image),
        ...(figure.condition ? {conditionImage: figure.condition.src, conditionAlt: figure.condition.alt} : {}),
      } : {}),
      answer: unrated ? null : answer, points: index < 10 ? 3 : index < 20 ? 4 : 5,
      skill: 'Русский медвежонок · Языкознание', hideIntroText: true, showCompletedStep: true,
      steps: [
        ['Выбор', 'Условие задачи', ''],
        ['Первый шаг', 'Рассуждение', idea],
        ['Проверка', 'Проверка', check],
        ['Ответ', unrated ? 'Ответ в архивном ключе' : 'Ответ', ''],
      ],
    };
  });
  const scenes = rows.map(({review, key}, i) => {
    const terms = review.slice(1).map(step => [...new Set(
      Array.from(step.matchAll(/«([^«»\n]{1,44})»/gu), match => match[1])
    )].slice(0, 5));
    return (step, frame) => {
      if (!step) return '';
      const result = lessons[i].choices[letters.indexOf(key)].replace(/^\[(.*)\][.]?$/, '$1');
      const tokens = step === 3 ? [key + (result ? ' · ' + result : '')] : terms[step-1];
      if (step < 3 && tokens.length < 2) return '';
      return '<div class="word-scene" data-result="' + (step === 3) + '">' + tokens.map((token, index) => {
        const reveal = Math.min(1, Math.max(0, (frame - index * 0.65) / 0.42));
        return '<span class="word-token" style="--reveal:' + reveal.toFixed(3) + '">' + escape(token) + '</span>';
      }).join('') + '</div>';
    };
  });
  const reviewedKey = rows.some(row => row.reviewedEdition);
  return {
    id: year + '-medvezhonok-' + grade, year, grades, subject: 'ru',
    label: grades.join('–') + ' классы',
    sources: {
      contest: 'Русский медвежонок',
      tasksUrl: 'assets/medvezhonok/' + year + '/' + grade + '.pdf',
      reviewedKey,
      answersUrl: 'assets/medvezhonok/' + year + '/' + (reviewedKey ? 'reviewed-' + grade : grade + '-answers') + '.pdf',
    },
    lessons, scenes,
  };
};
