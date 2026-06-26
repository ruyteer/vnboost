"use strict";
const { Pool } = require("pg");

// Railway fornece DATABASE_URL. SSL ligado por padrao (desligue com PGSSL=false em local).
const useSsl = process.env.PGSSL === "false" ? false : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? useSsl : false,
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
