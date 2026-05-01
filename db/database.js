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
`);

// Проверяем и исправляем существующую таблицу reviews (если есть колонка name, переименовываем)
try {
  // Проверяем, есть ли колонка name
  const tableInfo = db.prepare("PRAGMA table_info(reviews)").all();
  const hasName = tableInfo.some((col) => col.name === "name");
  const hasAuthor = tableInfo.some((col) => col.name === "author");

  if (hasName && !hasAuthor) {
    console.log("🔧 Обновляем структуру таблицы reviews...");
    // Создаем временную таблицу
    db.exec(`
      CREATE TABLE reviews_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        author      TEXT    NOT NULL,
        text        TEXT    NOT NULL,
        rating      INTEGER DEFAULT 5,
        approved    INTEGER DEFAULT 0,
        created_at  TEXT    DEFAULT (datetime('now'))
      );
      
      INSERT INTO reviews_new (id, author, text, rating, approved, created_at)
      SELECT id, name, text, rating, approved, created_at FROM reviews;
      
      DROP TABLE reviews;
      ALTER TABLE reviews_new RENAME TO reviews;
    `);
    console.log("✅ Таблица reviews обновлена");
  }
} catch (error) {
  console.log("⚠️ Таблица reviews не требует обновления или не существует");
}

module.exports = db;
