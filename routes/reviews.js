const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/reviews — все отзывы (для фронтенда берем approved=1, для админки — все)
router.get("/", (req, res) => {
  const { approved } = req.query;
  let sql = "SELECT * FROM reviews";
  const params = [];
  if (approved !== undefined) {
    sql += " WHERE approved = ?";
    params.push(approved === "true" ? 1 : 0);
  }
  sql += " ORDER BY created_at DESC";
  const rows = db.prepare(sql).all(...params);
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

  // Уведомить бота о новом отзыве
  try {
    const { notifyNewReview } = require("../telegram-bot");
    notifyNewReview(result.lastInsertRowid, name, text);
  } catch (_) {}

  res.status(201).json({ id: result.lastInsertRowid, status: "pending" });
});

// PATCH /api/reviews/:id/approve — одобрить отзыв
router.patch("/:id/approve", (req, res) => {
  db.prepare("UPDATE reviews SET approved = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
