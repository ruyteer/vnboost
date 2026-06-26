"use strict";
const fs = require("fs");
const path = require("path");

// Guarda o estado original (valores de registro antes de mexer) num JSON
// dentro da pasta de dados do usuario, pra conseguir reverter depois.
let backupFile = null;
let cache = {};

function init(userDataDir) {
  backupFile = path.join(userDataDir, "precision-fix-backup.json");
  try {
    if (fs.existsSync(backupFile)) {
      cache = JSON.parse(fs.readFileSync(backupFile, "utf8")) || {};
    }
  } catch (e) {
    cache = {};
  }
}

function flush() {
  try {
    fs.writeFileSync(backupFile, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    /* ignora erro de escrita */
  }
}

// Salva o estado original de um tweak (so na primeira vez, pra nao
// sobrescrever o valor verdadeiramente original em re-aplicacoes).
function save(tweakId, state) {
  if (!cache[tweakId]) {
    cache[tweakId] = state;
    flush();
  }
}

function get(tweakId) {
  return cache[tweakId] || null;
}

function clear(tweakId) {
  delete cache[tweakId];
  flush();
}

module.exports = { init, save, get, clear };
