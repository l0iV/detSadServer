/**
 * Централизованный обработчик ошибок Express
 */
function errorHandler(err, req, res, next) {
  console.error("❌ Ошибка:", err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? "Внутренняя ошибка сервера" : err.message,
  });
}

module.exports = { errorHandler };
