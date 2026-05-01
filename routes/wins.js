const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/wins – список всех наград
router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM wins ORDER BY id").all();
  res.json(rows);
});

// POST /api/wins – добавить награду
router.post("/", (req, res) => {
  const { description, date, image_url } = req.body;
  if (!description || !date || !image_url) {
    return res.status(400).json({ error: "description, date и image_url обязательны" });
  }
  const result = db
    .prepare("INSERT INTO wins (description, date, image_url) VALUES (?, ?, ?)")
    .run(description, date, image_url);
  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/wins/:id – удалить награду
router.delete(":id", (req, res) => {
  db.prepare("DELETE FROM wins WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
