const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/events?category=art&search=
router.get("/", (req, res) => {
  const { category, search } = req.query;

  let sql = "SELECT * FROM events WHERE 1=1";
  const params = [];

  if (category && category !== "all") {
    sql += " AND category = ?";
    params.push(category);
  }
  if (search) {
    sql += " AND (title LIKE ? OR description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY date DESC";

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET /api/events/:id
router.get("/:id", (req, res) => {
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Не найдено" });
  res.json(event);
});

// POST /api/events
router.post("/", (req, res) => {
  const { title, description, category, date } = req.body;

  if (!title || !description || !date) {
    return res.status(400).json({ error: "Заполни все обязательные поля" });
  }

  const result = db
    .prepare("INSERT INTO events (title, description, category, date) VALUES (?, ?, ?, ?)")
    .run(title, description, category || "other", date);

  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/events/:id
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
