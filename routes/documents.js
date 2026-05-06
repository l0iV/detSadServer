const express = require("express");
const router = express.Router();
const db = require("../db/database");

// GET все документы (для клиента)
router.get("/", async (req, res) => {
  try {
    const docs = await db.all(
      "SELECT id, title, icon, content, file_url, order_num FROM documents WHERE is_active = 1 ORDER BY order_num ASC, id ASC",
    );
    res.json(docs);
  } catch (error) {
    console.error("Ошибка получения документов:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET один документ
router.get("/:id", async (req, res) => {
  try {
    const doc = await db.get(
      "SELECT * FROM documents WHERE id = ?",
      req.params.id,
    );
    if (!doc) {
      return res.status(404).json({ error: "Документ не найден" });
    }
    res.json(doc);
  } catch (error) {
    console.error("Ошибка получения документа:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST создать документ (для бота)
router.post("/", async (req, res) => {
  const { title, icon, content, file_url, order_num } = req.body;

  if (!title || !icon) {
    return res.status(400).json({ error: "Название и иконка обязательны" });
  }

  try {
    const result = await db.run(
      `INSERT INTO documents (title, icon, content, file_url, order_num) 
       VALUES (?, ?, ?, ?, ?)`,
      [title, icon, content || null, file_url || null, order_num || 0],
    );

    res.status(201).json({
      id: result.lastID,
      message: "Документ создан",
    });
  } catch (error) {
    console.error("Ошибка создания документа:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PUT обновить документ (для бота)
router.put("/:id", async (req, res) => {
  const { title, icon, content, file_url, order_num, is_active } = req.body;

  try {
    await db.run(
      `UPDATE documents 
       SET title = COALESCE(?, title),
           icon = COALESCE(?, icon),
           content = ?,
           file_url = ?,
           order_num = COALESCE(?, order_num),
           is_active = COALESCE(?, is_active),
           updated_at = datetime('now')
       WHERE id = ?`,
      [title, icon, content, file_url, order_num, is_active, req.params.id],
    );

    res.json({ message: "Документ обновлён" });
  } catch (error) {
    console.error("Ошибка обновления документа:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE удалить документ (для бота)
router.delete("/:id", async (req, res) => {
  try {
    await db.run("DELETE FROM documents WHERE id = ?", req.params.id);
    res.json({ message: "Документ удалён" });
  } catch (error) {
    console.error("Ошибка удаления документа:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;
