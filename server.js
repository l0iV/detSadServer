const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

const eventsRouter = require("./routes/events");
const teachersRouter = require("./routes/teachers");
const reviewsRouter = require("./routes/reviews");
const winsRouter = require("./routes/wins");
const newsRouter = require("./routes/news");
const contactRouter = require("./routes/contact");
const { errorHandler } = require("./middleware/errorHandler");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — разрешаем фронтенд (настраивается через .env)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "diplom-iota-eight.vercel.app",
  "http://localhost:4173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // разрешаем запросы без origin (curl, Postman, мобильные)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);

app.use(express.json());

// Статика — загруженные картинки
app.use("/static", express.static(path.join(__dirname, "public")));

// Роуты API
app.use("/api/events", eventsRouter);
app.use("/api/teachers", teachersRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/wins", winsRouter);
app.use("/api/news", newsRouter);
app.use("/api/contact", contactRouter);

// Healthcheck
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() }),
);

// Ошибки
app.use(errorHandler);

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`   CORS разрешён для: ${allowedOrigins.join(", ")}`);
});

// Telegram бот
if (process.env.BOT_TOKEN) {
  console.log("🤖 Запуск Telegram бота...");
  try {
    require("./telegram-bot");
  } catch (error) {
    console.error("❌ Ошибка при запуске бота:", error.message);
  }
} else {
  console.warn("⚠️ BOT_TOKEN не найден в .env. Бот не запущен");
}
