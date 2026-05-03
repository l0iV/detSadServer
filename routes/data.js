const { Router } = require("express");
const db = require("../db/database");

const router = Router();

// GET /api/data — все данные для фронтенда (ISR)
router.get("/data", async (req, res, next) => {
  try {
    const [events, teachers, news, wins, rooms] = await Promise.all([
      db.all("SELECT id, title, description, category, date, date_label, image_url FROM events ORDER BY date DESC"),
      db.all("SELECT id, name, position, experience, education, group_name, phone, image_url FROM teachers"),
      db.all("SELECT id, text, image_url FROM news ORDER BY id DESC LIMIT 10"),
      db.all("SELECT id, description, date, image_url FROM wins ORDER BY id DESC LIMIT 10"),
      db.all("SELECT id, name, description, image_url FROM rooms ORDER BY id"),
    ]);

    res.json({ ok: true, events, teachers, news, wins, rooms });
  } catch (err) {
    next(err);
  }
});

// GET /api/revalidate — Webhook для Vercel On-Demand Revalidation
router.get("/revalidate", (_req, res) => {
  res.json({ revalidated: true, timestamp: Date.now() });
});

module.exports = router;
