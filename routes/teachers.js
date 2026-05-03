const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/teachers
router.get("/", async (_req, res, next) => {
  try {
    const rows = await db.all("SELECT * FROM teachers ORDER BY id");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/teachers
router.post("/", async (req, res, next) => {
  try {
    const { name, position, experience, education, group_name, phone, image_url } = req.body;
    if (!name || !position) {
      return res.status(400).json({ error: "name и position обязательны" });
    }
    const result = await db.run(
      `INSERT INTO teachers (name, position, experience, education, group_name, phone, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, position, experience || null, education || null, group_name || null, phone || null, image_url || null]
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/teachers/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await db.run("DELETE FROM teachers WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
