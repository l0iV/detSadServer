const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/reviews — только одобренные
router.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM reviews WHERE approved = 1 ORDER BY created_at DESC")
    .all();
  res.json(rows);
});

// POST /api/reviews — добавить отзыв (уходит на модерацию)
router.post("/", (req, res) => {
  const { name, text, rating } = req.body;

  if (!name || !text) {
    return res.status(400).json({ error: "name и text обязательны" });
  }

  const result = db
    .prepare("INSERT INTO reviews (name, text, rating) VALUES (?, ?, ?)")
    .run(name, text, rating != null ? rating : 5);

  res.status(201).json({ id: result.lastInsertRowid, status: "pending" });
});

// PATCH /api/reviews/:id/approve — одобрить отзыв
router.patch("/:id/approve", (req, res) => {
  db.prepare("UPDATE reviews SET approved = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
