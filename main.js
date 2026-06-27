"use strict";
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const tweaks = require("./lib/tweaks");
const backup = require("./lib/backup");
const license = require("./lib/license");
const { getHwid } = require("./lib/hwid");
const { autoUpdater } = require("electron-updater");
const updLog = require("electron-log");

let win = null;
let lastCatalog = null;

function isAdmin() {
  return new Promise((resolve) => { exec("net session", { windowsHide: true }, (err) => resolve(!err)); });
}
function relaunchAsAdmin() {
  exec(`powershell -Command "Start-Process -FilePath '${process.execPath}' -Verb RunAs"`, { windowsHide: true });
  app.quit();
}

// ---- Metricas de CPU ----
function cpuSnapshot() {
  const cpus = os.cpus(); let idle = 0, total = 0;
  for (const c of cpus) { for (const k in c.times) total += c.times[k]; idle += c.times.idle; }
  return { idle, total };
}
let lastCpu = cpuSnapshot();
function cpuUsage() {
  const now = cpuSnapshot();
  const idle = now.idle - lastCpu.idle, total = now.total - lastCpu.total;
  lastCpu = now;
  const pct = total > 0 ? (1 - idle / total) * 100 : 0;
  return Math.max(0, Math.min(100, pct));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 800, minWidth: 940, minHeight: 640,
    frame: false, backgroundColor: "#0a0a0c", show: true,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, "src", "index.html"));
  win.on("maximize", () => win.webContents.send("win-state", true));
  win.on("unmaximize", () => win.webContents.send("win-state", false));
}

app.whenReady().then(async () => {
  if (process.platform === "win32" && !(await isAdmin())) {
    if (app.isPackaged) { relaunchAsAdmin(); return; }
    console.warn("[VN Boost] Rodando SEM admin (dev).");
  }
  backup.init(app.getPath("userData"));
  license.init(app.getPath("userData"));
  const eslPath = app.isPackaged
    ? path.join(process.resourcesPath, "EmptyStandbyList.exe")
    : path.join(__dirname, "resources", "EmptyStandbyList.exe");
  tweaks.setEslPath(eslPath);
  createWindow();
  if (app.isPackaged) setupUpdater();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// ----- Auto-update -----
function sendUpdate(p) { if (win && !win.isDestroyed()) win.webContents.send("update-status", p); }
function setupUpdater() {
  autoUpdater.logger = updLog; updLog.transports.file.level = "info"; autoUpdater.autoDownload = true;
  autoUpdater.on("checking-for-update", () => sendUpdate({ state: "checking" }));
  autoUpdater.on("update-available", (i) => sendUpdate({ state: "available", version: i && i.version }));
  autoUpdater.on("update-not-available", () => sendUpdate({ state: "uptodate" }));
  autoUpdater.on("download-progress", (p) => sendUpdate({ state: "downloading", percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (i) => sendUpdate({ state: "downloaded", version: i && i.version }));
  autoUpdater.on("error", (e) => sendUpdate({ state: "error", message: String(e && e.message || e) }));
  try { autoUpdater.checkForUpdates(); } catch (e) {}
}
ipcMain.on("update:restart", () => { try { autoUpdater.quitAndInstall(); } catch (e) {} });
ipcMain.handle("update:check", () => { try { autoUpdater.checkForUpdates(); } catch (e) {} return { ok: true }; });

// ----- Janela -----
ipcMain.on("win-min", () => win && win.minimize());
ipcMain.on("win-max", () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on("win-close", () => win && win.close());

// ----- Licenca -----
ipcMain.handle("license:hwid", async () => getHwid());
ipcMain.handle("license:status", async () => { const hwid = await getHwid(); return license.check(hwid); });
ipcMain.handle("license:activate", async (_e, key) => { const hwid = await getHwid(); return license.activate(key, hwid); });
ipcMain.handle("license:deactivate", async () => { lastCatalog = null; license.clearCache(); return { ok: true }; });
ipcMain.handle("license:current", async () => license.current());

ipcMain.handle("app:version", () => app.getVersion());

// ----- Metricas -----
ipcMain.handle("get-metrics", () => ({
  cpu: cpuUsage(), memTotal: os.totalmem(), memFree: os.freemem(), uptime: os.uptime(),
  cores: os.cpus().length, cpuModel: (os.cpus()[0] && os.cpus()[0].model) || "CPU",
  platform: process.platform, release: os.release(), hostname: os.hostname(), arch: os.arch(),
}));

// ----- Catalogo + acoes (tudo validado no servidor a cada chamada) -----
function logToRenderer(text) { if (win && !win.isDestroyed()) win.webContents.send("log", text); }

ipcMain.handle("catalog", async () => {
  const hwid = await getHwid();
  try {
    const c = await license.fetchCatalog(hwid);
    if (c && c.ok) lastCatalog = c;
    return c;
  } catch (e) { return { ok: false, offline: true }; }
});

ipcMain.handle("apply", async (_e, id) => {
  const hwid = await getHwid();
  let r; try { r = await license.fetchAction(hwid, id, "apply"); } catch (e) { return { ok: false, offline: true }; }
  if (!r || !r.ok) return { ok: false, locked: true, reason: r && r.reason };
  await tweaks.applyInstruction(id, r.instruction, logToRenderer);
  return { ok: true };
});

ipcMain.handle("revert", async (_e, id) => {
  const hwid = await getHwid();
  let r; try { r = await license.fetchAction(hwid, id, "revert"); } catch (e) { return { ok: false, offline: true }; }
  if (!r || !r.ok) return { ok: false, locked: true, reason: r && r.reason };
  await tweaks.revertInstruction(id, r.instruction, logToRenderer);
  return { ok: true };
});

async function ensureCatalog(hwid) {
  if (lastCatalog && lastCatalog.ok) return lastCatalog;
  try { const c = await license.fetchCatalog(hwid); if (c && c.ok) lastCatalog = c; return c; }
  catch (e) { return { ok: false, offline: true }; }
}

ipcMain.handle("apply-all", async (_e, cat) => {
  const hwid = await getHwid();
  const c = await ensureCatalog(hwid);
  if (!c || !c.ok) return { ok: false, locked: true, reason: c && c.reason };
  for (const t of c.tweaks) {
    if (t.action) continue; if (cat && t.cat !== cat) continue;
    let r; try { r = await license.fetchAction(hwid, t.id, "apply"); } catch (e) { return { ok: false, offline: true }; }
    if (!r || !r.ok) return { ok: false, locked: true, reason: r && r.reason };
    await tweaks.applyInstruction(t.id, r.instruction, logToRenderer);
  }
  return { ok: true };
});

ipcMain.handle("revert-all", async (_e, cat) => {
  const hwid = await getHwid();
  const c = await ensureCatalog(hwid);
  if (!c || !c.ok) return { ok: false, locked: true, reason: c && c.reason };
  for (const t of c.tweaks) {
    if (t.action) continue; if (cat && t.cat !== cat) continue;
    let r; try { r = await license.fetchAction(hwid, t.id, "revert"); } catch (e) { return { ok: false, offline: true }; }
    if (!r || !r.ok) return { ok: false, locked: true, reason: r && r.reason };
    await tweaks.revertInstruction(t.id, r.instruction, logToRenderer);
  }
  return { ok: true };
});

// ----- Jogos -----
ipcMain.handle("apply-game", async (_e, name) => {
  const hwid = await getHwid();
  let r; try { r = await license.fetchGame(hwid, name); } catch (e) { return { ok: false, offline: true }; }
  if (!r || !r.ok) return { ok: false, locked: true, reason: r && r.reason };
  await tweaks.applyGameExes(name, r.exes, logToRenderer);
  return { ok: true };
});
ipcMain.handle("revert-game", async (_e, name) => {
  const hwid = await getHwid();
  let r; try { r = await license.fetchGame(hwid, name); } catch (e) { return { ok: false, offline: true }; }
  if (!r || !r.ok) return { ok: false, locked: true, reason: r && r.reason };
  await tweaks.revertGameExes(name, r.exes, logToRenderer);
  return { ok: true };
});
