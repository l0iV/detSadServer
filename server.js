const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

const eventsRouter = require("./routes/events");
const teachersRouter = require("./routes/teachers");
const reviewsRouter = require("./routes/reviews");
const contactRouter = require("./routes/contact");
const { errorHandler } = require("./middleware/errorHandler");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Раздаём картинки из папки public/
app.use("/static", express.static(path.join(__dirname, "public")));

// Роуты
app.use("/api/events", eventsRouter);
app.use("/api/teachers", teachersRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/contact", contactRouter);

// Healthcheck
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Обработка ошибок
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});
