const { Router } = require("express");
const db = require("../db/database");
const router = Router();

router.post("/", async (req, res) => {
  const { name, phone, message } = req.body;

  if (!name || !phone || !message) {
    return res.status(400).json({ error: "Заполни все поля" });
  }

  if (!/^[\d\s\-()+]+$/.test(phone)) {
    return res.status(400).json({ error: "Некорректный номер телефона" });
  }

  try {
    db.prepare(
      "INSERT INTO contacts (name, phone, message) VALUES (?, ?, ?)"
    ).run(name, phone, message);

    // Уведомление в Telegram
    try {
      const { notifyNewContact } = require("../telegram-bot");
      notifyNewContact(name, phone, message);
    } catch (_) {}

    res.json({ ok: true, message: "Заявка принята!" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM contacts ORDER BY created_at DESC")
    .all();
  res.json(rows);
});

module.exports = router;
