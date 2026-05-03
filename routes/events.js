const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/events?category=art&search=
router.get("/", async (req, res, next) => {
  try {
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

    const rows = await db.all(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id
router.get("/:id", async (req, res, next) => {
  try {
    const event = await db.get("SELECT * FROM events WHERE id = ?", [req.params.id]);
    if (!event) return res.status(404).json({ error: "Не найдено" });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// POST /api/events
router.post("/", async (req, res, next) => {
  try {
    const { title, description, category, date, date_label, image_url } = req.body;
    if (!title || !description || !date) {
      return res.status(400).json({ error: "Заполни все обязательные поля (title, description, date)" });
    }
    const result = await db.run(
      "INSERT INTO events (title, description, category, date, date_label, image_url) VALUES (?, ?, ?, ?, ?, ?)",
      [title, description, category || "other", date, date_label || null, image_url || null]
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await db.run("DELETE FROM events WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
