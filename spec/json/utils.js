'use strict';

const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '..');

function jsonPath(p) {
  return path.join(base, 'json', p);
}

function walk(p, callback) {
  if (fs.existsSync(p)) {
    const stats = fs.lstatSync(p);

    if (stats.isDirectory()) {
      const content = fs.readdirSync(p);

      content.forEach(s => walk(path.join(p, s), callback));
    } else {
      callback(p);
    }
  }
}

function loadResponseForEditor(p, e) {
  let body;
  switch (typeof p) {
    case 'object':
      body = p;
      break;
    case 'string':
      body = require(jsonPath(p));
  }

  for (const k in body) {
    const v = body[k];
    if (v === 'filled-out-by-testrunner') {
      switch (k) {
        case 'source':
          body[k] = 'atom';
          break;
        case 'filename':
          body[k] = e.getPath();
          break;
      }
    }
  }

  return body;
}

module.exports = {
  jsonPath,
  walk,
  loadResponseForEditor,
};
