"use strict";
const $ = (s) => document.querySelector(s);
const logEl = $("#log");

function log(text) {
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}
window.api.onLog((t) => log(t));

function setBusy(b) { document.querySelectorAll(".btn,.perf-btn").forEach((x) => (x.disabled = b)); }
async function withBusy(fn) {
  setBusy(true);
  try { await fn(); } catch (e) { log("Erro: " + (e && e.message ? e.message : e)); }
  finally { setBusy(false); }
}

// ---------------- notificações ----------------
const LS_NOTIFS = "vn_notifs", LS_UNREAD = "vn_unread";
function getNotifs() { try { return JSON.parse(localStorage.getItem(LS_NOTIFS) || "[]"); } catch { return []; } }
function saveNotifs(a) { localStorage.setItem(LS_NOTIFS, JSON.stringify(a.slice(0, 100))); }
function getUnread() { return parseInt(localStorage.getItem(LS_UNREAD) || "0", 10); }
function setUnread(n) { localStorage.setItem(LS_UNREAD, String(n)); renderBadge(); }
function notify(text, type) {
  const a = getNotifs(); a.unshift({ text, type: type || "info", time: Date.now() }); saveNotifs(a);
  setUnread(getUnread() + 1);
  if ($("#screen-notifs").classList.contains("active")) renderNotifs();
}
function renderBadge() {
  const n = getUnread(), b = $("#notifBadge");
  if (n > 0) { b.hidden = false; b.textContent = n > 99 ? "99+" : String(n); } else b.hidden = true;
}
function fmtTime(ts) { const d = new Date(ts); return d.toLocaleDateString() + " " + d.toLocaleTimeString(); }
function renderNotifs() {
  const list = $("#notifsList"), a = getNotifs();
  if (!a.length) { list.innerHTML = `<div class="empty">Nenhuma notificação ainda.</div>`; return; }
  list.innerHTML = "";
  a.forEach((n) => {
    const el = document.createElement("div");
    el.className = "notif notif-" + n.type;
    el.innerHTML = `<div class="notif-dot"></div><div class="notif-body"><p>${n.text}</p><span>${fmtTime(n.time)}</span></div>`;
    list.appendChild(el);
  });
}

// ---------------- configurações ----------------
const LS_CONSOLE = "vn_show_console", LS_REBOOT = "vn_reboot_notif";
function applyConsoleSetting() { const on = localStorage.getItem(LS_CONSOLE) !== "0"; $("#console").hidden = !on; $("#setConsole").checked = on; }
function rebootNotifOn() { return localStorage.getItem(LS_REBOOT) !== "0"; }

// ---------------- navegação ----------------
function go(screen) {
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.screen === screen));
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("#screen-" + screen).classList.add("active");
  if (screen === "notifs") { setUnread(0); renderNotifs(); }
}

// ---------------- resultado de ação (server-gated) ----------------
function handleResult(res, okMsg) {
  if (res && res.ok) { if (okMsg) notify(okMsg, "ok"); return true; }
  if (res && res.offline) { notify("Sem conexão com o servidor.", "warn"); return false; }
  if (res && res.locked) { notify("Licença inválida/revogada — acesso bloqueado.", "warn"); showLock(res.reason); return false; }
  notify("Falha na operação.", "warn"); return false;
}

// ---------------- cards ----------------
function makeCard(t) {
  const card = document.createElement("div");
  card.className = "card" + (t.action ? " card-action" : "");
  const note = t.note ? `<div class="note">${t.note}</div>` : "";
  if (t.action) {
    card.innerHTML = `<h3>${t.name}</h3><p>${t.desc}</p>${note}
      <div class="card-actions"><button class="btn run">EXECUTAR</button></div>`;
    card.querySelector(".run").addEventListener("click", () => {
      if (t.confirm && !window.confirm(t.confirm)) return;
      withBusy(async () => handleResult(await window.api.apply(t.id), `Ação executada: ${t.name}`));
    });
  } else {
    card.innerHTML = `<h3>${t.name}</h3><p>${t.desc}</p>${note}
      <div class="card-actions">
        <button class="btn apply">APLICAR</button>
        <button class="btn revert">REVERTER</button>
      </div>`;
    card.querySelector(".apply").addEventListener("click", () =>
      withBusy(async () => {
        if (handleResult(await window.api.apply(t.id), `Aplicado: ${t.name}`))
          if (t.note && /reinici/i.test(t.note) && rebootNotifOn()) notify(`${t.name} exige reiniciar o PC.`, "warn");
      }));
    card.querySelector(".revert").addEventListener("click", () =>
      withBusy(async () => handleResult(await window.api.revert(t.id), `Revertido: ${t.name}`)));
  }
  return card;
}
function makeGameCard(g) {
  const card = document.createElement("div");
  card.className = "card card-game";
  card.dataset.name = g.name.toLowerCase();
  card.innerHTML = `<h3>${g.name}</h3>
    <div class="card-actions">
      <button class="btn apply">PRIORIZAR</button>
      <button class="btn revert">REVERTER</button>
    </div>`;
  card.querySelector(".apply").addEventListener("click", () =>
    withBusy(async () => handleResult(await window.api.applyGame(g.name), `Prioridade Alta: ${g.name}`)));
  card.querySelector(".revert").addEventListener("click", () =>
    withBusy(async () => handleResult(await window.api.revertGame(g.name), `Prioridade revertida: ${g.name}`)));
  return card;
}

// ---------------- catálogo (servidor) ----------------
async function loadCatalog() {
  const gp = $("#screen-precision .grid"), gw = $("#screen-windows .grid"), gs = $("#screen-system .grid"), gl = $("#gamesList");
  [gp, gw, gs, gl].forEach((g) => g && (g.innerHTML = ""));
  const cat = await window.api.catalog();
  if (!cat || !cat.ok) {
    if (cat && cat.offline) notify("Sem conexão com o servidor — recursos indisponíveis.", "warn");
    else showLock(cat && cat.reason);
    return;
  }
  const grids = { precision: gp, windows: gw, system: gs };
  cat.tweaks.forEach((t) => grids[t.cat] && grids[t.cat].appendChild(makeCard(t)));
  (cat.games || []).forEach((g) => gl.appendChild(makeGameCard(g)));
  $("#gameCount").textContent = `${(cat.games || []).length} jogos`;
  log(`Catálogo carregado: ${cat.tweaks.length} tweaks + ${(cat.games || []).length} jogos.`);
}

// ---------------- licença ----------------
let HWID = "";
function licReason(r) {
  return ({
    no_key: "Nenhuma chave ativada.", invalid: "Chave inválida.", revoked: "Chave revogada.",
    expired: "Licença expirada.", hwid_mismatch: "Esta chave já está vinculada a outro computador.",
    not_activated: "Chave ainda não ativada.", offline_no_cache: "Sem internet e sem validação recente.",
    missing: "Preencha a chave.",
  })[r] || "Não foi possível validar a licença.";
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : "nunca"; }
function showLock(reason) {
  $("#lockScreen").hidden = false;
  const m = $("#lockMsg");
  if (reason && reason !== "no_key") { m.className = "lock-msg err"; m.textContent = licReason(reason); }
  else { m.className = "lock-msg"; m.textContent = ""; }
}
async function renderLicCard(st) {
  const cur = await window.api.licenseCurrent();
  $("#licKey").textContent = cur && cur.key ? cur.key : "—";
  const exp = (st && st.expiresAt) || (cur && cur.expiresAt) || null;
  $("#licExpires").textContent = exp ? fmtDate(exp) : "nunca";
  const tag = $("#licStatus");
  if (st && st.licensed) { tag.className = "tag ok"; tag.textContent = st.mode === "offline" ? "ativa (offline)" : "ativa"; }
  else { tag.className = "tag bad"; tag.textContent = "inativa"; }
}
async function unlock(st) { $("#lockScreen").hidden = true; await renderLicCard(st); await loadCatalog(); }

async function initLicense() {
  HWID = await window.api.licenseHwid();
  $("#lockHwid").textContent = HWID; $("#licHwid").textContent = HWID;
  const st = await window.api.licenseStatus();
  if (st.licensed) await unlock(st); else showLock(st.reason);

  $("#lockActivate").addEventListener("click", async () => {
    const key = $("#lockKey").value.trim(), m = $("#lockMsg");
    if (!key) { m.className = "lock-msg err"; m.textContent = "Preencha a chave."; return; }
    $("#lockActivate").disabled = true; m.className = "lock-msg"; m.textContent = "Validando...";
    try {
      const r = await window.api.licenseActivate(key);
      if (r && r.ok) { m.className = "lock-msg ok"; m.textContent = "Ativado!"; const st2 = await window.api.licenseStatus(); await unlock(st2); notify("Licença ativada neste PC.", "ok"); }
      else { m.className = "lock-msg err"; m.textContent = licReason(r ? r.reason : "invalid"); }
    } catch (e) { m.className = "lock-msg err"; m.textContent = "Erro ao conectar na API."; }
    finally { $("#lockActivate").disabled = false; }
  });
  $("#lockKey").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#lockActivate").click(); });
  $("#lockCopyHwid").addEventListener("click", () => navigator.clipboard.writeText(HWID));
  $("#licCopyHwid").addEventListener("click", () => navigator.clipboard.writeText(HWID));
  $("#licDeactivate").addEventListener("click", async () => {
    if (!confirm("Desativar a licença neste app?")) return;
    await window.api.licenseDeactivate(); $("#lockKey").value = ""; showLock("no_key");
    await renderLicCard({ licensed: false }); notify("Licença desativada neste PC.", "info");
  });
}

// ---------------- métricas ----------------
function gb(b) { return (b / 1073741824).toFixed(1); }
function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
}
async function updateMetrics() {
  try {
    const m = await window.api.getMetrics();
    const cpu = Math.round(m.cpu);
    $("#cpuPct").textContent = cpu + "%"; $("#cpuBar").style.width = cpu + "%"; $("#cpuModel").textContent = m.cpuModel;
    const used = m.memTotal - m.memFree, memPct = Math.round((used / m.memTotal) * 100);
    $("#memPct").textContent = memPct + "%"; $("#memBar").style.width = memPct + "%"; $("#memSub").textContent = `${gb(used)} / ${gb(m.memTotal)} GB`;
    $("#cores").textContent = m.cores; $("#uptime").textContent = fmtUptime(m.uptime);
    $("#osinfo").textContent = `Windows (${m.arch})`; $("#host").textContent = m.hostname;
  } catch (e) {}
}

// ---------------- init ----------------
async function init() {
  document.querySelectorAll(".nav-item").forEach((n) => n.addEventListener("click", () => go(n.dataset.screen)));
  document.querySelectorAll(".shortcut").forEach((s) => s.addEventListener("click", () => go(s.dataset.go)));

  // atalhos de performance
  const perfActions = {
    precision: async () => handleResult(await window.api.applyAll("precision"), "Precision Fix ativado."),
    ram: async () => handleResult(await window.api.apply("ramfull"), "Memória RAM limpa."),
    cache: async () => handleResult(await window.api.apply("limparcache"), "Cache do Windows limpo."),
    ping: async () => handleResult(await window.api.apply("ping"), "Ping otimizado."),
  };
  document.querySelectorAll(".perf-btn").forEach((b) => b.addEventListener("click", () => withBusy(perfActions[b.dataset.perf])));

  // aplicar/reverter tudo
  document.querySelectorAll("[data-applyall]").forEach((b) => b.addEventListener("click", () =>
    withBusy(async () => handleResult(await window.api.applyAll(b.dataset.applyall), `Aplicado tudo: ${b.dataset.applyall}`))));
  document.querySelectorAll("[data-revertall]").forEach((b) => b.addEventListener("click", () =>
    withBusy(async () => handleResult(await window.api.revertAll(b.dataset.revertall), `Revertido tudo: ${b.dataset.revertall}`))));

  // busca de jogos
  $("#gameSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase(); let shown = 0;
    $("#gamesList").querySelectorAll(".card-game").forEach((c) => { const ok = c.dataset.name.includes(q); c.style.display = ok ? "" : "none"; if (ok) shown++; });
    $("#gameCount").textContent = `${shown} jogos`;
  });

  // notificações
  renderBadge();
  $("#clearNotifs").addEventListener("click", () => { saveNotifs([]); setUnread(0); renderNotifs(); });

  // configurações
  applyConsoleSetting();
  $("#setConsole").addEventListener("change", (e) => { localStorage.setItem(LS_CONSOLE, e.target.checked ? "1" : "0"); applyConsoleSetting(); });
  $("#setRebootNotif").checked = rebootNotifOn();
  $("#setRebootNotif").addEventListener("change", (e) => localStorage.setItem(LS_REBOOT, e.target.checked ? "1" : "0"));

  $("#clearLog").addEventListener("click", () => { logEl.innerHTML = ""; });
  $("#tlClose").addEventListener("click", () => window.api.winClose());
  $("#tlMin").addEventListener("click", () => window.api.winMin());
  $("#tlMax").addEventListener("click", () => window.api.winMax());

  // versão no topo
  try { const v = await window.api.appVersion(); const el = $("#appVer"); if (el && v) el.textContent = "v" + v; } catch (e) {}

  // auto-update
  window.api.onUpdate((p) => {
    if (p.state === "available") notify(`Atualização ${p.version || ""} disponível — baixando...`, "info");
    else if (p.state === "downloaded") { notify(`Atualização ${p.version || ""} pronta.`, "ok"); if (confirm(`Atualização ${p.version || ""} baixada. Reiniciar agora?`)) window.api.updateRestart(); }
    else if (p.state === "error") notify("Não consegui verificar atualizações.", "warn");
  });

  await initLicense();

  updateMetrics();
  setInterval(updateMetrics, 1500);
  if (window.lucide) lucide.createIcons();
}

init();
