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
    const { name, description, image_url } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name обязателен" });
    }
    const result = await db.run(
      "INSERT INTO rooms (name, description, image_url) VALUES (?, ?, ?)",
      [name, description || null, image_url || null]
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
