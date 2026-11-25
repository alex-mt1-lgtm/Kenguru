'use strict';

(() => {
  const ink = '#172e34';
  const teal = '#237e79';
  const orange = '#db6338';
  const line = '#cbdacf';
  const pale = '#edf4ea';
  const paper = '#fffefa';

  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const svg = (markup, label, box = '0 0 640 300', className = '') =>
    `<svg${className ? ` class="${className}"` : ''} viewBox="${box}" role="img" aria-label="${escape(label)}">${markup}</svg>`;
  function reveal(frame, delay = 0) {
    const fraction = Math.max(0, Math.min(1, (frame - delay) / 3));
    return fraction * fraction * (3 - 2 * fraction);
  }
  const text = (x, y, value, size, color = ink) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${size}" font-weight="700" fill="${color}">${escape(value)}</text>`;
  const card = (x, y, w, h, fill = paper) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${line}"/>`;

  const numeral = '[0-9]+(?:[ \\u00A0\\u202F][0-9]{3}(?![0-9]))*(?:[.,][0-9]+)?';
  const mixedNumber = '[0-9]+[ \\u00A0\\u202F][0-9]+[ \\u00A0\\u202F]*/[ \\u00A0\\u202F]*[0-9]+';
  const numbers = `(?:${mixedNumber}|${numeral})`;
  const lexemes = new RegExp(`${numbers}|\\.{3}|[\\p{L}\\p{M}]+|\\s+|.`, 'gu');
  const number = new RegExp(`^${numbers}$`, 'u');
  const variable = /^(?:[a-zA-Zα-ωΑ-Ω]+[ᵃᵇⁿˣʸ]?|[АБВГДЕНРСТХ])$/u;
  const relation = /^[=<>≤≥≠≈]$/u;
  const operation = /^[+\-−–×*·⋅÷:/^]$/u;
  const suffix = /^[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺₀₁₂₃₄₅₆₇₈₉°%′″]$/u;
  const brackets = {'(': ')', '[': ']', '{': '}'};
  const caseWording = /(?:^|[^\p{L}])(?:если|пусть|бы|либо|допустим|предположим|иначе|случа\p{L}*|вариант\p{L}*|кандидат\p{L}*|подходят|подходит)(?=$|[^\p{L}])/iu;
  const caseQualifier = /(?:^|[^\p{L}])(?:при|для)(?:\s*$|\s+[^,.!?]*[=<>≤≥≠≈])/iu;
  const caseContinuation = /^(?:\s+(?:или|либо|невозмож\p{L}*|не\s+подходит)(?=$|[^\p{L}])|\s*,\s*(?:если\s|[0-9]))/iu;

  function completeEquation(tokens) {
    const pendingBrackets = [];
    let hasRelation = false;
    let needsOperand = true;
    let previous = '';
    for (const token of tokens) {
      if (relation.test(token)) {
        if (needsOperand || pendingBrackets.length) return false;
        hasRelation = true;
        needsOperand = true;
      } else if (Object.hasOwn(brackets, token)) {
        pendingBrackets.push(brackets[token]);
        needsOperand = true;
      } else if (/[)\]}]/u.test(token)) {
        if (needsOperand || pendingBrackets.pop() !== token) return false;
      } else if (operation.test(token)) {
        if (needsOperand && !/^[+\-−–]$/u.test(token)) return false;
        needsOperand = true;
      } else if (suffix.test(token)) {
        if (needsOperand) return false;
      } else if (/^[√∛∜∠]$/u.test(token)) {
        needsOperand = true;
      } else if (number.test(token) || variable.test(token) || token === '…' || token === '...') {
        if (!needsOperand && number.test(token) && (number.test(previous) || variable.test(previous))) return false;
        needsOperand = false;
      } else {
        return false;
      }
      previous = token;
    }
    return hasRelation && !needsOperand && !pendingBrackets.length;
  }

  function expressions(wording) {
    const equations = [];
    const assignments = new Map();
    let span = [];
    let sentenceStart = 0;
    function collect() {
      // A colon before a formula may introduce it in the surrounding sentence.
      if (span[0]?.[0] === ':') span.shift();
      if (/^[АБВГДA-E]$/u.test(span[0]?.[0] ?? '') && span[1]?.[0] === ')') span.splice(0, 2);
      const tail = span.at(-1);
      // A spaced dash at the end of a formula introduces explanatory prose.
      if (tail?.[0] === '–' && /\s/u.test(wording[tail.index - 1]) && /\s/u.test(wording[tail.index + 1])) span.pop();
      const tokens = span.map(match => match[0]);
      if (span.length && completeEquation(tokens)) {
        const last = span.at(-1);
        const end = last.index + last[0].length;
        const symbolic = tokens.some(token => token !== 'π' && variable.test(token));
        const lead = wording.slice(sentenceStart, span[0].index);
        // A symbolic relation in a case belongs with its qualifier in the explanation.
        if (!symbolic || !(caseWording.test(lead) || caseQualifier.test(lead) || caseContinuation.test(wording.slice(end)))) {
          const equals = tokens.indexOf('=');
          const scalar = tokens.at(-1);
          const subject = symbolic && equals === tokens.length - 2 && number.test(scalar)
            ? tokens.slice(0, equals).join('') : '';
          if (subject) {
            if (!assignments.has(subject)) assignments.set(subject, new Set());
            assignments.get(subject).add(scalar);
          }
          equations.push({subject, value: wording.slice(span[0].index, end).replace(/\s+/gu, ' ')});
        }
      }
      span = [];
    }
    for (const match of wording.matchAll(lexemes)) {
      const token = match[0];
      if (/^\s+$/u.test(token)) {
        if (/[\r\n]/u.test(token)) collect();
        continue;
      }
      if (token === ':' && /\s/u.test(wording[match.index + 1]) && !/\s/u.test(wording[match.index - 1])) {
        collect();
        continue;
      }
      // Keep unsupported math inside its span so that it cannot leave a valid-looking fragment.
      if (number.test(token) || variable.test(token) || /[\p{Sm}\p{No}°%′″!()[\]{}^_:/\-*–·⋅…]/u.test(token) || token === '...') {
        span.push(match);
      } else if (/^\p{L}/u.test(token) && span.at(-1)?.index + span.at(-1)?.[0].length === match.index) {
        span.push(match);
      } else {
        collect();
        if (token === '.' || token === '?') sentenceStart = match.index + token.length;
      }
    }
    collect();
    // Different values for the same expression require their separate cases.
    return equations.filter(({subject}) => !subject || assignments.get(subject).size === 1).map(({value}) => value);
  }

  function arithmeticModel(expression, frame) {
    const match = expression.match(/^(\d+)\s*([+−×·⋅])\s*(\d+)\s*=\s*(\d+)$/u);
    if (!match) return '';
    const [, left, operator, right, result] = match;
    const [a, b, c] = [left, right, result].map(Number);
    if (operator === '+' && a + b === c && a > 0 && b > 0) {
      const first = 420 * a / c;
      const rest = 420 - first;
      const growth = reveal(frame, .6);
      return card(110, 35, 420, 50, pale)
        + `<rect x="110" y="35" width="${first}" height="50" rx="10" fill="${teal}"/>`
        + `<rect x="${110 + first}" y="35" width="${rest * growth}" height="50" rx="10" fill="${orange}"/>`
        + (first >= 40 ? text(110 + first / 2, 68, a, 22, paper) : '')
        + (rest >= 40 && growth >= .8 ? text(110 + first + rest / 2, 68, b, 22, paper) : '');
    }
    if (operator === '−' && a - b === c && b > 0 && c > 0) {
      const remaining = 420 * c / a;
      const removed = 420 - remaining;
      const growth = reveal(frame, .6);
      return card(110, 35, 420, 50, pale)
        + `<rect x="110" y="35" width="${remaining}" height="50" rx="10" fill="${teal}"/>`
        + `<rect x="${110 + remaining}" y="35" width="${removed}" height="50" rx="10" fill="${orange}" opacity="${1 - .75 * growth}"/>`
        + `<path d="M${110 + remaining} 60 h${removed * growth}" stroke="${ink}" stroke-width="3"/>`
        + (remaining >= 40 ? text(110 + remaining / 2, 68, c, 22, paper) : '');
    }
    if (/[×·⋅]/u.test(operator) && a * b === c && a >= 2 && b >= 2 && c <= 60) {
      const unit = Math.min(25, 110 / a, 430 / b);
      const start = (640 - unit * b) / 2;
      return Array.from({length: c}, (_, index) => {
        const row = Math.floor(index / b);
        const col = index % b;
        return `<rect x="${start + col * unit + 2}" y="${14 + row * unit + 2}" width="${unit - 4}" height="${unit - 4}" rx="3" fill="${row % 2 ? orange : teal}" opacity="${.2 + .8 * reveal(frame, row * .3)}"/>`;
      }).join('');
    }
    return '';
  }

  function workedScene(step, frame) {
    const calculations = expressions(step.text).slice(0, 3);
    const figure = step.image && step.imageWidth > 0 && step.imageHeight > 0 ? step : null;
    if (!figure && !calculations.length) return '';
    const model = calculations.length === 1 && !figure ? arithmeticModel(calculations[0], frame) : '';
    const imageScale = figure ? Math.min(560 / figure.imageWidth, 310 / figure.imageHeight, 1.65) : 0;
    const imageWidth = figure ? figure.imageWidth * imageScale : 0;
    const imageHeight = figure ? figure.imageHeight * imageScale : 0;
    const top = figure ? imageHeight + 30 : model ? 131 : 16;
    const figureMarkup = figure
      ? `<image href="${escape(figure.image)}" x="${(640 - imageWidth) / 2}" y="12" width="${imageWidth}" height="${imageHeight}" opacity="${.32 + .68 * reveal(frame)}"/>` : '';
    const rows = calculations.map((value, index) => {
      const y = top + 66 * index;
      const fontSize = Math.min(27, 760 / value.length);
      const opacity = .25 + .75 * reveal(frame, index * .48);
      return card(38, y, 564, 52, pale)
        + `<g opacity="${opacity}">${text(320, y + 35, value, fontSize)}</g>`;
    }).join('');
    const height = calculations.length ? top + 66 * calculations.length : imageHeight + 24;
    return svg(figureMarkup + model + rows, [figure ? figure.imageAlt ?? 'Рисунок из официального решения' : '', ...calculations].filter(Boolean).join('. '), `0 0 640 ${height}`, 'worked-scene');
  }

  function answerScene({letter, value, image, width, height}) {
    if (image) {
      const scale = Math.min(1, 520 / width);
      const w = width * scale;
      const h = height * scale;
      return svg(`<image href="${escape(image)}" x="${(640 - w) / 2}" y="8" width="${w}" height="${h}"/>`,
        'Ответ из официального ключа', `0 0 640 ${h + 16}`, 'worked-scene');
    }
    if (!letter) return '';
    const suffix = value && value.length < 27 ? ' · ' + value : '';
    return svg(card(115, 12, 410, 78, pale) + text(320, 63, letter + suffix, Math.min(34, 530 / (letter.length + suffix.length)), teal),
      'Официальный ответ ' + letter + suffix, '0 0 640 104', 'worked-scene answer-key-scene');
  }

  globalThis.KenguruVisual = {svg, reveal, escape, workedScene, answerScene};
})();
