"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // catalogo + acoes (validados no servidor a cada chamada)
  catalog: () => ipcRenderer.invoke("catalog"),
  tweakStatus: () => ipcRenderer.invoke("tweak-status"),
  fivemInfo: () => ipcRenderer.invoke("fivem:info"),
  fivemClean: () => ipcRenderer.invoke("fivem:clean"),
  fivemPick: () => ipcRenderer.invoke("fivem:pick"),
  apply: (id) => ipcRenderer.invoke("apply", id),
  revert: (id) => ipcRenderer.invoke("revert", id),
  applyAll: (cat) => ipcRenderer.invoke("apply-all", cat),
  revertAll: (cat) => ipcRenderer.invoke("revert-all", cat),
  applyGame: (name) => ipcRenderer.invoke("apply-game", name),
  revertGame: (name) => ipcRenderer.invoke("revert-game", name),
  // metricas / log / janela
  getMetrics: () => ipcRenderer.invoke("get-metrics"),
  createRestorePoint: () => ipcRenderer.invoke("create-restore-point"),
  onLog: (cb) => ipcRenderer.on("log", (_e, text) => cb(text)),
  winMin: () => ipcRenderer.send("win-min"),
  winMax: () => ipcRenderer.send("win-max"),
  winClose: () => ipcRenderer.send("win-close"),
  // licenca
  licenseHwid: () => ipcRenderer.invoke("license:hwid"),
  licenseStatus: () => ipcRenderer.invoke("license:status"),
  licenseActivate: (key) => ipcRenderer.invoke("license:activate", key),
  licenseDeactivate: () => ipcRenderer.invoke("license:deactivate"),
  licenseCurrent: () => ipcRenderer.invoke("license:current"),
  // auto-update
  onUpdate: (cb) => ipcRenderer.on("update-status", (_e, p) => cb(p)),
  updateRestart: () => ipcRenderer.send("update:restart"),
  updateCheck: () => ipcRenderer.invoke("update:check"),
  appVersion: () => ipcRenderer.invoke("app:version"),
});
