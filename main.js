"use strict";
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const tweaks = require("./lib/tweaks");
const backup = require("./lib/backup");
const license = require("./lib/license");
const { getHwid } = require("./lib/hwid");

let win = null;

function isAdmin() {
  return new Promise((resolve) => {
    exec("net session", { windowsHide: true }, (err) => resolve(!err));
  });
}
function relaunchAsAdmin() {
  const exe = process.execPath;
  exec(`powershell -Command "Start-Process -FilePath '${exe}' -Verb RunAs"`, { windowsHide: true });
  app.quit();
}

// ---- Metricas de CPU ----
function cpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0, total = 0;
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "src", "index.html"));
  win.on("maximize", () => win.webContents.send("win-state", true));
  win.on("unmaximize", () => win.webContents.send("win-state", false));
}

app.whenReady().then(async () => {
  if (process.platform === "win32" && !(await isAdmin())) {
    if (app.isPackaged) { relaunchAsAdmin(); return; }
    console.warn("[VN Boost] Rodando SEM admin (dev). Abra o terminal como Administrador para os tweaks funcionarem.");
  }

  backup.init(app.getPath("userData"));
  license.init(app.getPath("userData"));
  const eslPath = app.isPackaged
    ? path.join(process.resourcesPath, "EmptyStandbyList.exe")
    : path.join(__dirname, "resources", "EmptyStandbyList.exe");
  tweaks.setEslPath(eslPath);

  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// ----- Controles de janela -----
ipcMain.on("win-min", () => win && win.minimize());
ipcMain.on("win-max", () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on("win-close", () => win && win.close());

// ----- Licenca -----
ipcMain.handle("license:hwid", async () => getHwid());
ipcMain.handle("license:status", async () => { const hwid = await getHwid(); return license.check(hwid); });
ipcMain.handle("license:activate", async (_e, key) => { const hwid = await getHwid(); return license.activate(key, hwid); });
ipcMain.handle("license:deactivate", async () => { license.clearCache(); return { ok: true }; });
ipcMain.handle("license:current", async () => license.current());

// ----- Metricas -----
ipcMain.handle("get-metrics", () => ({
  cpu: cpuUsage(), memTotal: os.totalmem(), memFree: os.freemem(), uptime: os.uptime(),
  cores: os.cpus().length, cpuModel: (os.cpus()[0] && os.cpus()[0].model) || "CPU",
  platform: process.platform, release: os.release(), hostname: os.hostname(), arch: os.arch(),
}));

// ----- Tweaks -----
function logToRenderer(text) { if (win && !win.isDestroyed()) win.webContents.send("log", text); }
ipcMain.handle("list-tweaks", () => tweaks.list());
ipcMain.handle("apply", async (_e, id) => tweaks.applyTweak(id, logToRenderer));
ipcMain.handle("revert", async (_e, id) => tweaks.revertTweak(id, logToRenderer));
ipcMain.handle("apply-all", async (_e, cat) => {
  for (const t of tweaks.list()) { if (t.action) continue; if (cat && t.cat !== cat) continue; await tweaks.applyTweak(t.id, logToRenderer); }
  return { ok: true };
});
ipcMain.handle("revert-all", async (_e, cat) => {
  for (const t of tweaks.list()) { if (t.action) continue; if (cat && t.cat !== cat) continue; await tweaks.revertTweak(t.id, logToRenderer); }
  return { ok: true };
});

// ----- Jogos -----
ipcMain.handle("list-games", () => tweaks.listGames());
ipcMain.handle("apply-game", async (_e, name) => tweaks.applyGame(name, logToRenderer));
ipcMain.handle("revert-game", async (_e, name) => tweaks.revertGame(name, logToRenderer));
