const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// POST /api/contact — принять заявку
router.post("/", async (req, res, next) => {
  try {
    const { name, phone, message } = req.body;

    if (!name || !phone || !message) {
      return res.status(400).json({ error: "Заполни все поля" });
    }
    if (!/^[\d\s\-()+]+$/.test(phone)) {
      return res.status(400).json({ error: "Некорректный номер телефона" });
    }

    await db.run(
      "INSERT INTO contacts (name, phone, message) VALUES (?, ?, ?)",
      [name, phone, message]
    );

    // Уведомление в Telegram
    try {
      const { notifyNewContact } = require("../telegram-bot");
      notifyNewContact(name, phone, message);
    } catch (_) {}

    res.json({ ok: true, message: "Заявка принята!" });
  } catch (err) {
    next(err);
  }
});

// GET /api/contact — список заявок (для админки)
router.get("/", async (_req, res, next) => {
  try {
    const rows = await db.all("SELECT * FROM contacts ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
