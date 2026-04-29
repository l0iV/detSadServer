const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// POST /api/contact
router.post("/", (req, res) => {
  const { name, phone, message } = req.body;

  if (!name || !phone || !message) {
    return res.status(400).json({ error: "Заполни все поля" });
  }

  if (!/^[\d\s\-()+]+$/.test(phone)) {
    return res.status(400).json({ error: "Некорректный номер телефона" });
  }

  db.prepare("INSERT INTO contacts (name, phone, message) VALUES (?, ?, ?)").run(name, phone, message);

  res.json({ ok: true, message: "Заявка принята!" });
});

// GET /api/contact — список заявок
router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM contacts ORDER BY created_at DESC").all();
  res.json(rows);
});

module.exports = router;
