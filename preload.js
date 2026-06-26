"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // tweaks
  listTweaks: () => ipcRenderer.invoke("list-tweaks"),
  apply: (id) => ipcRenderer.invoke("apply", id),
  revert: (id) => ipcRenderer.invoke("revert", id),
  applyAll: (cat) => ipcRenderer.invoke("apply-all", cat),
  revertAll: (cat) => ipcRenderer.invoke("revert-all", cat),
  // jogos
  listGames: () => ipcRenderer.invoke("list-games"),
  applyGame: (name) => ipcRenderer.invoke("apply-game", name),
  revertGame: (name) => ipcRenderer.invoke("revert-game", name),
  // metricas / log / janela
  getMetrics: () => ipcRenderer.invoke("get-metrics"),
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
});
