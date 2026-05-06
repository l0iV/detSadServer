const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/rooms
router.get("/", async (_req, res, next) => {
  try {
    const rows = await db.all("SELECT * FROM rooms ORDER BY id");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms
router.post("/", async (req, res, next) => {
  try {
    const { text, image_url } = req.body;
    if (!text) {
      return res.status(400).json({ error: "text обязателен" });
    }
    const result = await db.run(
      "INSERT INTO rooms (text, image_url) VALUES (?, ?)",
      [text, image_url || null],
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rooms/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await db.run("DELETE FROM rooms WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
