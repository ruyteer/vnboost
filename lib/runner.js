"use strict";
const { exec } = require("child_process");

// Roda um comando do Windows (cmd) e devolve sempre uma Promise resolvida
// com { ok, stdout, stderr, code } - nunca rejeita, pra facilitar o fluxo.
function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: (stdout || "").toString(),
        stderr: (stderr || "").toString(),
        code: err ? err.code : 0,
      });
    });
  });
}

// Le um valor do registro. Retorna { type, data } ou null se nao existir.
async function regGet(keyPath, valueName) {
  const r = await run(`reg query "${keyPath}" /v "${valueName}"`);
  if (!r.ok) return null;
  const esc = valueName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = r.stdout.match(new RegExp(esc + "\\s+(REG_[A-Z_]+)\\s+([^\\r\\n]*)"));
  if (!m) return null;
  return { type: m[1].trim(), data: m[2].trim() };
}

// Grava um valor no registro.
async function regSet(keyPath, valueName, type, data) {
  // REG_BINARY: o reg.exe espera a string hex sem espacos.
  const d = data === undefined || data === null ? "" : String(data);
  return run(`reg add "${keyPath}" /v "${valueName}" /t ${type} /d "${d}" /f`);
}

// Apaga um valor do registro.
async function regDelete(keyPath, valueName) {
  return run(`reg delete "${keyPath}" /v "${valueName}" /f`);
}

module.exports = { run, regGet, regSet, regDelete };
