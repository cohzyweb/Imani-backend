// db.js - SQLite via sql.js (pure WebAssembly, no native compilation needed)
const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "data", "logistics.db");
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let _sqlJsDb = null;

function saveDb() {
  if (!_sqlJsDb) return;
  const data = _sqlJsDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

setInterval(saveDb, 10000);
process.on("exit", saveDb);
process.on("SIGINT", () => { saveDb(); process.exit(); });
process.on("SIGTERM", () => { saveDb(); process.exit(); });

// Synchronous-style wrapper around sql.js
class DB {
  constructor(sqlJsDb) { this._db = sqlJsDb; }

  exec(sql) { this._db.run(sql); return this; }

  pragma() { return this; }

  prepare(sql) {
    const db = this._db;
    const normalise = (params) =>
      params.length === 1 && Array.isArray(params[0]) ? params[0] : params;

    return {
      run(...params) {
        db.run(sql, normalise(params));
        saveDb();
        return { changes: db.getRowsModified() };
      },
      get(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(normalise(params));
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = db.exec(sql, normalise(params));
        if (!results || results.length === 0) return [];
        const { columns, values } = results[0];
        return values.map((row) => {
          const obj = {};
          columns.forEach((col, i) => { obj[col] = row[i]; });
          return obj;
        });
      }
    };
  }

  transaction(fn) {
    return (...args) => {
      this._db.run("BEGIN");
      try { fn(...args); this._db.run("COMMIT"); }
      catch (e) { this._db.run("ROLLBACK"); throw e; }
      saveDb();
    };
  }
}

let _instance = null;

async function initDb() {
  const SQL = await initSqlJs();
  _sqlJsDb = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  _instance = new DB(_sqlJsDb);

  _sqlJsDb.run(`CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`);

  _sqlJsDb.run(`CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY, full_name TEXT, email TEXT, company TEXT, phone TEXT,
    shipment_type TEXT, service TEXT, pickup_location TEXT, delivery_location TEXT,
    weight TEXT, dimensions TEXT, cargo TEXT, additional_services TEXT,
    packing_responsibility TEXT, materials_needed TEXT, furniture_disassembly TEXT,
    fragile_items TEXT, floor_levels TEXT, elevator TEXT, parking TEXT,
    walking_distance TEXT, access_issues TEXT, on_site_supervisor TEXT, extra_help TEXT,
    appliance_help TEXT, box_count TEXT, bulky_items TEXT, timing TEXT, storage TEXT,
    base_price REAL DEFAULT 0, vat REAL DEFAULT 0, total REAL DEFAULT 0,
    status TEXT DEFAULT 'pending', estimated_time TEXT, notes TEXT, tracking_number TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);

  _sqlJsDb.run(`CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY, tracking_id TEXT UNIQUE, customer_name TEXT,
    route TEXT, shipment_type TEXT, estimated_delivery TEXT,
    status TEXT DEFAULT 'In Transit',
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);

  _sqlJsDb.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
    status TEXT DEFAULT 'Active', shipments INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  _sqlJsDb.run(`CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY, ticket_id TEXT UNIQUE, customer_name TEXT,
    subject TEXT, message TEXT, sentiment TEXT DEFAULT 'Neutral',
    priority TEXT DEFAULT 'Medium', status TEXT DEFAULT 'Open',
    ai_escalation INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
  )`);

  _sqlJsDb.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT
  )`);

  const defaults = {
    companyName: "Imani Logistics", supportEmail: "support@imanigifts.co.uk",
    contactNumber: "+44 7700 000000", companyAddress: "London, United Kingdom",
    notifyQuotes: "true", notifyTickets: "true", notifySMS: "false",
    aiEnabled: "Enabled", aiTone: "Professional",
    aiEscalation: "High & Angry Sentiment", aiApiKey: ""
  };
  for (const [k, v] of Object.entries(defaults)) {
    _sqlJsDb.run("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)", [k, v]);
  }

  saveDb();
  console.log("✅ Database ready");
  return _instance;
}

module.exports = { init: initDb, get db() { return _instance; } };
