"use strict";
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { pool, query } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// ---------- helpers ----------
function genKey() {
  const block = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `VN-${block()}${block()}-${block()}${block()}-${block()}${block()}`;
}
function ipOf(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
}
function isExpired(lic) {
  return lic.expires_at && new Date(lic.expires_at).getTime() < Date.now();
}
async function logActivation(licenseId, hwid, ip, ok, reason) {
  try {
    await query(
      "INSERT INTO activations (license_id, hwid, ip, ok, reason) VALUES ($1,$2,$3,$4,$5)",
      [licenseId, hwid, ip, ok, reason]
    );
  } catch (e) { /* ignore log errors */ }
}
function adminAuth(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(500).json({ error: "ADMIN_TOKEN nao configurado no servidor." });
  if ((req.headers["x-admin-token"] || "") !== ADMIN_TOKEN)
    return res.status(401).json({ error: "Nao autorizado." });
  next();
}

// ---------- public: activate (vincula no 1o uso) ----------
app.post("/api/activate", async (req, res) => {
  const { key, hwid } = req.body || {};
  const ip = ipOf(req);
  if (!key || !hwid) return res.json({ ok: false, reason: "missing" });

  const r = await query("SELECT * FROM licenses WHERE key = $1", [String(key).trim()]);
  const lic = r.rows[0];
  if (!lic) { await logActivation(null, hwid, ip, false, "invalid"); return res.json({ ok: false, reason: "invalid" }); }
  if (lic.status === "revoked") { await logActivation(lic.id, hwid, ip, false, "revoked"); return res.json({ ok: false, reason: "revoked" }); }
  if (isExpired(lic)) { await logActivation(lic.id, hwid, ip, false, "expired"); return res.json({ ok: false, reason: "expired" }); }

  if (!lic.hwid) {
    // primeiro uso: casa a chave com este HWID
    await query("UPDATE licenses SET hwid=$1, activated_at=now(), last_seen=now(), last_ip=$2 WHERE id=$3",
      [hwid, ip, lic.id]);
    await logActivation(lic.id, hwid, ip, true, "bound");
    return res.json({ ok: true, expiresAt: lic.expires_at, plan: lic.plan, bound: true });
  }
  if (lic.hwid !== hwid) { await logActivation(lic.id, hwid, ip, false, "hwid_mismatch"); return res.json({ ok: false, reason: "hwid_mismatch" }); }

  await query("UPDATE licenses SET last_seen=now(), last_ip=$1 WHERE id=$2", [ip, lic.id]);
  await logActivation(lic.id, hwid, ip, true, "ok");
  res.json({ ok: true, expiresAt: lic.expires_at, plan: lic.plan });
});

// ---------- public: validate (sem vincular) ----------
app.post("/api/validate", async (req, res) => {
  const { key, hwid } = req.body || {};
  const ip = ipOf(req);
  if (!key || !hwid) return res.json({ ok: false, reason: "missing" });

  const r = await query("SELECT * FROM licenses WHERE key = $1", [String(key).trim()]);
  const lic = r.rows[0];
  if (!lic) return res.json({ ok: false, reason: "invalid" });
  if (lic.status === "revoked") return res.json({ ok: false, reason: "revoked" });
  if (isExpired(lic)) return res.json({ ok: false, reason: "expired" });
  if (!lic.hwid) return res.json({ ok: false, reason: "not_activated" });
  if (lic.hwid !== hwid) return res.json({ ok: false, reason: "hwid_mismatch" });

  await query("UPDATE licenses SET last_seen=now(), last_ip=$1 WHERE id=$2", [ip, lic.id]);
  res.json({ ok: true, expiresAt: lic.expires_at, plan: lic.plan });
});

// ---------- admin ----------
app.post("/api/admin/keys", adminAuth, async (req, res) => {
  const { note, plan, expiresAt, hwid } = req.body || {};
  const key = genKey();
  const r = await query(
    "INSERT INTO licenses (key, note, plan, expires_at, hwid) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [key, note || null, plan || "standard", expiresAt || null, hwid || null]
  );
  res.json({ ok: true, license: r.rows[0] });
});

app.get("/api/admin/keys", adminAuth, async (_req, res) => {
  const r = await query("SELECT * FROM licenses ORDER BY created_at DESC");
  res.json({ ok: true, licenses: r.rows });
});

app.get("/api/admin/keys/:id/activations", adminAuth, async (req, res) => {
  const r = await query("SELECT * FROM activations WHERE license_id=$1 ORDER BY at DESC LIMIT 50", [req.params.id]);
  res.json({ ok: true, activations: r.rows });
});

app.post("/api/admin/keys/:id/revoke", adminAuth, async (req, res) => {
  await query("UPDATE licenses SET status='revoked' WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});
app.post("/api/admin/keys/:id/restore", adminAuth, async (req, res) => {
  await query("UPDATE licenses SET status='active' WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});
app.post("/api/admin/keys/:id/unbind", adminAuth, async (req, res) => {
  await query("UPDATE licenses SET hwid=NULL, activated_at=NULL WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});
app.delete("/api/admin/keys/:id", adminAuth, async (req, res) => {
  await query("DELETE FROM licenses WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

const PORT = process.env.PORT || 3000;
(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    if (process.env.DATABASE_URL) { await pool.query(sql); console.log("Schema verificado/criado."); }
    else console.warn("DATABASE_URL nao definido - rodando sem banco (so pra teste).");
  } catch (e) { console.error("Erro no schema:", e.message); }
  app.listen(PORT, () => console.log("VN Boost License API on :" + PORT));
})();
