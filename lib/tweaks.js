"use strict";
// EXECUTOR. As definicoes vem do servidor; aqui executamos a instrução e
// cuidamos do backup/estado local (backup existe = tweak ativo).
const path = require("path");
const { run, regGet, regSet, regDelete, regSubkeys } = require("./runner");
const backup = require("./backup");

const IFEO = "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options";
const NAGLE_BASE = "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces";

let ESL_PATH = path.join(__dirname, "..", "resources", "EmptyStandbyList.exe");
function setEslPath(p) { ESL_PATH = p; }

// instr = { id, name, action, reg[], cmds[], special }
async function applyInstruction(id, instr, log) {
  const say = log || (() => {});
  const name = (instr && instr.name) || id;
  say(`Aplicando "${name}"...`);

  // 1) captura o estado original (registro + nagle) para poder reverter
  const original = [];
  if (instr.reg && instr.reg.length) {
    for (const r of instr.reg) original.push({ path: r.path, name: r.name, prev: await regGet(r.path, r.name) });
  }
  let nagleSubs = [];
  if (instr.special === "nagle") {
    nagleSubs = await regSubkeys(NAGLE_BASE);
    for (const sk of nagleSubs) {
      for (const n of ["TcpAckFrequency", "TCPNoDelay"]) original.push({ path: sk, name: n, prev: await regGet(sk, n) });
    }
  }
  // marca como ativo (mesmo se nao tiver registro) - exceto acoes pontuais
  if (!instr.action) backup.save(id, { reg: original });

  // 2) aplica
  if (instr.reg && instr.reg.length) {
    for (const r of instr.reg) {
      const res = await regSet(r.path, r.name, r.type, r.data);
      if (!res.ok) say(`  ! falha em ${r.name}: ${res.stderr.trim()}`);
    }
  }
  if (instr.special === "nagle") {
    for (const sk of nagleSubs) {
      await regSet(sk, "TcpAckFrequency", "REG_DWORD", "1");
      await regSet(sk, "TCPNoDelay", "REG_DWORD", "1");
    }
    say(`  > Nagle desativado em ${nagleSubs.length} interface(s) de rede.`);
  }
  if (instr.cmds) {
    for (const c of instr.cmds) {
      const res = await run(c);
      if (!res.ok && !/^(sc\s+stop|net\s+stop)\b/i.test(c)) {
        const err = (res.stderr || res.stdout || ("codigo " + res.code)).split(/\r?\n/).find(Boolean) || "";
        say(`  ! ${c}  ->  ${err.trim()}`);
      }
    }
  }
  if (instr.special === "standbylist") {
    const res = await run(`"${ESL_PATH}" standbylist`);
    say(res.ok ? "  > standby list limpa." : "  ! EmptyStandbyList.exe nao encontrado em resources/.");
  }
  if (instr.special === "ramfull") {
    for (const mode of ["workingsets", "modifiedpagelist", "standbylist"]) {
      const res = await run(`"${ESL_PATH}" ${mode}`);
      if (!res.ok) { say("  ! EmptyStandbyList.exe nao encontrado em resources/."); break; }
      say(`  > ${mode} limpo.`);
    }
  }
  say(instr.action ? `"${name}" executado.` : `"${name}" aplicado.`);
  return { ok: true };
}

// instr = { id, name, action, revert[] }
async function revertInstruction(id, instr, log) {
  const say = log || (() => {});
  const name = (instr && instr.name) || id;
  if (instr.action) { say(`"${name}" e uma acao unica (nao tem reverter).`); return { ok: true }; }
  say(`Revertendo "${name}"...`);

  const saved = backup.get(id);
  if (saved && saved.reg) {
    for (const item of saved.reg) {
      if (item.prev) await regSet(item.path, item.name, item.prev.type, item.prev.data);
      else await regDelete(item.path, item.name);
    }
  }
  if (instr.revert) {
    for (const c of instr.revert) {
      const res = await run(c);
      if (!res.ok && !/^(sc\s+start|net\s+start|sc\s+stop|net\s+stop)\b/i.test(c)) {
        const err = (res.stderr || res.stdout || ("codigo " + res.code)).split(/\r?\n/).find(Boolean) || "";
        say(`  ! ${c}  ->  ${err.trim()}`);
      }
    }
  }
  backup.clear(id);
  say(`"${name}" revertido.`);
  return { ok: true };
}

// ---- Jogos ----
async function applyGameExes(name, exes, log) {
  const say = log || (() => {});
  say(`Priorizando "${name}"...`);
  const original = [];
  for (const exe of exes) {
    const p = `${IFEO}\\${exe}\\PerfOptions`;
    original.push({ path: p, name: "CpuPriorityClass", prev: await regGet(p, "CpuPriorityClass") });
    await regSet(p, "CpuPriorityClass", "REG_DWORD", "3");
  }
  backup.save("game:" + name, { reg: original });
  say(`"${name}" com prioridade Alta.`);
  return { ok: true };
}
async function revertGameExes(name, exes, log) {
  const say = log || (() => {});
  say(`Revertendo prioridade de "${name}"...`);
  const saved = backup.get("game:" + name);
  if (saved && saved.reg) {
    for (const item of saved.reg) {
      if (item.prev) await regSet(item.path, item.name, item.prev.type, item.prev.data);
      else await regDelete(item.path, item.name);
    }
  } else {
    for (const exe of exes) await regDelete(`${IFEO}\\${exe}\\PerfOptions`, "CpuPriorityClass");
  }
  backup.clear("game:" + name);
  say(`"${name}" revertido.`);
  return { ok: true };
}

// Le o estado REAL no PC a partir de um "probe" (reg ou cmd).
function regEquals(cur, expected) {
  const a = String(cur.data).trim(), b = String(expected).trim();
  if (cur.type === "REG_DWORD") {
    const na = a.toLowerCase().startsWith("0x") ? parseInt(a, 16) : parseInt(a, 10);
    const nb = b.toLowerCase().startsWith("0x") ? parseInt(b, 16) : parseInt(b, 10);
    return na === nb;
  }
  return a.toUpperCase() === b.toUpperCase();
}
async function probeState(probe) {
  if (!probe) return null;
  if (probe.type === "reg") {
    const cur = await regGet(probe.path, probe.name);
    return cur ? regEquals(cur, probe.equals) : false;
  }
  if (probe.type === "cmd") {
    const r = await run(probe.run);
    return (r.stdout || "").toUpperCase().includes(String(probe.contains).toUpperCase());
  }
  return null;
}
// Recebe o catalogo (com probes) e retorna os ids realmente aplicados.
async function probeAll(tweaksMeta) {
  const applied = [];
  for (const t of (tweaksMeta || [])) {
    if (t.action) continue;
    let on = t.probe ? await probeState(t.probe) : null;
    if (on === null) on = !!backup.get(t.id); // sem probe -> usa o que o app aplicou
    if (on) applied.push(t.id);
  }
  return applied;
}
function gamesApplied() {
  return backup.appliedIds().filter((k) => k.startsWith("game:")).map((k) => k.slice(5));
}

module.exports = { setEslPath, applyInstruction, revertInstruction, applyGameExes, revertGameExes, probeAll, gamesApplied };
