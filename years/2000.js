'use strict';

(() => {
  const modules = [
    [3, globalThis.KENGURU_2000_THREE],
    [4, globalThis.KENGURU_2000_FOUR],
    [5, globalThis.KENGURU_2000_FIVE],
  ];
  const lessons = [];
  const scenes = [];

  for (const [points, group] of modules) {
    for (const {scene, label, ...lesson} of group) {
      const originalImage = `assets/years/2000/task-${String(lesson.number).padStart(2, '0')}.png`;
      lessons.push({...lesson, short: label, points, originalImage});
      scenes.push(scene);
    }
  }

  globalThis.KENGURU_ARCHIVE ??= {};
  globalThis.KENGURU_ARCHIVE[2000] = {
    year: 2000,
    id: '2000-3-4',
    grades: [3, 4],
    label: '3–4 классы',
    answerLetters: ['A', 'B', 'C', 'D', 'E'],
    sources: {
      tasksUrl: 'https://files.mathkang.ru/old/kenguru_2000_class_3-4.pdf',
      answersUrl: 'https://files.mathkang.ru/old/kenguru_2000_answers.pdf',
      solutionUrl: null,
    },
    lessons,
    scenes,
  };
})();
