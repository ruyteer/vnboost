"use strict";
const fs = require("fs");
const path = require("path");

// ===========================================================================
//  >>> TROQUE AQUI pela URL da sua API no Railway depois do deploy <<<
//  Ex.: "https://vn-boost-api.up.railway.app"
//  (tambem da pra sobrescrever com a variavel de ambiente VN_API_BASE)
// ===========================================================================
const API_BASE = "https://radiant-curiosity-production-5712.up.railway.app";

const GRACE_DAYS = 3;          // dias que funciona offline apos a ultima validacao
const TIMEOUT_MS = 6000;

let cacheFile = null;
function init(userDataDir) { cacheFile = path.join(userDataDir, "vn-license.json"); }

function readCache() {
  try { return JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch { return null; }
}
function writeCache(obj) {
  try { fs.writeFileSync(cacheFile, JSON.stringify(obj, null, 2), "utf8"); } catch {}
}
function clearCache() { try { fs.unlinkSync(cacheFile); } catch {} }

async function postJson(route, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(API_BASE + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return await r.json();
  } finally { clearTimeout(t); }
}

// Ativa a chave (vincula ao HWID no 1o uso).
async function activate(key, hwid) {
  const r = await postJson("/api/activate", { key: String(key).trim(), hwid });
  if (r && r.ok) {
    writeCache({ key: String(key).trim(), hwid, valid: true, lastValidated: Date.now(), expiresAt: r.expiresAt || null, plan: r.plan || null });
  }
  return r;
}

// Verifica a licenca atual (online; cai pro cache offline se sem internet).
async function check(hwid) {
  const cache = readCache();
  if (!cache || !cache.key) return { licensed: false, reason: "no_key" };

  try {
    const r = await postJson("/api/validate", { key: cache.key, hwid });
    if (r && r.ok) {
      writeCache({ ...cache, hwid, valid: true, lastValidated: Date.now(), expiresAt: r.expiresAt || null, plan: r.plan || null });
      return { licensed: true, mode: "online", expiresAt: r.expiresAt || null, plan: r.plan || null };
    }
    writeCache({ ...cache, valid: false, reason: r ? r.reason : "invalid" });
    return { licensed: false, reason: r ? r.reason : "invalid" };
  } catch (e) {
    // Sem internet: usa o cache dentro do periodo de tolerancia.
    if (cache.valid && cache.lastValidated && (Date.now() - cache.lastValidated) < GRACE_DAYS * 86400000) {
      if (cache.expiresAt && new Date(cache.expiresAt).getTime() < Date.now())
        return { licensed: false, reason: "expired" };
      return { licensed: true, mode: "offline", expiresAt: cache.expiresAt || null, plan: cache.plan || null };
    }
    return { licensed: false, reason: "offline_no_cache" };
  }
}

function current() { const c = readCache(); return c ? { key: c.key, expiresAt: c.expiresAt, plan: c.plan } : null; }

// ---- Consultas protegidas (heartbeat: validam licenca a cada chamada) ----
// Usam a chave salva no cache + o hwid passado. Lancam erro se sem internet.
async function fetchCatalog(hwid) {
  const c = readCache();
  if (!c || !c.key) return { ok: false, reason: "no_key" };
  return postJson("/api/catalog", { key: c.key, hwid });
}
async function fetchAction(hwid, id, op) {
  const c = readCache();
  if (!c || !c.key) return { ok: false, reason: "no_key" };
  return postJson("/api/action", { key: c.key, hwid, id, op });
}
async function fetchGame(hwid, name) {
  const c = readCache();
  if (!c || !c.key) return { ok: false, reason: "no_key" };
  return postJson("/api/game", { key: c.key, hwid, name });
}

module.exports = { init, activate, check, clearCache, current, API_BASE, fetchCatalog, fetchAction, fetchGame };
