"use strict";
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await pool.query(sql);
    console.log("Banco inicializado com sucesso.");
    process.exit(0);
  } catch (e) {
    console.error("Falha ao inicializar o banco:", e.message);
    process.exit(1);
  }
})();
