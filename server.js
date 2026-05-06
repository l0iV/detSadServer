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
const contactRouter = require("./routes/contact");
const roomsRouter = require("./routes/rooms");
const documentsRouter = require("./routes/documents");
const dataRouter = require("./routes/data");
const { errorHandler } = require("./middleware/errorHandler");

// ── CORS ──
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://80.93.62.55",
  "http://localhost:4173",
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);

app.use(express.json());
app.use("/static", express.static(path.join(__dirname, "public")));

// ── API роуты ──
app.use("/api/events", eventsRouter);
app.use("/api/teachers", teachersRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/wins", winsRouter);
app.use("/api/contact", contactRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/documents", documentsRouter);
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
app.listen(PORT, "0.0.0.0", () => {
  // '0.0.0.0' важно!
  console.log(`✅ Сервер запущен на порту ${PORT}`);
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
