const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/news
router.get("/", async (_req, res, next) => {
  try {
    const rows = await db.all("SELECT * FROM news ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/news
router.post("/", async (req, res, next) => {
  try {
    const { text, image_url } = req.body;
    if (!text) {
      return res.status(400).json({ error: "text обязателен" });
    }
    const result = await db.run(
      "INSERT INTO news (text, image_url) VALUES (?, ?)",
      [text, image_url || null]
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/news/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await db.run("DELETE FROM news WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
