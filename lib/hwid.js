"use strict";
const { exec } = require("child_process");
const crypto = require("crypto");

// Coleta seriais de hardware (CPU + placa-mae + BIOS + disco) e devolve
// um hash SHA-256 estavel pra identificar a maquina.
function psValue(cmd) {
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -Command "${cmd}"`, { windowsHide: true, timeout: 8000 }, (err, out) => {
      resolve(err ? "" : (out || "").toString().trim());
    });
  });
}

let cached = null;
async function getHwid() {
  if (cached) return cached;
  const [cpu, board, bios, disk] = await Promise.all([
    psValue("(Get-CimInstance Win32_Processor | Select-Object -First 1).ProcessorId"),
    psValue("(Get-CimInstance Win32_BaseBoard | Select-Object -First 1).SerialNumber"),
    psValue("(Get-CimInstance Win32_BIOS | Select-Object -First 1).SerialNumber"),
    psValue("(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber"),
  ]);
  const raw = [cpu, board, bios, disk].map((x) => (x || "").replace(/\s+/g, "")).join("|");
  const hash = crypto.createHash("sha256").update(raw || "unknown-machine").digest("hex").toUpperCase();
  cached = hash.slice(0, 32); // 32 chars bastam e ficam mais legiveis
  return cached;
}

module.exports = { getHwid };
