const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Роуты ──
const eventsRouter = require("./routes/events");
const teachersRouter = require("./routes/teachers");
const reviewsRouter = require("./routes/reviews");
const winsRouter = require("./routes/wins");
const newsRouter = require("./routes/news");
const contactRouter = require("./routes/contact");
const roomsRouter = require("./routes/rooms");
const dataRouter = require("./routes/data");
const { errorHandler } = require("./middleware/errorHandler");

// ── CORS ──
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://diplom-iota-eight.vercel.app",
  "http://localhost:4173",
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // разрешаем curl / Postman / мобильные (origin = undefined)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);

app.use(express.json());

// ── Статика (картинки) ──
app.use("/static", express.static(path.join(__dirname, "public")));

// ── API роуты ──
app.use("/api/events", eventsRouter);
app.use("/api/teachers", teachersRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/wins", winsRouter);
app.use("/api/news", newsRouter);
app.use("/api/contact", contactRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api", dataRouter);

// ── Healthcheck для Railway ──
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    uptime: process.uptime(),
    time: new Date().toISOString(),
  }),
);

// ── Обработка ошибок ──
app.use(errorHandler);

// ── Запуск ──
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`   CORS разрешён для: ${allowedOrigins.join(", ")}`);
});

// ── Telegram-бот (опционально) ──
if (process.env.BOT_TOKEN) {
  console.log("🤖 Запуск Telegram бота...");
  try {
    require("./telegram-bot");
  } catch (error) {
    console.error("❌ Ошибка при запуске бота:", error.message);
  }
} else {
  console.warn("⚠️  BOT_TOKEN не найден в .env — бот не запущен");
}
