const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/teachers
router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM teachers ORDER BY id").all();
  res.json(rows);
});

// POST /api/teachers
router.post("/", (req, res) => {
  const { name, position, experience, education, group_name, phone, image_url } = req.body;

  if (!name || !position) {
    return res.status(400).json({ error: "name и position обязательны" });
  }

  const result = db
    .prepare(
      `INSERT INTO teachers (name, position, experience, education, group_name, phone, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, position, experience, education, group_name, phone, image_url);

  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/teachers/:id
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM teachers WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
