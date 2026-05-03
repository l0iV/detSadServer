const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/reviews?approved=true  (для фронта — approved=true, для админки — без параметра)
router.get("/", async (req, res, next) => {
  try {
    const { approved } = req.query;
    let sql = "SELECT * FROM reviews";
    const params = [];
    if (approved !== undefined) {
      sql += " WHERE approved = ?";
      params.push(approved === "true" ? 1 : 0);
    }
    sql += " ORDER BY created_at DESC";
    const rows = await db.all(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews — добавить отзыв (уходит на модерацию)
router.post("/", async (req, res, next) => {
  try {
    const { name, text, rating } = req.body;
    if (!name || !text) {
      return res.status(400).json({ error: "name и text обязательны" });
    }
    const result = await db.run(
      "INSERT INTO reviews (author, text, rating) VALUES (?, ?, ?)",
      [name, text, rating != null ? rating : 5]
    );

    // Уведомить Telegram-бота
    try {
      const { notifyNewReview } = require("../telegram-bot");
      notifyNewReview(result.lastID, name, text);
    } catch (_) {}

    res.status(201).json({ id: result.lastID, status: "pending" });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reviews/:id/approve — одобрить отзыв
router.patch("/:id/approve", async (req, res, next) => {
  try {
    await db.run("UPDATE reviews SET approved = 1 WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
