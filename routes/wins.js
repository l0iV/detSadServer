const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/wins
router.get("/", async (_req, res, next) => {
  try {
    const rows = await db.all("SELECT * FROM wins ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/wins
router.post("/", async (req, res, next) => {
  try {
    const { description, date, image_url } = req.body;
    if (!description || !date || !image_url) {
      return res.status(400).json({ error: "description, date и image_url обязательны" });
    }
    const result = await db.run(
      "INSERT INTO wins (description, date, image_url) VALUES (?, ?, ?)",
      [description, date, image_url]
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/wins/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await db.run("DELETE FROM wins WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
