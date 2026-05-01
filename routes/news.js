const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/news – список новостей
router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM news ORDER BY id").all();
  res.json(rows);
});

// POST /api/news – добавить новость
router.post("/", (req, res) => {
  const { image_url, text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "text обязателен" });
  }
  const result = db
    .prepare("INSERT INTO news (image_url, text) VALUES (?, ?)")
    .run(image_url, text);
  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/news/:id – удалить новость
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM news WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
