const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../ds18.sqlite");

// ──────────────────────────────────────────────
// Простые промис-обёртки над sqlite3
// ──────────────────────────────────────────────

class Database {
  constructor(filePath) {
    this._db = new sqlite3.Database(filePath, (err) => {
      if (err) {
        console.error("❌ Ошибка подключения к БД:", err.message);
        process.exit(1);
      }
      console.log("✅ SQLite подключена:", filePath);
    });
    this._db.run("PRAGMA journal_mode = WAL");
    this._db.run("PRAGMA foreign_keys = ON");
  }

  /** SELECT — возвращает массив строк */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /** SELECT — возвращает одну строку */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /** INSERT / UPDATE / DELETE — возвращает { lastID, changes } */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /** Несколько SQL-команд без параметров */
  exec(sql) {
    return new Promise((resolve, reject) => {
      this._db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

const db = new Database(DB_PATH);

// Создание всех 7 таблиц при старте
db.exec(
  `
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL,
    category    TEXT    NOT NULL DEFAULT 'other',
    date        TEXT    NOT NULL,
    date_label  TEXT,
    image_url   TEXT,
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    position    TEXT    NOT NULL,
    experience  TEXT,
    education   TEXT,
    group_name  TEXT,
    phone       TEXT,
    image_url   TEXT
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    author      TEXT    NOT NULL,
    text        TEXT    NOT NULL,
    rating      INTEGER DEFAULT 5,
    approved    INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    phone       TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT    NOT NULL,
    date        TEXT    NOT NULL,
    image_url   TEXT    NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    text        TEXT    NOT NULL,
    image_url   TEXT,
    created_at  TEXT    DEFAULT (datetime('now'))
  );
`,
)
  .then(() =>
    console.log(
      "✅ Все 7 таблиц готовы (events, teachers, reviews, contacts, wins, rooms)",
    ),
  )
  .catch((err) => console.error("❌ Ошибка создания таблиц:", err.message));

module.exports = db;
