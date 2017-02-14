'use strict';

const {last, head, openExampleInWebURL} = require('../utils');
const {section, renderExample} = require('./html-utils');

const Highlights = require('highlights');

const escapeHTML = str =>
  str
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const removeWrapper = str =>
  str
  .replace('<pre class="editor editor-colors">', '')
  .replace('<div class="line">', '')
  .replace('</div>', '')
  .replace('</pre>', '');

const wrapLine = str => `<div class="line">${str}</div>`;

const wrapPre = str => `<pre class="editor editor-colors">${str}</pre>`;

const splitByLine = str => str.split('\n').reduce((m, l, i) => {
  return m.concat({
    start: last(m) ? last(m).end + 1 : 0,
    end: last(m) ? last(m).end + 1 + l.length : l.length,
    content: l,
    line: i,
  });
}, []);

const highlightChunk = (chunk, highlighter) =>
  highlighter.highlightSync({
    fileContents: chunk,
    scopeName: 'source.python',
  });

const refLink = (content, ref) =>
  `<a href="kite-atom-internal://value/${ref.fully_qualified}">${content}</a>`;

const processReferences = (line, references, highlighter) => {
  const res = references.reduce((o, ref) => {

    if (ref.begin >= o.start && ref.end <= o.end) {
      const prefix = o.remain.slice(0, ref.begin - o.start);
      const reference = o.remain.slice(ref.begin - o.start, ref.end - o.start);
      const postfix = o.remain.slice(ref.end - o.start);
      o.start = ref.end;
      o.remain = postfix;

      o.plain.push(removeWrapper(highlightChunk(prefix, highlighter)));
      o.references.push(refLink(removeWrapper(highlightChunk(reference, highlighter)), ref));
    }
    return o;
  }, {
    plain: [],
    references: [],
    remain: line.content,
    start: line.start,
    end: line.end,
  });

  return res.plain.map((p, i) => p + res.references[i]).join('') +
         removeWrapper(highlightChunk(res.remain, highlighter));
};

const wrapReferences = (lines, references, highlighter) =>
  lines.map(line => processReferences(line, references, highlighter));

const fileEntry = file =>
  `<li class='list-item'>
      <span class='icon icon-file-text'
            data-name="${file.name}">${file.name}</span>
  </li>`;

const isDir = l => l.mime_type === 'application/x-directory';

const dirEntry = dir => {
  const {listing} = dir;

  return `
  <li class='list-nested-item'>
    <div class='list-item'>
      <span class='icon icon-file-directory'
            data-name="${dir.name}">${dir.name}</span>
    </div>

    <ul class='list-tree'>${
      listing.map(l => isDir(l) ? dirEntry(l) : fileEntry(l)).join('')
    }</ul>
  </li>`;
};

const OUTPUTS = {
  image: part =>
    `<figcaption class="list-item"><span class='icon icon-file-text'
          data-name="${part.content.path}">${part.content.path}</span></figcaption>
     <img src="data:;base64,${part.content.data}" title="${part.content.path}">
    `,
  plaintext: part =>
    `<pre class="output"><code>${escapeHTML(part.content.value)}</code></pre>`,
  directory_listing_table: part => {
    const {caption, entries} = part.content;
    const columns = Object.keys(head(entries));

    return `
    <figcaption>${caption}</figcaption>
    <table>
      <tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>
      ${
        entries.map(e => `<tr>${
          columns.map(c => `<td>${e[c]}</td>`).join('')
        }</tr>`).join('')
      }
    </table>`;
  },
  directory_listing_tree: part => {
    const {caption, entries} = part.content;

    return `
    <figcaption>${caption}</figcaption>
    <ul class='list-tree root'>${dirEntry(entries)}</ul>
    `;
  },
  file: part =>
    `<figcaption class="list-item"><span class='icon icon-file-text'
          data-name="${part.content.caption}">${part.content.caption}</span></figcaption>
    <pre class="input"><code>${escapeHTML(atob(part.content.data))}</code></pre>`,
};


function processContent(content, highlighter) {
  return wrapPre(
    wrapReferences(
      splitByLine(content.code),
      content.references,
      highlighter
    ).map(wrapLine).join('')
  );
}


function processOutput(part) {
  return part.output_type && OUTPUTS[part.output_type]
    ? OUTPUTS[part.output_type](part)
    : `<pre><code>${JSON.stringify(part, null, 2)}</code></pre>`;
}

class KiteCuratedExample extends HTMLElement {
  static initClass() {
    return document.registerElement('kite-curated-example', {
      prototype: this.prototype,
    });
  }

  setData(data) {
    // console.log(JSON.stringify(data, null, 2));
    const highlighter = new Highlights({
      registry: atom.grammars,
      scopePrefix: 'syntax--',
    });
    const html = data.prelude.concat(data.code).concat(data.postlude)
    .map(part => {
      if (part.type === 'code') {
        return processContent(part.content, highlighter);
      } else if (part.type === 'output') {
        return processOutput(part);
      }

      return `<pre><code>${JSON.stringify(part, null, 2)}</code></pre>`;
    })
    .join('');
    const inputFiles = data.inputFiles;
    const inputHTML = inputFiles && inputFiles.length
      ? `<h5>Files used in this example</h5>
      ${inputFiles.map(f => {
        return `<figcaption class="list-item">
          <span class='icon icon-file-text'
                data-name="${f.name}">${f.name}</span>
          </figcaption><pre class="input"><code>${atob(f.contents_base64)}</code></pre>`;
      }).join('')}
      `
      : '';

    const relatedHTML = data.related && data.related.length
      ? section('Related Examples', `
        <ul>${data.related.map(renderExample).join('')}</ul>`)
      : '';

    this.innerHTML = `
      <div class="example-wrapper">
        <div class="example-code">${html}</div>
        ${inputHTML}
        <div class="related-examples">${relatedHTML}</div>
      </div>
      <footer>
        <div></div>
        <kite-open-link data-url="${openExampleInWebURL(data.id)}"></kite-open-link>
      </footer>
    `;
  }
}

module.exports = KiteCuratedExample.initClass();
