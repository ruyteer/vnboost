"use strict";
const $ = (s) => document.querySelector(s);
const logEl = $("#log");

function log(text) {
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  logEl.appendChild(line); logEl.scrollTop = logEl.scrollHeight;
}
window.api.onLog((t) => log(t));

function setBusy(b) { document.querySelectorAll(".btn,.perf-btn,.tw-switch,.game-switch").forEach((x) => (x.disabled = b)); }
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

// ---------------- resultado de ação ----------------
function handleResult(res, okMsg) {
  if (res && res.ok) { if (okMsg) notify(okMsg, "ok"); return true; }
  if (res && res.offline) { notify("Sem conexão com o servidor.", "warn"); return false; }
  if (res && res.locked) { notify("Licença inválida/revogada — acesso bloqueado.", "warn"); showLock(res.reason); return false; }
  notify("Falha na operação.", "warn"); return false;
}

// ---------------- estado (switches) ----------------
async function refreshStatus() {
  try {
    const st = await window.api.tweakStatus();
    const ts = new Set(st.tweaks || []), gs = new Set(st.games || []);
    document.querySelectorAll(".tw-switch").forEach((s) => (s.checked = ts.has(s.dataset.id)));
    document.querySelectorAll(".game-switch").forEach((s) => (s.checked = gs.has(s.dataset.name)));
    const n = (st.tweaks || []).length;
    const total = st.total || 0;
    const pct = total > 0 ? Math.round((n / total) * 100) : 0;
    const el = $("#activePct"); if (el) el.textContent = pct + "%";
  } catch (e) {}
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
    card.innerHTML = `
      <div class="card-top"><h3>${t.name}</h3>
        <input type="checkbox" class="switch tw-switch" data-id="${t.id}"></div>
      <p>${t.desc}</p>${note}`;
    const sw = card.querySelector(".tw-switch");
    sw.addEventListener("change", () => withBusy(async () => {
      const on = sw.checked;
      const res = on ? await window.api.apply(t.id) : await window.api.revert(t.id);
      const ok = handleResult(res, `${on ? "Aplicado" : "Revertido"}: ${t.name}`);
      if (!ok) sw.checked = !on;
      else if (on && t.note && /reinici/i.test(t.note) && rebootNotifOn()) notify(`${t.name} exige reiniciar o PC.`, "warn");
    }));
  }
  return card;
}
function makeGameCard(g) {
  const card = document.createElement("div");
  card.className = "card card-game";
  card.dataset.name = g.name.toLowerCase();
  card.innerHTML = `
    <div class="card-top"><h3>${g.name}</h3>
      <input type="checkbox" class="switch game-switch" data-name="${g.name}"></div>`;
  const sw = card.querySelector(".game-switch");
  sw.addEventListener("change", () => withBusy(async () => {
    const on = sw.checked;
    const res = on ? await window.api.applyGame(g.name) : await window.api.revertGame(g.name);
    const ok = handleResult(res, `${on ? "Prioridade Alta" : "Prioridade revertida"}: ${g.name}`);
    if (!ok) sw.checked = !on;
  }));
  return card;
}

// ---------------- aba Windows (sub-tabs) ----------------
function buildWindows(winTweaks) {
  const subtabs = $("#winSubtabs"), panels = $("#winPanels");
  if (!subtabs || !panels) return;
  subtabs.innerHTML = ""; panels.innerHTML = "";
  const order = ["Desempenho", "GPU", "Rede", "Privacidade", "Sistema"];
  const subs = [...new Set(winTweaks.map((t) => t.sub || "Outros"))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  subs.forEach((sub, i) => {
    const b = document.createElement("button");
    b.className = "subtab" + (i === 0 ? " active" : ""); b.textContent = sub; b.dataset.wsub = sub;
    b.addEventListener("click", () => {
      subtabs.querySelectorAll(".subtab").forEach((x) => x.classList.toggle("active", x === b));
      panels.querySelectorAll(".subpanel").forEach((pp) => pp.classList.toggle("active", pp.dataset.wsub === sub));
    });
    subtabs.appendChild(b);
    const panel = document.createElement("div");
    panel.className = "subpanel" + (i === 0 ? " active" : ""); panel.dataset.wsub = sub;
    const grid = document.createElement("div"); grid.className = "grid";
    winTweaks.filter((t) => (t.sub || "Outros") === sub).forEach((t) => grid.appendChild(makeCard(t)));
    panel.appendChild(grid); panels.appendChild(panel);
  });
}

// ---------------- catálogo ----------------
async function loadCatalog() {
  const gp = $("#screen-precision .grid"), gs = $("#screen-system .grid"), gl = $("#gamesList");
  [gp, gs, gl].forEach((g) => g && (g.innerHTML = ""));
  const cat = await window.api.catalog();
  if (!cat || !cat.ok) {
    if (cat && cat.offline) notify("Sem conexão com o servidor — recursos indisponíveis.", "warn");
    else showLock(cat && cat.reason);
    return;
  }
  const grids = { precision: gp, system: gs };
  cat.tweaks.forEach((t) => grids[t.cat] && grids[t.cat].appendChild(makeCard(t)));
  buildWindows(cat.tweaks.filter((t) => t.cat === "windows"));
  (cat.games || []).forEach((g) => gl.appendChild(makeGameCard(g)));
  $("#gameCount").textContent = `${(cat.games || []).length} jogos`;
  await refreshStatus();
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
    $("#osinfo").textContent = `Windows (${m.arch})`;
  } catch (e) {}
}

// ---------------- FiveM ----------------
const LS_XHAIRS = "vn_xhairs";
const XHAIR_SUGGEST = [
  { name: "s1mple", style: 4, size: 1, thick: 0, gap: -3, alpha: 255, color: 4, dot: 0, outline: 0 },
  { name: "ZywOo", style: 4, size: 2, thick: 0, gap: -3, alpha: 255, color: 4, dot: 0, outline: 0 },
  { name: "NiKo", style: 4, size: 2, thick: 1, gap: -2, alpha: 255, color: 1, dot: 0, outline: 0 },
  { name: "donk", style: 4, size: 1, thick: 1, gap: -3, alpha: 255, color: 1, dot: 0, outline: 0 },
  { name: "Ponto", style: 4, size: 0, thick: 1, gap: -5, alpha: 255, color: 4, dot: 1, outline: 0 },
  { name: "Competitivo", style: 4, size: 2, thick: 1, gap: -2, alpha: 255, color: 5, dot: 0, outline: 1, r: 0, g: 255, b: 0 },
];
function xVal(id) { const e = $("#" + id); return e ? e.value : ""; }
function buildXhair() {
  const color = xVal("xColor");
  const parts = [
    `cl_crosshairstyle ${xVal("xStyle")}`,
    `cl_crosshairsize ${xVal("xSize")}`,
    `cl_crosshairthickness ${xVal("xThick")}`,
    `cl_crosshairgap ${xVal("xGap")}`,
    `cl_crosshairalpha ${xVal("xAlpha")}`,
    `cl_crosshairdot ${$("#xDot").checked ? 1 : 0}`,
    `cl_crosshair_drawoutline ${$("#xOutline").checked ? 1 : 0}`,
    `cl_crosshair_outlinethickness ${$("#xOutline").checked ? 1 : 0}`,
    `cl_crosshaircolor ${color}`,
  ];
  if (color === "5") parts.push(`cl_crosshaircolor_r ${xVal("xR")}`, `cl_crosshaircolor_g ${xVal("xG")}`, `cl_crosshaircolor_b ${xVal("xB")}`);
  return parts.join("; ");
}
function drawCrosshair() {
  const cv = $("#xhairCanvas"); if (!cv || !cv.getContext) return;
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
  const grd = ctx.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, "#3b3b44"); grd.addColorStop(1, "#23232a");
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  const sz = Math.max(0, parseFloat(xVal("xSize")) || 0), gp = parseFloat(xVal("xGap")) || 0, th = Math.max(0.5, parseFloat(xVal("xThick")) || 0.5);
  const lenPx = sz * 6 + 2, gapPx = Math.max(0, (gp + 4) * 2), thickPx = Math.max(1, th * 2);
  const a = Math.max(0, Math.min(1, (parseFloat(xVal("xAlpha")) || 255) / 255));
  const dot = $("#xDot").checked, outline = $("#xOutline").checked;
  const colors = { "0": "255,0,0", "1": "0,255,0", "2": "255,255,0", "3": "0,0,255", "4": "0,255,255" };
  const rgb = xVal("xColor") === "5" ? `${xVal("xR")},${xVal("xG")},${xVal("xB")}` : (colors[xVal("xColor")] || "0,255,255");
  function shapes(color, inf) {
    ctx.fillStyle = color; const t = thickPx + inf * 2, l = lenPx + inf;
    ctx.fillRect(cx - gapPx - l, cy - t / 2, l, t);
    ctx.fillRect(cx + gapPx - inf, cy - t / 2, l, t);
    ctx.fillRect(cx - t / 2, cy - gapPx - l, t, l);
    ctx.fillRect(cx - t / 2, cy + gapPx - inf, t, l);
    if (dot) ctx.fillRect(cx - t / 2, cy - t / 2, t, t);
  }
  if (outline) shapes("rgba(0,0,0,0.9)", 1);
  shapes(`rgba(${rgb},${a})`, 0);
}
function updateRgbVisibility() { const r = $("#xRgb"); if (r) r.hidden = xVal("xColor") !== "5"; }
function renderXhair() { updateRgbVisibility(); const o = $("#xhairOut"); if (o) o.textContent = buildXhair(); drawCrosshair(); }
function loadPreset(o) {
  $("#xStyle").value = o.style; $("#xSize").value = o.size; $("#xThick").value = o.thick; $("#xGap").value = o.gap;
  $("#xAlpha").value = o.alpha; $("#xColor").value = o.color; $("#xDot").checked = !!o.dot; $("#xOutline").checked = !!o.outline;
  if (o.color === 5) { $("#xR").value = o.r != null ? o.r : 0; $("#xG").value = o.g != null ? o.g : 255; $("#xB").value = o.b != null ? o.b : 255; }
  renderXhair();
}
function renderXhairSuggest() {
  const box = $("#xhairSuggest"); if (!box) return; box.innerHTML = "";
  XHAIR_SUGGEST.forEach((o) => { const c = document.createElement("span"); c.className = "chip"; c.textContent = o.name; c.addEventListener("click", () => loadPreset(o)); box.appendChild(c); });
}
function getXhairs() { try { return JSON.parse(localStorage.getItem(LS_XHAIRS) || "[]"); } catch { return []; } }
function renderXhairPresets() {
  const box = $("#xhairPresets"); if (!box) return; const list = getXhairs(); box.innerHTML = "";
  if (!list.length) { box.innerHTML = `<span class="muted-line" style="margin:0">Nenhum preset salvo.</span>`; return; }
  list.forEach((x, i) => {
    const chip = document.createElement("span"); chip.className = "chip"; chip.innerHTML = `${x.name} <b data-i="${i}">x</b>`;
    chip.addEventListener("click", (e) => {
      if (e.target.tagName === "B") { const l = getXhairs(); l.splice(i, 1); localStorage.setItem(LS_XHAIRS, JSON.stringify(l)); renderXhairPresets(); return; }
      navigator.clipboard.writeText(x.cmd); notify(`Crosshair "${x.name}" copiado.`, "ok");
    });
    box.appendChild(chip);
  });
}
function setupFivem() {
  // sub-tabs
  document.querySelectorAll(".subtab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".subtab").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".subpanel").forEach((pp) => pp.classList.remove("active"));
    $("#sub-" + b.dataset.sub).classList.add("active");
    if (b.dataset.sub === "xhair") drawCrosshair();
  }));

  // cache (operacao local; nao depende do servidor)
  async function loadInfo() {
    const info = await window.api.fivemInfo();
    $("#fmPath").textContent = info.found ? `Encontrado: ${info.app}` : "FiveM nao encontrado. Clique em 'Escolher pasta'.";
    $("#fmClean").disabled = !info.found;
  }
  loadInfo();
  $("#fmClean").addEventListener("click", () => withBusy(async () => {
    const r = await window.api.fivemClean();
    if (r && r.ok) notify(`Cache do FiveM limpo (${r.removed} itens).`, "ok");
    else notify("FiveM nao encontrado. Use 'Escolher pasta'.", "warn");
  }));
  $("#fmPick").addEventListener("click", async () => { await window.api.fivemPick(); await loadInfo(); });

  // crosshair
  ["xStyle", "xSize", "xThick", "xGap", "xAlpha", "xColor", "xR", "xG", "xB"].forEach((id) => { const e = $("#" + id); if (e) e.addEventListener("input", renderXhair); });
  $("#xDot").addEventListener("change", renderXhair);
  $("#xOutline").addEventListener("change", renderXhair);
  $("#xhairCopy").addEventListener("click", () => { navigator.clipboard.writeText(buildXhair()); notify("Comando de crosshair copiado.", "ok"); });
  $("#xhairSave").addEventListener("click", () => { const name = prompt("Nome do preset:"); if (!name) return; const l = getXhairs(); l.push({ name, cmd: buildXhair() }); localStorage.setItem(LS_XHAIRS, JSON.stringify(l)); renderXhairPresets(); });
  renderXhairSuggest(); renderXhairPresets(); renderXhair();
}

// ---------------- init ----------------
async function init() {
  document.querySelectorAll(".nav-item").forEach((n) => n.addEventListener("click", () => go(n.dataset.screen)));
  document.querySelectorAll(".shortcut").forEach((s) => s.addEventListener("click", () => go(s.dataset.go)));

  const perfActions = {
    precision: async () => { if (handleResult(await window.api.applyAll("precision"), "Precision Fix ativado.")) await refreshStatus(); },
    ram: async () => handleResult(await window.api.apply("ramfull"), "Memória RAM limpa."),
    cache: async () => handleResult(await window.api.apply("limparcache"), "Cache do Windows limpo."),
    ping: async () => handleResult(await window.api.apply("ping"), "Ping otimizado."),
  };
  document.querySelectorAll(".perf-btn").forEach((b) => b.addEventListener("click", () => withBusy(perfActions[b.dataset.perf])));

  document.querySelectorAll("[data-applyall]").forEach((b) => b.addEventListener("click", () =>
    withBusy(async () => { if (handleResult(await window.api.applyAll(b.dataset.applyall), `Aplicado tudo: ${b.dataset.applyall}`)) await refreshStatus(); })));
  document.querySelectorAll("[data-revertall]").forEach((b) => b.addEventListener("click", () =>
    withBusy(async () => { if (handleResult(await window.api.revertAll(b.dataset.revertall), `Revertido tudo: ${b.dataset.revertall}`)) await refreshStatus(); })));

  $("#gameSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase(); let shown = 0;
    $("#gamesList").querySelectorAll(".card-game").forEach((c) => { const ok = c.dataset.name.includes(q); c.style.display = ok ? "" : "none"; if (ok) shown++; });
    $("#gameCount").textContent = `${shown} jogos`;
  });

  renderBadge();
  $("#clearNotifs").addEventListener("click", () => { saveNotifs([]); setUnread(0); renderNotifs(); });

  applyConsoleSetting();
  $("#setConsole").addEventListener("change", (e) => { localStorage.setItem(LS_CONSOLE, e.target.checked ? "1" : "0"); applyConsoleSetting(); });
  $("#setRebootNotif").checked = rebootNotifOn();
  $("#setRebootNotif").addEventListener("change", (e) => localStorage.setItem(LS_REBOOT, e.target.checked ? "1" : "0"));

  $("#clearLog").addEventListener("click", () => { logEl.innerHTML = ""; });
  $("#tlClose").addEventListener("click", () => window.api.winClose());
  $("#tlMin").addEventListener("click", () => window.api.winMin());
  $("#tlMax").addEventListener("click", () => window.api.winMax());

  const rp = $("#restorePoint");
  if (rp) rp.addEventListener("click", () => withBusy(async () => {
    rp.disabled = true; notify("Criando ponto de restauração...", "info");
    const r = await window.api.createRestorePoint();
    notify(r && r.ok ? "Ponto de restauração criado!" : "Não consegui criar (a Proteção do Sistema pode estar desativada).", r && r.ok ? "ok" : "warn");
  }));

  try { const v = await window.api.appVersion(); const el = $("#appVer"); if (el && v) el.textContent = "v" + v; } catch (e) {}

  setupFivem();

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
