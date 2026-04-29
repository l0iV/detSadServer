const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "../ds18.sqlite"));

// WAL для лучшей производительности
db.pragma("journal_mode = WAL");

// Создание таблиц
db.exec(`
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
    name        TEXT    NOT NULL,
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
`);

module.exports = db;
