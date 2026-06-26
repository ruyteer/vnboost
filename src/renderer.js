"use strict";

// ---------------- util ----------------
const $ = (s) => document.querySelector(s);
const logEl = $("#log");

function log(text) {
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}
window.api.onLog((text) => log(text));

function setBusy(b) { document.querySelectorAll(".btn").forEach((x) => (x.disabled = b)); }
async function withBusy(fn) {
  setBusy(true);
  try { await fn(); } catch (e) { log("Erro: " + (e && e.message ? e.message : e)); }
  finally { setBusy(false); }
}

// ---------------- notificações ----------------
const LS_NOTIFS = "vn_notifs";
const LS_UNREAD = "vn_unread";
function getNotifs() { try { return JSON.parse(localStorage.getItem(LS_NOTIFS) || "[]"); } catch { return []; } }
function saveNotifs(a) { localStorage.setItem(LS_NOTIFS, JSON.stringify(a.slice(0, 100))); }
function getUnread() { return parseInt(localStorage.getItem(LS_UNREAD) || "0", 10); }
function setUnread(n) { localStorage.setItem(LS_UNREAD, String(n)); renderBadge(); }

function notify(text, type) {
  const a = getNotifs();
  a.unshift({ text, type: type || "info", time: Date.now() });
  saveNotifs(a);
  setUnread(getUnread() + 1);
  if ($("#screen-notifs").classList.contains("active")) renderNotifs();
}
function renderBadge() {
  const n = getUnread();
  const b = $("#notifBadge");
  if (n > 0) { b.hidden = false; b.textContent = n > 99 ? "99+" : String(n); }
  else b.hidden = true;
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}
function renderNotifs() {
  const list = $("#notifsList");
  const a = getNotifs();
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
const LS_CONSOLE = "vn_show_console";
const LS_REBOOT = "vn_reboot_notif";
function applyConsoleSetting() {
  const on = localStorage.getItem(LS_CONSOLE) !== "0";
  $("#console").hidden = !on;
  $("#setConsole").checked = on;
}
function rebootNotifOn() { return localStorage.getItem(LS_REBOOT) !== "0"; }

// ---------------- navegação ----------------
function go(screen) {
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.screen === screen));
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("#screen-" + screen).classList.add("active");
  if (screen === "notifs") { setUnread(0); renderNotifs(); }
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
      withBusy(async () => { await window.api.apply(t.id); notify(`Ação executada: ${t.name}`, "ok"); });
    });
  } else {
    card.innerHTML = `<h3>${t.name}</h3><p>${t.desc}</p>${note}
      <div class="card-actions">
        <button class="btn apply">APLICAR</button>
        <button class="btn revert">REVERTER</button>
      </div>`;
    card.querySelector(".apply").addEventListener("click", () =>
      withBusy(async () => {
        await window.api.apply(t.id);
        notify(`Aplicado: ${t.name}`, "ok");
        if (t.note && /reinici/i.test(t.note) && rebootNotifOn()) notify(`${t.name} exige reiniciar o PC para valer.`, "warn");
      }));
    card.querySelector(".revert").addEventListener("click", () =>
      withBusy(async () => { await window.api.revert(t.id); notify(`Revertido: ${t.name}`, "info"); }));
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
    withBusy(async () => { await window.api.applyGame(g.name); notify(`Prioridade Alta: ${g.name}`, "ok"); }));
  card.querySelector(".revert").addEventListener("click", () =>
    withBusy(async () => { await window.api.revertGame(g.name); notify(`Prioridade revertida: ${g.name}`, "info"); }));
  return card;
}

// ---------------- métricas ----------------
function gb(bytes) { return (bytes / 1073741824).toFixed(1); }
function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
async function updateMetrics() {
  try {
    const m = await window.api.getMetrics();
    const cpu = Math.round(m.cpu);
    $("#cpuPct").textContent = cpu + "%";
    $("#cpuBar").style.width = cpu + "%";
    $("#cpuModel").textContent = m.cpuModel;
    const used = m.memTotal - m.memFree;
    const memPct = Math.round((used / m.memTotal) * 100);
    $("#memPct").textContent = memPct + "%";
    $("#memBar").style.width = memPct + "%";
    $("#memSub").textContent = `${gb(used)} / ${gb(m.memTotal)} GB`;
    $("#cores").textContent = m.cores;
    $("#uptime").textContent = fmtUptime(m.uptime);
    $("#osinfo").textContent = `Windows (${m.arch})`;
    $("#host").textContent = m.hostname;
  } catch (e) { /* ignore */ }
}

// ---------------- licença ----------------
let HWID = "";
function licReason(r) {
  return ({
    no_key: "Nenhuma chave ativada.",
    invalid: "Chave inválida.",
    revoked: "Chave revogada.",
    expired: "Licença expirada.",
    hwid_mismatch: "Esta chave já está vinculada a outro computador.",
    not_activated: "Chave ainda não ativada.",
    offline_no_cache: "Sem internet e sem validação recente. Conecte-se para ativar.",
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
function unlock(st) { $("#lockScreen").hidden = true; renderLicCard(st); }

async function initLicense() {
  HWID = await window.api.licenseHwid();
  $("#lockHwid").textContent = HWID;
  $("#licHwid").textContent = HWID;
  const st = await window.api.licenseStatus();
  if (st.licensed) unlock(st); else showLock(st.reason);

  $("#lockActivate").addEventListener("click", async () => {
    const key = $("#lockKey").value.trim();
    const m = $("#lockMsg");
    if (!key) { m.className = "lock-msg err"; m.textContent = "Preencha a chave."; return; }
    $("#lockActivate").disabled = true; m.className = "lock-msg"; m.textContent = "Validando...";
    try {
      const r = await window.api.licenseActivate(key);
      if (r && r.ok) {
        m.className = "lock-msg ok"; m.textContent = "Ativado!";
        const st2 = await window.api.licenseStatus();
        unlock(st2); notify("Licença ativada neste PC.", "ok");
      } else { m.className = "lock-msg err"; m.textContent = licReason(r ? r.reason : "invalid"); }
    } catch (e) { m.className = "lock-msg err"; m.textContent = "Erro ao conectar na API. Verifique a internet."; }
    finally { $("#lockActivate").disabled = false; }
  });
  $("#lockKey").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#lockActivate").click(); });
  $("#lockCopyHwid").addEventListener("click", () => { navigator.clipboard.writeText(HWID); });
  $("#licCopyHwid").addEventListener("click", () => { navigator.clipboard.writeText(HWID); });
  $("#licDeactivate").addEventListener("click", async () => {
    if (!confirm("Desativar a licença neste app? Você precisará inserir a chave novamente.")) return;
    await window.api.licenseDeactivate();
    $("#lockKey").value = "";
    showLock("no_key");
    renderLicCard({ licensed: false });
    notify("Licença desativada neste PC.", "info");
  });
}

// ---------------- init ----------------
async function init() {
  // navegação
  document.querySelectorAll(".nav-item").forEach((n) => n.addEventListener("click", () => go(n.dataset.screen)));
  document.querySelectorAll(".shortcut").forEach((s) => s.addEventListener("click", () => go(s.dataset.go)));

  await initLicense();

  // atalhos de performance
  const perfActions = {
    precision: async () => { await window.api.applyAll("precision"); notify("Precision Fix ativado.", "ok"); },
    ram:       async () => { await window.api.apply("ramfull");     notify("Memória RAM limpa.", "ok"); },
    cache:     async () => { await window.api.apply("limparcache"); notify("Cache do Windows limpo.", "ok"); },
    ping:      async () => { await window.api.apply("ping");        notify("Ping otimizado (DNS/IP).", "ok"); },
  };
  document.querySelectorAll(".perf-btn").forEach((b) =>
    b.addEventListener("click", () => withBusy(perfActions[b.dataset.perf])));

  // bulk
  document.querySelectorAll("[data-applyall]").forEach((b) => b.addEventListener("click", () =>
    withBusy(async () => { const c = b.dataset.applyall; await window.api.applyAll(c); notify(`Aplicado tudo: ${c}`, "ok"); })));
  document.querySelectorAll("[data-revertall]").forEach((b) => b.addEventListener("click", () =>
    withBusy(async () => { const c = b.dataset.revertall; await window.api.revertAll(c); notify(`Revertido tudo: ${c}`, "info"); })));

  // tweaks
  const tweaks = await window.api.listTweaks();
  const grids = {
    precision: $("#screen-precision .grid"),
    windows: $("#screen-windows .grid"),
    system: $("#screen-system .grid"),
  };
  tweaks.forEach((t) => grids[t.cat] && grids[t.cat].appendChild(makeCard(t)));

  // jogos
  const games = await window.api.listGames();
  const gamesList = $("#gamesList");
  games.forEach((g) => gamesList.appendChild(makeGameCard(g)));
  $("#gameCount").textContent = `${games.length} jogos`;
  $("#gameSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    let shown = 0;
    gamesList.querySelectorAll(".card-game").forEach((c) => {
      const ok = c.dataset.name.includes(q);
      c.style.display = ok ? "" : "none"; if (ok) shown++;
    });
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

  // console
  $("#clearLog").addEventListener("click", () => { logEl.innerHTML = ""; });

  // janela
  $("#tlClose").addEventListener("click", () => window.api.winClose());
  $("#tlMin").addEventListener("click", () => window.api.winMin());
  $("#tlMax").addEventListener("click", () => window.api.winMax());

  // métricas (polling)
  updateMetrics();
  setInterval(updateMetrics, 1500);

  if (window.lucide) lucide.createIcons();
  log(`VN Boost carregado. ${tweaks.length} tweaks + ${games.length} jogos.`);
}

init();
