"use strict";
// EXECUTOR. As definicoes (o que rodar) vem do servidor; aqui so executamos
// a "instrução" recebida e cuidamos do backup/revert local.
const path = require("path");
const { run, regGet, regSet, regDelete, regSubkeys } = require("./runner");
const backup = require("./backup");

const IFEO = "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options";

let ESL_PATH = path.join(__dirname, "..", "resources", "EmptyStandbyList.exe");
function setEslPath(p) { ESL_PATH = p; }

// instr = { id, name, action, reg[], cmds[], special }
async function applyInstruction(id, instr, log) {
  const say = log || (() => {});
  const name = (instr && instr.name) || id;
  say(`Aplicando "${name}"...`);

  if (instr.reg && instr.reg.length) {
    const original = [];
    for (const r of instr.reg) {
      const cur = await regGet(r.path, r.name);
      original.push({ path: r.path, name: r.name, prev: cur });
    }
    backup.save(id, { reg: original });
    for (const r of instr.reg) {
      const res = await regSet(r.path, r.name, r.type, r.data);
      if (!res.ok) say(`  ! falha em ${r.name}: ${res.stderr.trim()}`);
    }
  }
  if (instr.cmds) {
    for (const c of instr.cmds) {
      const res = await run(c);
      if (!res.ok) say(`  ! comando: ${c.split(" ")[0]} retornou erro`);
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
  if (instr.special === "nagle") {
    const base = "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces";
    const subs = await regSubkeys(base);
    const original = [];
    for (const sk of subs) {
      for (const n of ["TcpAckFrequency", "TCPNoDelay"]) {
        const cur = await regGet(sk, n);
        original.push({ path: sk, name: n, prev: cur });
      }
    }
    backup.save(id, { reg: original });
    for (const sk of subs) {
      await regSet(sk, "TcpAckFrequency", "REG_DWORD", "1");
      await regSet(sk, "TCPNoDelay", "REG_DWORD", "1");
    }
    say(`  > Nagle desativado em ${subs.length} interface(s) de rede.`);
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
      if (!res.ok) say(`  ! reversao: ${c.split(" ")[0]} retornou erro`);
    }
  }
  backup.clear(id);
  say(`"${name}" revertido.`);
  return { ok: true };
}

// ---- Jogos (exes vem do servidor) ----
async function applyGameExes(name, exes, log) {
  const say = log || (() => {});
  say(`Priorizando "${name}"...`);
  const original = [];
  for (const exe of exes) {
    const p = `${IFEO}\\${exe}\\PerfOptions`;
    const cur = await regGet(p, "CpuPriorityClass");
    original.push({ path: p, name: "CpuPriorityClass", prev: cur });
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

module.exports = { setEslPath, applyInstruction, revertInstruction, applyGameExes, revertGameExes };
