"use strict";
const fs = require("fs");
const path = require("path");

let customPath = null;
let cfgFile = null;

function init(userDataDir) {
  cfgFile = path.join(userDataDir, "vn-fivem.json");
  try { customPath = (JSON.parse(fs.readFileSync(cfgFile, "utf8")).path) || null; } catch (e) { customPath = null; }
}
function setPath(p) {
  customPath = p || null;
  try { fs.writeFileSync(cfgFile, JSON.stringify({ path: customPath }), "utf8"); } catch (e) {}
  return info();
}

function autoApp() {
  const la = process.env.LOCALAPPDATA;
  if (!la) return null;
  const d = path.join(la, "FiveM", "FiveM.app");
  return fs.existsSync(d) ? d : null;
}
function appDir() {
  if (customPath && fs.existsSync(customPath)) {
    if (path.basename(customPath).toLowerCase() === "data") return path.dirname(customPath);
    return customPath;
  }
  return autoApp();
}
function dataDir() {
  const a = appDir();
  if (!a) return null;
  const d = path.join(a, "data");
  if (fs.existsSync(d)) return d;
  if (fs.existsSync(path.join(a, "server-cache")) || fs.existsSync(path.join(a, "cache"))) return a;
  return null;
}
function info() { const a = appDir(); return { found: !!dataDir(), app: a || null, data: dataDir(), custom: !!customPath }; }

const fsp = fs.promises;
// Assincrono e tolerante a erro: arquivo travado/sem acesso e pulado.
async function rmContents(dir, exclude) {
  exclude = exclude || [];
  let entries;
  try { entries = await fsp.readdir(dir); } catch (e) { return 0; }
  let n = 0;
  for (const e of entries) {
    if (exclude.includes(e)) continue;
    try { await fsp.rm(path.join(dir, e), { recursive: true, force: true }); n++; } catch (err) {}
  }
  return n;
}
async function cleanCacheSafe(log) {
  const say = log || (() => {});
  const data = dataDir();
  if (!data) { say("FiveM nao encontrado. Use 'Escolher pasta' na aba FiveM."); return { ok: false, reason: "not_found" }; }
  try {
    let n = 0;
    say("Limpando cache do FiveM... (pode levar alguns segundos)");
    n += await rmContents(path.join(data, "server-cache"));
    n += await rmContents(path.join(data, "server-cache-priv"));
    n += await rmContents(path.join(data, "cache"), ["game-storage"]);
    say(`Cache do FiveM limpo (${n} itens). game-storage preservado.`);
    return { ok: true, removed: n };
  } catch (e) {
    say("Erro ao limpar cache: " + (e && e.message ? e.message : e));
    return { ok: false, reason: "error" };
  }
}

function commandlinePath() { const a = appDir(); return a ? path.join(a, "commandline.txt") : null; }
function readCommandline() {
  const p = commandlinePath();
  if (!p) return { ok: false, reason: "not_found" };
  try { return { ok: true, path: p, text: fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "" }; }
  catch (e) { return { ok: false, reason: "read_error" }; }
}
function writeCommandline(text) {
  const p = commandlinePath();
  if (!p) return { ok: false, reason: "not_found" };
  try { fs.writeFileSync(p, text == null ? "" : String(text), "utf8"); return { ok: true, path: p }; }
  catch (e) { return { ok: false, reason: "write_error" }; }
}

module.exports = { init, setPath, info, cleanCacheSafe, readCommandline, writeCommandline };
