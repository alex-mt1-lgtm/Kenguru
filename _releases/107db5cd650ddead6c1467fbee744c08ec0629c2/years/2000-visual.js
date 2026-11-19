'use strict';

(() => {
  const ink = '#172e34';
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const svg = (body, label) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 300" role="img" aria-label="${escape(label)}">${body}</svg>`;
  const text = (x, y, label, size = 24, fill = ink, anchor = 'middle', baseline = 'middle') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="${baseline}" font-family="Arial, sans-serif" font-size="${size}" style="fill:${fill}">${escape(label)}</text>`;
  const panel = (x, y, width, height, fill = '#eaf0e6') =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${fill}"/>`;

  globalThis.KENGURU_2000_VISUAL = {svg, text, panel};
})();
