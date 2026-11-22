'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {dist, loadLessonCatalog} = require('../scripts/lesson-catalog.cjs');

// Transcribed independently from the organizer's answer tables and the 2012 marked booklets.
const archiveKeys = [
  [2004, 'ГГДАВГВВБВВДГВБГГБББГГБДВБ', 'ГДГВГБГВАВГВГБББГББАБДВББДББГВ'],
  [2005, 'ГГББГГГГВАДБГББГГВБГДВГВБГ', 'ВДДВАГВДГГДВВГГГГДАГВГГВВДББББ'],
  [2006, 'ГБГГАГВБДАВВДВАДГГБАБДДГБД', 'ДГГДГГБГБДВААВВГБББВГАДВГВДБДА'],
  [2007, 'ГБВГДАВДГБДББВАДГДГАВДДГГГ', 'АГВВДДБДБГДГАГДАДДГБВГБДАБГДБВ'],
  [2008, 'ГДБГВГАГДВГВГДВГБББГГГВБГД', 'ДДГБГВГГГВБВВВВББГДВДГГГГВВБДВ'],
  [2009, 'ГДАВВДГАББГББГВГДДБДВААВВАБД', 'АДБДБГДВГББВГВББВВАГВДДАДВАВДБ'],
  [2010, 'ДГДВББАГБГДДВБВАДВГБАДГАВГВБ', 'ГДГВАДВДВВАБВАБГГАДБДГГДБДВАГБ'],
  [2011, 'ГВГАВАДБГБДБАДГГАВГДАВГББДДБ', 'ДАГГААДДДГББВДГВВВВДГБГГДВДБГД'],
  [2012, 'ВВГГБВВГБВГДГБДАВВДВВГДБДАДБ', 'ВВГАВБББГВГДДВДГБДБАВБГДДДАДАА'],
  [2013, 'БАГДГДГАДБВДДДВВВАДГВГБДББАГ', 'ВАДГГВВБАВВГГДВВДБДАДБДББГВГАГ'],
  [2014, 'ДВДВВБДГВАБАББГГГДГАБГДБДВВД', 'ДВГДДВБВГГДВГВББААДВАГБГВВБГДА'],
  [2015, 'ВДАВБВГГАДГВДБДДДБГБДБВВВГГД', 'ГДВДБВВАВБГАБДБГДГВВААГГАДВВБД'],
  [2016, 'АВВБГВАБДВБДДДБГГГБДДБАБВГГА', 'ДБГБГВАДДГБВВГГВАДГДВВББДБАГВБ'],
  [2017, 'ДБГБВГВДГДГГВДДБАВВБАГГДАВББ', 'БГБАВДБДГГВГБВБДВДВБАБВДГААВГГ'],
  [2018, 'БГДГВГАВВДБАБДГААБВГГББВГБДВ', 'ДГГАБДГВАВВГДАГБГБДВВБДВБВГБАБ'],
  [2019, 'ГДГБАБГДДБГВГГГВДАВГДДГГДВАА', 'ВВВГВБГГДГДБББАДАДГВГГГДГГВББА'],
  [2020, 'ДБГВБВБГДДВВАВГВБВБДАГБГВБВВ', 'ВБГБВБАДАГВДБВБАВВВГДБГГДАГГГГ'],
  [2021, 'АБГДБВВВГВВБГВГДАДБАБГГГВДБГ', 'ДДБДВГВАДДГВВГББВГГБАВБДВАВАВГ'],
  [2022, 'ГГВВГГАВВГБГВГАБДГДВБДБГААДВ', 'ВВДБДГАГВББАБАГДВВГГАГВВААДДВД'],
  [2023, 'ГВГААВББВБВДБДБДВДДГВДВДВВБГ', 'АВДВГДГГВДВГБВДДВБДВГБВГГБВБАД'],
  [2024, 'ВГВАДДДВДАГВБДВДДАГББГБГААБА', 'ВДВВДДГГГАДБГДАДББДБВВАБГГББВБ'],
];

test('the two Russian archives for every year retain the official order, keys and walkthroughs', () => {
  const {catalog, lessons} = loadLessonCatalog();
  const rating = JSON.parse(fs.readFileSync(path.join(dist, 'api/rating-catalog.json')));
  const entries = new Map(catalog.map(edition => [edition.id, edition]));
  for (const [year, junior, middle] of archiveKeys) {
    for (const [grade, key] of [['2-3', junior], ['4-5', middle]]) {
      const edition = entries.get(year + '-medvezhonok-' + grade);
      assert.equal(edition.subject, 'ru');
      assert.equal(edition.indices.length, key.length);
      for (const [i, index] of edition.indices.entries()) {
        const lesson = lessons[index];
        const id = edition.id + '/' + (i + 1);
        const answer = id === '2004-medvezhonok-2-3/16' ? 2 : 'АБВГД'.indexOf(key[i]);
        assert.equal(lesson.number, i + 1, id);
        assert.ok(lesson.title.trim() && lesson.title.length <= 30 && lesson.question.trim(), id);
        assert.equal(lesson.choices.length, 5, id);
        assert.ok(lesson.choices.every((choice, j) => choice.trim() || lesson.choiceImages?.[j]), id);
        assert.equal(lesson.steps.length, 4, id);
        assert.ok(lesson.steps[1][2].trim() && lesson.steps[2][2].trim(), id);
        assert.notEqual(lesson.steps[1][2], lesson.steps[2][2], id);
        assert.equal(lesson.answer, answer, id);
        assert.deepEqual(rating[id], [answer, i < 10 ? 3 : i < 20 ? 4 : 5], id);
        for (const file of [lesson.conditionImage, ...(lesson.choiceImages ?? []),
          ...(lesson.choiceLayout?.condition?.items ?? []).map(item => item.src)].filter(Boolean)) {
          assert.ok(file.startsWith('assets/medvezhonok/' + year + '/') && fs.existsSync(path.join(dist, file)), id);
        }
      }
    }
  }
});

test('only the printed rebuses are shown on the answer buttons, and meaningful typography survives', () => {
  const {lessons} = loadLessonCatalog();
  const find = (edition, number) => lessons.find(lesson => lesson.datasetId === edition && lesson.number === number);
  for (const lesson of lessons.filter(lesson => lesson.datasetId.includes('-medvezhonok-') && lesson.choiceImages?.some(Boolean))) {
    assert.equal(lesson.choiceImages.filter(Boolean).length, 5, lesson.datasetId);
    if (lesson.year !== 2024 || lesson.number !== 5) {
      assert.ok(lesson.choiceLayout.options.every(option => !option.text && option.description.trim()), lesson.title);
    }
  }
  const stress = find('2012-medvezhonok-2-3', 20);
  assert.deepEqual([...stress.formattedQuestion.matchAll(/<u>(.*?)<\/u>/g)].map(match => match[1].replace(/<[^>]*>/g, '')), ['т', 'т', 'д']);
  assert.equal(find('2017-medvezhonok-4-5', 4).choices[4], ';');
});
