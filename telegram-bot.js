/**
 * telegram-bot.js — Бот управления сайтом детского сада
 */

const { Bot, InlineKeyboard } = require("grammy");
const db = require("./db/database");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

// ── Проверка администратора ────────────────────────────────
const isAdmin = (ctx) =>
  ctx.from && ctx.from.id.toString() === process.env.ADMIN_TELEGRAM_ID;

const requireAdmin = async (ctx, next) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("⛔ Доступ запрещён");
    return;
  }
  await next();
};

// ── Состояния диалогов (в памяти) ─────────────────────────
const sessions = {};

const getSession = (userId) => sessions[userId] || null;
const setSession = (userId, data) => {
  sessions[userId] = data;
};
const clearSession = (userId) => {
  delete sessions[userId];
};

// ── Вспомогательные ───────────────────────────────────────
const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const formatDate = (dateStr) => {
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day)} ${MONTHS[parseInt(month) - 1]} ${year} г.`;
};

const CATEGORIES = ["ecology", "art", "holiday", "sport", "health", "other"];
const CAT_EMOJI = {
  ecology: "🌿",
  art: "🎨",
  holiday: "🎉",
  sport: "⚽",
  health: "💊",
  other: "📌",
};
const CAT_LABELS = {
  ecology: "Экология",
  art: "Творчество",
  holiday: "Праздник",
  sport: "Спорт",
  health: "Здоровье",
  other: "Другое",
};

// Сохранить фото из Telegram на диск, вернуть URL
async function savePhoto(ctx, folder, prefix, entityId) {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const file = await ctx.api.getFile(photo.file_id);
  const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  const filename = `${prefix}_${entityId}_${Date.now()}.jpg`;
  const dir = path.join(__dirname, "public", folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, filename), Buffer.from(buffer));
  return `/static/${folder}/${filename}`;
}

// Сохранить файл документа из Telegram
async function saveDocumentFile(ctx, docId) {
  try {
    if (!ctx.message.document) {
      await ctx.reply("❌ Пожалуйста, отправь файл");
      return null;
    }

    const document = ctx.message.document;
    const fileId = document.file_id;
    const fileName = document.file_name;
    const mimeType = document.mime_type;

    // Проверяем тип файла
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(mimeType)) {
      await ctx.reply(
        "❌ Неподдерживаемый формат. Отправь файл в формате PDF, DOC или DOCX",
      );
      return null;
    }

    // Получаем файл
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Создаём папку для документов если её нет
    const docsDir = path.join(__dirname, "public", "documents");
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    // Сохраняем файл
    const response = await axios({
      method: "get",
      url: fileUrl,
      responseType: "stream",
    });

    const uniqueFileName = `${docId}_${Date.now()}_${fileName}`;
    const filePath = path.join(docsDir, uniqueFileName);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    return `/static/documents/${uniqueFileName}`;
  } catch (err) {
    console.error("Ошибка сохранения файла:", err);
    await ctx.reply("❌ Ошибка при сохранении файла");
    return null;
  }
}

// ══════════════════════════════════════════════════════════
//  ГЛАВНОЕ МЕНЮ
// ══════════════════════════════════════════════════════════

const bot = new Bot(process.env.BOT_TOKEN);

const mainMenu = () =>
  new InlineKeyboard()
    .text("📅 Мероприятия", "menu:events")
    .text("👩‍🏫 Педагоги", "menu:teachers")
    .row()
    .text("🏆 Награды", "menu:wins")
    .text("🏠 Кабинеты", "menu:rooms")
    .row()
    .text("📄 Документы", "menu:documents")
    .text("⭐ Отзывы", "menu:reviews")
    .row()
    .text("📬 Заявки", "menu:contacts");

bot.command("start", requireAdmin, async (ctx) => {
  clearSession(ctx.from.id);
  await ctx.reply(
    "🏫 *Панель управления сайтом детского сада*\n\nВыбери раздел:",
    { parse_mode: "Markdown", reply_markup: mainMenu() },
  );
});

bot.command("menu", requireAdmin, async (ctx) => {
  clearSession(ctx.from.id);
  await ctx.reply("Главное меню:", { reply_markup: mainMenu() });
});

// ══════════════════════════════════════════════════════════
//  ОБРАБОТЧИКИ КНОПОК — меню разделов
// ══════════════════════════════════════════════════════════

bot.callbackQuery(/^menu:(.+)$/, requireAdmin, async (ctx) => {
  const section = ctx.match[1];
  await ctx.answerCallbackQuery();
  clearSession(ctx.from.id);

  const menus = {
    events: showEventsMenu,
    teachers: showTeachersMenu,
    wins: showWinsMenu,
    rooms: showRoomsMenu,
    documents: showDocumentsMenu,
    reviews: showReviewsMenu,
    contacts: showContactsMenu,
  };

  if (menus[section]) await menus[section](ctx);
});

// ── Назад в главное меню ──
bot.callbackQuery("back:main", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  clearSession(ctx.from.id);
  await ctx.editMessageText("Главное меню:", { reply_markup: mainMenu() });
});

// ══════════════════════════════════════════════════════════
//  МЕРОПРИЯТИЯ
// ══════════════════════════════════════════════════════════

async function showEventsMenu(ctx) {
  const count = (await db.get("SELECT COUNT(*) AS c FROM events")).c;
  const kb = new InlineKeyboard()
    .text("📋 Список", "events:list")
    .text("➕ Добавить", "events:add")
    .row()
    .text("❌ Удалить", "events:delete")
    .row()
    .text("⬅️ Назад", "back:main");

  const text = `📅 *Мероприятия*\nВсего в базе: ${count}\n\nЧто сделать?`;
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
  }
}

bot.callbackQuery("events:list", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = await db.all(
    "SELECT id, title, category, date_label, image_url FROM events ORDER BY date DESC LIMIT 10",
  );

  if (rows.length === 0) {
    await ctx.editMessageText("📭 Мероприятий пока нет", {
      reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu:events"),
    });
    return;
  }

  let msg = "📋 *Последние мероприятия:*\n\n";
  rows.forEach((e) => {
    const img = e.image_url ? "🖼️" : "📝";
    msg += `*#${e.id}* ${img} ${e.title}\n   ${CAT_EMOJI[e.category] || "📌"} ${e.date_label || ""}\n\n`;
  });

  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard()
      .text("➕ Добавить", "events:add")
      .text("❌ Удалить", "events:delete")
      .row()
      .text("⬅️ Назад", "menu:events"),
  });
});

bot.callbackQuery("events:add", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "event", step: "title", data: {} });
  await ctx.editMessageText(
    "📅 *Новое мероприятие*\n\nШаг 1/4 — Введи *название*:",
    { parse_mode: "Markdown" },
  );
});

bot.callbackQuery("events:delete", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "event_delete", step: "id" });
  await ctx.editMessageText(
    "❌ Введи *ID мероприятия* для удаления:\n(команда /menu для отмены)",
    { parse_mode: "Markdown" },
  );
});

// ══════════════════════════════════════════════════════════
//  ПЕДАГОГИ
// ══════════════════════════════════════════════════════════

async function showTeachersMenu(ctx) {
  const count = (await db.get("SELECT COUNT(*) AS c FROM teachers")).c;
  const kb = new InlineKeyboard()
    .text("📋 Список", "teachers:list")
    .text("➕ Добавить", "teachers:add")
    .row()
    .text("❌ Удалить", "teachers:delete")
    .row()
    .text("⬅️ Назад", "back:main");

  const text = `👩‍🏫 *Педагоги*\nВсего: ${count}\n\nЧто сделать?`;
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
  }
}

bot.callbackQuery("teachers:list", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = await db.all(
    "SELECT id, name, position, group_name FROM teachers ORDER BY id",
  );

  if (rows.length === 0) {
    await ctx.editMessageText("📭 Список педагогов пуст", {
      reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu:teachers"),
    });
    return;
  }

  let msg = "👩‍🏫 *Педагоги:*\n\n";
  rows.forEach((t) => {
    msg += `*#${t.id}* ${t.name}\n   💼 ${t.position}`;
    if (t.group_name) msg += ` | 👶 ${t.group_name}`;
    msg += "\n\n";
  });

  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard()
      .text("➕ Добавить", "teachers:add")
      .text("❌ Удалить", "teachers:delete")
      .row()
      .text("⬅️ Назад", "menu:teachers"),
  });
});

bot.callbackQuery("teachers:add", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "teacher", step: "name", data: {} });
  await ctx.editMessageText(
    "👩‍🏫 *Новый педагог*\n\nШаг 1/6 — Введи *ФИО* (полностью):",
    { parse_mode: "Markdown" },
  );
});

bot.callbackQuery("teachers:delete", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "teacher_delete", step: "id" });
  await ctx.editMessageText(
    "❌ Введи *ID педагога* для удаления:\n(команда /menu для отмены)",
    { parse_mode: "Markdown" },
  );
});

// ══════════════════════════════════════════════════════════
//  НАГРАДЫ
// ══════════════════════════════════════════════════════════

async function showWinsMenu(ctx) {
  const count = (await db.get("SELECT COUNT(*) AS c FROM wins")).c;
  const kb = new InlineKeyboard()
    .text("📋 Список", "wins:list")
    .text("➕ Добавить", "wins:add")
    .row()
    .text("❌ Удалить", "wins:delete")
    .row()
    .text("⬅️ Назад", "back:main");

  const text = `🏆 *Награды*\nВсего: ${count}\n\nЧто сделать?`;
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
  }
}

bot.callbackQuery("wins:list", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = await db.all(
    "SELECT id, description, date FROM wins ORDER BY id DESC LIMIT 10",
  );

  if (rows.length === 0) {
    await ctx.editMessageText("📭 Наград пока нет", {
      reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu:wins"),
    });
    return;
  }

  let msg = "🏆 *Награды:*\n\n";
  rows.forEach((w) => {
    msg += `*#${w.id}* ${w.description.slice(0, 60)}\n   📅 ${w.date}\n\n`;
  });

  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard()
      .text("➕ Добавить", "wins:add")
      .text("❌ Удалить", "wins:delete")
      .row()
      .text("⬅️ Назад", "menu:wins"),
  });
});

bot.callbackQuery("wins:add", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "win", step: "description", data: {} });
  await ctx.editMessageText(
    "🏆 *Новая награда*\n\nШаг 1/3 — Введи *описание* награды:",
    { parse_mode: "Markdown" },
  );
});

bot.callbackQuery("wins:delete", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "win_delete", step: "id" });
  await ctx.editMessageText(
    "❌ Введи *ID награды* для удаления:\n(команда /menu для отмены)",
    { parse_mode: "Markdown" },
  );
});

// ══════════════════════════════════════════════════════════
//  КАБИНЕТЫ / ЗАЛЫ
// ══════════════════════════════════════════════════════════

async function showRoomsMenu(ctx) {
  const count = (await db.get("SELECT COUNT(*) AS c FROM rooms")).c;
  const kb = new InlineKeyboard()
    .text("📋 Список", "rooms:list")
    .text("➕ Добавить", "rooms:add")
    .row()
    .text("❌ Удалить", "rooms:delete")
    .row()
    .text("⬅️ Назад", "back:main");

  const text = `🏠 *Кабинеты и залы*\nВсего: ${count}\n\nЧто сделать?`;
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
  }
}

bot.callbackQuery("rooms:list", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = await db.all(
    "SELECT id, text, image_url FROM rooms ORDER BY id DESC LIMIT 10",
  );

  if (rows.length === 0) {
    await ctx.editMessageText("🏠 Кабинетов пока нет", {
      reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu:rooms"),
    });
    return;
  }

  let msg = "🏠 *Кабинеты и залы:*\n\n";
  rows.forEach((r) => {
    const img = r.image_url ? "🖼️ " : "📝 ";
    msg += `*#${r.id}* ${img}${r.text.substring(0, 80)}...\n\n`;
  });

  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard()
      .text("➕ Добавить", "rooms:add")
      .text("❌ Удалить", "rooms:delete")
      .row()
      .text("⬅️ Назад", "menu:rooms"),
  });
});

bot.callbackQuery("rooms:add", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "room", step: "text", data: {} });
  await ctx.editMessageText(
    "🏠 *Новый кабинет/зал*\n\nШаг 1/2 — Введи *описание* кабинета:",
    { parse_mode: "Markdown" },
  );
});

bot.callbackQuery("rooms:delete", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "room_delete", step: "id" });
  await ctx.editMessageText(
    "❌ Введи *ID кабинета* для удаления:\n(команда /menu для отмены)",
    { parse_mode: "Markdown" },
  );
});

// ══════════════════════════════════════════════════════════
//  ДОКУМЕНТЫ
// ══════════════════════════════════════════════════════════

async function showDocumentsMenu(ctx) {
  const count = (
    await db.get("SELECT COUNT(*) AS c FROM documents WHERE is_active = 1")
  ).c;
  const kb = new InlineKeyboard()
    .text("📋 Список", "documents:list")
    .text("➕ Добавить", "documents:add")
    .row()
    .text("✏️ Редактировать", "documents:edit")
    .text("❌ Удалить", "documents:delete")
    .row()
    .text("⬅️ Назад", "back:main");

  const text = `📄 *Документы*\nВсего в базе: ${count}\n\nЧто сделать?`;
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
  }
}

bot.callbackQuery("documents:list", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  const docs = await db.all(
    "SELECT id, title, icon, order_num, file_url FROM documents WHERE is_active = 1 ORDER BY order_num ASC",
  );

  if (docs.length === 0) {
    await ctx.editMessageText("📭 Документов пока нет", {
      reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu:documents"),
    });
    return;
  }

  let msg = "📄 *Список документов:*\n\n";
  docs.forEach((doc) => {
    const hasFile = doc.file_url ? "📎" : "📄";
    msg += `${doc.icon} *#${doc.id}* ${hasFile} ${doc.title}\n   📊 Порядок: ${doc.order_num}\n\n`;
  });

  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard()
      .text("➕ Добавить", "documents:add")
      .text("✏️ Редактировать", "documents:edit")
      .row()
      .text("⬅️ Назад", "menu:documents"),
  });
});

bot.callbackQuery("documents:add", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "document", step: "title", data: {} });
  await ctx.editMessageText(
    "📄 *Новый документ*\n\nШаг 1/4 — Введи *название* документа:",
    { parse_mode: "Markdown" },
  );
});

bot.callbackQuery("documents:edit", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  const docs = await db.all(
    "SELECT id, title, icon FROM documents WHERE is_active = 1 ORDER BY order_num",
  );

  if (docs.length === 0) {
    await ctx.editMessageText("📭 Нет документов для редактирования", {
      reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu:documents"),
    });
    return;
  }

  const kb = new InlineKeyboard();
  docs.forEach((doc) => {
    kb.text(`${doc.icon} ${doc.title}`, `doc:edit_select:${doc.id}`).row();
  });
  kb.row().text("⬅️ Назад", "menu:documents");

  await ctx.editMessageText("✏️ *Выбери документ для редактирования:*", {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
});

bot.callbackQuery("documents:delete", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "document_delete", step: "id" });
  await ctx.editMessageText(
    "❌ Введи *ID документа* для удаления:\n(команда /menu для отмены)",
    { parse_mode: "Markdown" },
  );
});

bot.callbackQuery(/^doc:edit_select:(\d+)$/, requireAdmin, async (ctx) => {
  const docId = parseInt(ctx.match[1]);
  const doc = await db.get("SELECT * FROM documents WHERE id = ?", [docId]);

  if (!doc) {
    await ctx.answerCallbackQuery("Документ не найден");
    return;
  }

  const kb = new InlineKeyboard()
    .text("✏️ Название", `doc:edit_field:${docId}:title`)
    .text("🎨 Иконку", `doc:edit_field:${docId}:icon`)
    .row()
    .text("📝 Содержание", `doc:edit_field:${docId}:content`)
    .text("📎 Загрузить файл", `doc:edit_field:${docId}:file_url`)
    .row()
    .text("🔢 Порядок", `doc:edit_field:${docId}:order_num`)
    .text("🟢/🔴 Активность", `doc:edit_field:${docId}:is_active`)
    .row()
    .text("⬅️ Назад", "menu:documents");

  const hasFile = doc.file_url ? "✅ Да" : "❌ Нет";
  const msg =
    `✏️ *Редактирование документа #${doc.id}*\n\n` +
    `📌 Название: ${doc.title}\n` +
    `🎨 Иконка: ${doc.icon}\n` +
    `📝 Содержание: ${doc.content ? doc.content.slice(0, 50) + "..." : "не задано"}\n` +
    `📎 Файл: ${hasFile}\n` +
    `🔢 Порядок: ${doc.order_num}\n` +
    `🟢 Активен: ${doc.is_active ? "да" : "нет"}\n\n` +
    `Что хочешь изменить?`;

  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
});

bot.callbackQuery(/^doc:edit_field:(\d+):(\w+)$/, requireAdmin, async (ctx) => {
  const docId = parseInt(ctx.match[1]);
  const field = ctx.match[2];

  const fieldNames = {
    title: "название",
    icon: "иконку (один emoji)",
    content: "содержание документа (текст или HTML)",
    file_url: "файл (PDF, DOCX, DOC)",
    order_num: "порядковый номер (число)",
    is_active: "статус (1 - активен, 0 - неактивен)",
  };

  if (field === "file_url") {
    setSession(ctx.from.id, {
      entity: "document_file_upload",
      step: "waiting_for_file",
      data: { docId, field },
    });

    await ctx.editMessageText(
      `📎 *Загрузка файла для документа #${docId}*\n\n` +
        `Отправь файл в одном из форматов:\n` +
        `• PDF - документы\n` +
        `• DOCX/DOC - документы Word\n\n` +
        `Файл будет автоматически сохранён и привязан к документу.\n\n` +
        `(команда /menu для отмены)`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  setSession(ctx.from.id, {
    entity: "document_edit",
    step: "value",
    data: { docId, field },
  });

  await ctx.editMessageText(
    `✏️ Введи новое *${fieldNames[field]}* для документа #${docId}:\n(команда /menu для отмены)`,
    { parse_mode: "Markdown" },
  );
});

// ══════════════════════════════════════════════════════════
//  ОТЗЫВЫ
// ══════════════════════════════════════════════════════════

async function showReviewsMenu(ctx) {
  const pending = (
    await db.get("SELECT COUNT(*) AS c FROM reviews WHERE approved = 0")
  ).c;
  const total = (await db.get("SELECT COUNT(*) AS c FROM reviews")).c;
  const kb = new InlineKeyboard()
    .text("🔍 На модерации", "reviews:pending")
    .row()
    .text("✅ Все одобренные", "reviews:approved")
    .row()
    .text("⬅️ Назад", "back:main");

  const text = `⭐ *Отзывы*\nВсего: ${total} | На модерации: ${pending}\n\nЧто сделать?`;
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
  }
}

bot.callbackQuery("reviews:pending", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = await db.all(
    "SELECT id, author, text, rating FROM reviews WHERE approved = 0 ORDER BY created_at DESC LIMIT 8",
  );

  if (rows.length === 0) {
    await ctx.editMessageText("✅ Нет отзывов на модерации!", {
      reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu:reviews"),
    });
    return;
  }

  await showReviewCard(ctx, rows, 0, "edit");
});

bot.callbackQuery("reviews:approved", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = await db.all(
    "SELECT id, author, text, rating FROM reviews WHERE approved = 1 ORDER BY created_at DESC LIMIT 10",
  );

  if (rows.length === 0) {
    await ctx.editMessageText("📭 Нет одобренных отзывов", {
      reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu:reviews"),
    });
    return;
  }

  let msg = "✅ *Одобренные отзывы:*\n\n";
  rows.forEach((r) => {
    const stars = "⭐".repeat(r.rating || 5);
    msg += `*#${r.id}* ${r.author} ${stars}\n«${r.text.slice(0, 100)}...»\n\n`;
  });

  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard()
      .text("🗑️ Удалить отзыв", "reviews:delete_approved")
      .row()
      .text("⬅️ Назад", "menu:reviews"),
  });
});

bot.callbackQuery("reviews:delete_approved", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "review_delete", step: "id" });
  await ctx.editMessageText(
    "❌ Введи *ID отзыва* для удаления:\n(команда /menu для отмены)",
    { parse_mode: "Markdown" },
  );
});

async function showReviewCard(ctx, rows, index, mode) {
  const r = rows[index];
  const stars = "⭐".repeat(r.rating || 5);
  const msg =
    `⭐ *Отзыв на модерации ${index + 1}/${rows.length}*\n\n` +
    `*Автор:* ${r.author} ${stars}\n` +
    `*Текст:* «${r.text.slice(0, 400)}»\n\n` +
    `*ID:* ${r.id}`;

  const kb = new InlineKeyboard()
    .text("✅ Одобрить", `review:approve:${r.id}`)
    .text("❌ Удалить", `review:delete:${r.id}`)
    .row();

  if (index + 1 < rows.length) {
    kb.text(
      "▶️ Следующий",
      `review:next:${index + 1}:${rows.map((x) => x.id).join(",")}`,
    ).row();
  }
  kb.text("⬅️ К отзывам", "menu:reviews");

  if (mode === "edit") {
    await ctx.editMessageText(msg, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } else {
    await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
  }
}

bot.callbackQuery(/^review:approve:(\d+)$/, requireAdmin, async (ctx) => {
  const id = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();
  await db.run("UPDATE reviews SET approved = 1 WHERE id = ?", [id]);
  await ctx.editMessageText(`✅ Отзыв #${id} одобрен и опубликован!`, {
    reply_markup: new InlineKeyboard().text("⬅️ К отзывам", "menu:reviews"),
  });
});

bot.callbackQuery(/^review:delete:(\d+)$/, requireAdmin, async (ctx) => {
  const id = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();
  await db.run("DELETE FROM reviews WHERE id = ?", [id]);
  await ctx.editMessageText(`🗑️ Отзыв #${id} удалён.`, {
    reply_markup: new InlineKeyboard().text("⬅️ К отзывам", "menu:reviews"),
  });
});

bot.callbackQuery(/^review:next:(\d+):(.+)$/, requireAdmin, async (ctx) => {
  const index = parseInt(ctx.match[1]);
  const ids = ctx.match[2].split(",").map(Number);
  await ctx.answerCallbackQuery();

  const rows = await db.all(
    `SELECT id, author, text, rating FROM reviews WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at DESC`,
    ids,
  );
  await showReviewCard(ctx, rows, index, "edit");
});

// ══════════════════════════════════════════════════════════
//  ЗАЯВКИ (contacts)
// ══════════════════════════════════════════════════════════

async function showContactsMenu(ctx) {
  const count = (await db.get("SELECT COUNT(*) AS c FROM contacts")).c;
  const kb = new InlineKeyboard()
    .text("📋 Последние заявки", "contacts:list")
    .row()
    .text("🗑️ Удалить по ID", "contacts:delete")
    .row()
    .text("⬅️ Назад", "back:main");

  const text = `📬 *Заявки с сайта*\nВсего: ${count}\n\nЧто сделать?`;
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
  }
}

bot.callbackQuery("contacts:list", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = await db.all(
    "SELECT id, name, phone, message, created_at FROM contacts ORDER BY created_at DESC LIMIT 10",
  );

  if (rows.length === 0) {
    await ctx.editMessageText("📭 Заявок пока нет", {
      reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu:contacts"),
    });
    return;
  }

  let msg = `📬 *Последние заявки (${rows.length}):*\n\n`;
  rows.forEach((c) => {
    const date = c.created_at ? c.created_at.slice(0, 16) : "";
    msg += `*#${c.id}* ${date}\n👤 ${c.name} | 📞 ${c.phone}\n💬 ${c.message.slice(0, 120)}\n\n`;
  });

  await ctx.editMessageText(msg, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard()
      .text("🗑️ Удалить по ID", "contacts:delete")
      .row()
      .text("⬅️ Назад", "menu:contacts"),
  });
});

bot.callbackQuery("contacts:delete", requireAdmin, async (ctx) => {
  await ctx.answerCallbackQuery();
  setSession(ctx.from.id, { entity: "contact_delete", step: "id" });
  await ctx.editMessageText(
    "🗑️ Введи *ID заявки* для удаления:\n(команда /menu для отмены)",
    { parse_mode: "Markdown" },
  );
});

// ══════════════════════════════════════════════════════════
//  ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ (пошаговый ввод)
// ══════════════════════════════════════════════════════════

bot.on("message:text", requireAdmin, async (ctx) => {
  const session = getSession(ctx.from.id);

  if (!session) {
    await ctx.reply("Используй /menu для открытия панели управления.");
    return;
  }

  const text = ctx.message.text.trim();

  if (text === "/menu" || text === "/start") {
    clearSession(ctx.from.id);
    await ctx.reply("Главное меню:", { reply_markup: mainMenu() });
    return;
  }

  if (session.entity === "event") {
    await handleEventStep(ctx, session, text);
    return;
  }

  if (session.entity === "teacher") {
    await handleTeacherStep(ctx, session, text);
    return;
  }

  if (session.entity === "win") {
    await handleWinStep(ctx, session, text);
    return;
  }

  if (session.entity === "room") {
    await handleRoomStep(ctx, session, text);
    return;
  }

  if (session.entity === "document") {
    await handleDocumentStep(ctx, session, text);
    return;
  }

  if (session.entity === "document_edit") {
    await handleDocumentEdit(ctx, session, text);
    return;
  }

  const deleteHandlers = {
    event_delete: () => deleteEntity(ctx, "events", text),
    teacher_delete: () => deleteEntity(ctx, "teachers", text),
    win_delete: () => deleteEntity(ctx, "wins", text),
    room_delete: () => deleteEntity(ctx, "rooms", text),
    contact_delete: () => deleteEntity(ctx, "contacts", text),
    review_delete: () => deleteEntity(ctx, "reviews", text),
    document_delete: () => deleteEntity(ctx, "documents", text),
  };

  if (deleteHandlers[session.entity]) {
    await deleteHandlers[session.entity]();
  }
});

// Обработка загрузки файлов для документов
bot.on("message:document", requireAdmin, async (ctx) => {
  const session = getSession(ctx.from.id);

  if (session && session.entity === "document_file_upload") {
    const { docId } = session.data;

    const fileUrl = await saveDocumentFile(ctx, docId);
    if (fileUrl) {
      await db.run(
        `UPDATE documents SET file_url = ?, updated_at = datetime('now') WHERE id = ?`,
        [fileUrl, docId],
      );
      clearSession(ctx.from.id);
      await ctx.reply(`✅ Файл загружен и привязан к документу #${docId}!`, {
        reply_markup: new InlineKeyboard().text(
          "⬅️ К документам",
          "menu:documents",
        ),
      });
    }
    return;
  }

  await ctx.reply("Нет активного диалога для загрузки файла. Используй /menu");
});

async function deleteEntity(ctx, table, text) {
  const id = parseInt(text);
  if (isNaN(id)) {
    await ctx.reply("❌ Неверный ID. Введи число:");
    return;
  }

  const tableLabel = {
    events: "Мероприятие",
    teachers: "Педагог",
    wins: "Награда",
    rooms: "Кабинет",
    contacts: "Заявка",
    reviews: "Отзыв",
    documents: "Документ",
  };

  const row = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) {
    await ctx.reply(`❌ Запись #${id} не найдена.`);
    clearSession(ctx.from.id);
    return;
  }

  if (row.image_url) {
    const filepath = path.join(
      __dirname,
      "public",
      row.image_url.replace("/static/", ""),
    );
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }

  if (row.file_url && table === "documents") {
    const filepath = path.join(
      __dirname,
      "public",
      row.file_url.replace("/static/", ""),
    );
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }

  await db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  clearSession(ctx.from.id);

  const label = tableLabel[table] || "Запись";
  await ctx.reply(`✅ ${label} #${id} удалён(а)!`, {
    reply_markup: new InlineKeyboard().text("⬅️ В меню", "back:main"),
  });
}

// ══════════════════════════════════════════════════════════
//  ПОШАГОВЫЙ ВВОД — МЕРОПРИЯТИЕ
// ══════════════════════════════════════════════════════════

async function handleEventStep(ctx, session, text) {
  const { step, data } = session;

  if (step === "title") {
    data.title = text;
    session.step = "description";
    setSession(ctx.from.id, session);
    await ctx.reply("Шаг 2/4 — Введи *описание* мероприятия:", {
      parse_mode: "Markdown",
    });
    return;
  }

  if (step === "description") {
    data.description = text;
    session.step = "category";
    setSession(ctx.from.id, session);

    const kb = new InlineKeyboard();
    CATEGORIES.forEach((cat, i) => {
      kb.text(`${CAT_EMOJI[cat]} ${CAT_LABELS[cat]}`, `evcat:${cat}`);
      if (i % 2 === 1) kb.row();
    });

    await ctx.reply("Шаг 3/4 — Выбери *категорию*:", {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
    return;
  }

  if (step === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      await ctx.reply(
        "❌ Неверный формат даты. Нужно *ГГГГ-ММ-ДД* (пример: `2026-06-01`)\nПопробуй ещё:",
        { parse_mode: "Markdown" },
      );
      return;
    }
    data.date = text;
    data.date_label = formatDate(text);
    session.step = "photo";
    setSession(ctx.from.id, session);
    await ctx.reply(
      `✅ Дата: *${data.date_label}*\n\nШаг 4/4 — Отправь *фото* мероприятия\n(или нажми «Без фото»):`,
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("📝 Без фото", "event:nophoto"),
      },
    );
    return;
  }
}

bot.callbackQuery(/^evcat:(.+)$/, requireAdmin, async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.entity !== "event") return;

  await ctx.answerCallbackQuery();
  session.data.category = ctx.match[1];
  session.step = "date";
  setSession(ctx.from.id, session);

  await ctx.editMessageText(
    `Категория: *${CAT_EMOJI[ctx.match[1]]} ${CAT_LABELS[ctx.match[1]]}*\n\nШаг 4/4 — Введи *дату* в формате ГГГГ-ММ-ДД\n(пример: \`2026-06-01\`):`,
    { parse_mode: "Markdown" },
  );
});

bot.callbackQuery("event:nophoto", requireAdmin, async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.entity !== "event") return;
  await ctx.answerCallbackQuery();
  await saveEvent(ctx, session.data, null);
});

async function saveEvent(ctx, data, imageUrl) {
  try {
    const result = await db.run(
      "INSERT INTO events (title, description, category, date, date_label, image_url) VALUES (?, ?, ?, ?, ?, ?)",
      [
        data.title,
        data.description,
        data.category,
        data.date,
        data.date_label,
        imageUrl,
      ],
    );
    clearSession(ctx.from.id);
    const emoji = CAT_EMOJI[data.category];
    await ctx.reply(
      `🎉 *Мероприятие добавлено!*\n\n` +
        `🆔 ID: ${result.lastID}\n` +
        `📌 ${data.title}\n` +
        `${emoji} ${CAT_LABELS[data.category]}\n` +
        `📅 ${data.date_label}` +
        (imageUrl ? `\n🖼️ Фото загружено` : `\n📝 Без фото`),
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text(
          "⬅️ К мероприятиям",
          "menu:events",
        ),
      },
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Ошибка при сохранении мероприятия");
  }
}

// ══════════════════════════════════════════════════════════
//  ПОШАГОВЫЙ ВВОД — ПЕДАГОГ
// ══════════════════════════════════════════════════════════

const TEACHER_STEPS = [
  { key: "name", label: "ФИО", step: "position", num: "1/6", required: true },
  {
    key: "position",
    label: "должность",
    step: "experience",
    num: "2/6",
    required: true,
  },
  {
    key: "experience",
    label: "стаж работы",
    step: "education",
    num: "3/6",
    required: false,
  },
  {
    key: "education",
    label: "образование",
    step: "group_name",
    num: "4/6",
    required: false,
  },
  {
    key: "group_name",
    label: "группу",
    step: "phone",
    num: "5/6",
    required: false,
  },
  {
    key: "phone",
    label: "телефон",
    step: "photo",
    num: "6/6",
    required: false,
  },
];

async function handleTeacherStep(ctx, session, text) {
  const currentStep = TEACHER_STEPS.find((s) => s.key === session.step);
  if (!currentStep) return;

  const value =
    text === "-" || text === "—" || text.toLowerCase() === "нет" ? null : text;
  session.data[currentStep.key] = value;
  session.step = currentStep.step;
  setSession(ctx.from.id, session);

  if (currentStep.step === "photo") {
    await ctx.reply(
      `✅ Данные записаны!\n\nОтправь *фото* педагога\n(или нажми «Без фото»):`,
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text(
          "📝 Без фото",
          "teacher:nophoto",
        ),
      },
    );
    return;
  }

  const nextStep = TEACHER_STEPS.find((s) => s.key === currentStep.step);
  const hint =
    nextStep && !nextStep.required ? " (или «-» чтобы пропустить)" : "";
  await ctx.reply(`Шаг ${nextStep?.num} — Введи *${nextStep?.label}*${hint}:`, {
    parse_mode: "Markdown",
  });
}

bot.callbackQuery("teacher:nophoto", requireAdmin, async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.entity !== "teacher") return;
  await ctx.answerCallbackQuery();
  await saveTeacher(ctx, session.data, null);
});

async function saveTeacher(ctx, data, imageUrl) {
  try {
    const result = await db.run(
      "INSERT INTO teachers (name, position, experience, education, group_name, phone, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        data.name,
        data.position,
        data.experience || null,
        data.education || null,
        data.group_name || null,
        data.phone || null,
        imageUrl,
      ],
    );
    clearSession(ctx.from.id);
    await ctx.reply(
      `🎉 *Педагог добавлен!*\n\n` +
        `🆔 ID: ${result.lastID}\n` +
        `👩‍🏫 ${data.name}\n` +
        `💼 ${data.position}` +
        (data.group_name ? `\n👶 ${data.group_name}` : "") +
        (imageUrl ? `\n🖼️ Фото загружено` : ""),
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text(
          "⬅️ К педагогам",
          "menu:teachers",
        ),
      },
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Ошибка при сохранении педагога");
  }
}

// ══════════════════════════════════════════════════════════
//  ПОШАГОВЫЙ ВВОД — НАГРАДА
// ══════════════════════════════════════════════════════════

async function handleWinStep(ctx, session, text) {
  const { step, data } = session;

  if (step === "description") {
    data.description = text;
    session.step = "date";
    setSession(ctx.from.id, session);
    await ctx.reply("Шаг 2/3 — Введи *дату* в формате ГГГГ-ММ-ДД:", {
      parse_mode: "Markdown",
    });
    return;
  }

  if (step === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      await ctx.reply(
        "❌ Неверный формат. Нужно *ГГГГ-ММ-ДД* (пример: `2024-03-10`)\nПопробуй ещё:",
        { parse_mode: "Markdown" },
      );
      return;
    }
    data.date = text;
    session.step = "photo";
    setSession(ctx.from.id, session);
    await ctx.reply(
      "Шаг 3/3 — Отправь *фото* грамоты/диплома\n(или нажми «Без фото»):",
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("📝 Без фото", "win:nophoto"),
      },
    );
    return;
  }
}

bot.callbackQuery("win:nophoto", requireAdmin, async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.entity !== "win") return;
  await ctx.answerCallbackQuery();
  await saveWin(ctx, session.data, "/static/wins/default.jpg");
});

async function saveWin(ctx, data, imageUrl) {
  try {
    const result = await db.run(
      "INSERT INTO wins (description, date, image_url) VALUES (?, ?, ?)",
      [data.description, data.date, imageUrl],
    );
    clearSession(ctx.from.id);
    await ctx.reply(
      `🎉 *Награда добавлена!*\n\n🆔 ID: ${result.lastID}\n🏆 ${data.description}\n📅 ${data.date}`,
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("⬅️ К наградам", "menu:wins"),
      },
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Ошибка при сохранении награды");
  }
}

// ══════════════════════════════════════════════════════════
//  ПОШАГОВЫЙ ВВОД — КАБИНЕТ (rooms)
// ══════════════════════════════════════════════════════════

async function handleRoomStep(ctx, session, text) {
  const { step, data } = session;

  if (step === "text") {
    data.text = text;
    session.step = "photo";
    setSession(ctx.from.id, session);
    await ctx.reply(
      "Шаг 2/2 — Отправь *фото* кабинета\n(или нажми «Без фото»):",
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("📝 Без фото", "room:nophoto"),
      },
    );
    return;
  }
}

bot.callbackQuery("room:nophoto", requireAdmin, async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.entity !== "room") return;
  await ctx.answerCallbackQuery();
  await saveRoom(ctx, session.data, null);
});

async function saveRoom(ctx, data, imageUrl) {
  try {
    const result = await db.run(
      "INSERT INTO rooms (text, image_url) VALUES (?, ?)",
      [data.text, imageUrl],
    );
    clearSession(ctx.from.id);
    await ctx.reply(
      `🎉 *Кабинет добавлен!*\n\n🆔 ID: ${result.lastID}\n🏠 ${data.text.substring(0, 100)}...`,
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("⬅️ К кабинетам", "menu:rooms"),
      },
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Ошибка при сохранении кабинета");
  }
}

// ══════════════════════════════════════════════════════════
//  ПОШАГОВЫЙ ВВОД — ДОКУМЕНТ
// ══════════════════════════════════════════════════════════

async function handleDocumentStep(ctx, session, text) {
  const { step, data } = session;

  if (step === "title") {
    data.title = text;
    session.step = "icon";
    setSession(ctx.from.id, session);
    await ctx.reply(
      "Шаг 2/4 — Введи *иконку* документа (один emoji, например 📄):",
      {
        parse_mode: "Markdown",
      },
    );
    return;
  }

  if (step === "icon") {
    const emojiRegex = /\p{Emoji}/u;
    if (!emojiRegex.test(text)) {
      await ctx.reply(
        "❌ Пожалуйста, введи emoji иконку (например: 📄, 📖, 🕒)",
      );
      return;
    }
    data.icon = text;
    session.step = "content";
    setSession(ctx.from.id, session);
    await ctx.reply(
      "Шаг 3/4 — Введи *содержание* документа (текст или HTML)\n(или отправь '-' чтобы пропустить):",
      { parse_mode: "Markdown" },
    );
    return;
  }

  if (step === "content") {
    data.content = text === "-" ? null : text;
    session.step = "order_num";
    setSession(ctx.from.id, session);
    await ctx.reply(
      "Шаг 4/4 — Введи *порядковый номер* (число, чем меньше - тем выше в списке):\n(или '-' для 0):",
      { parse_mode: "Markdown" },
    );
    return;
  }

  if (step === "order_num") {
    const orderNum = text === "-" ? 0 : parseInt(text);
    data.order_num = isNaN(orderNum) ? 0 : orderNum;
    await saveDocument(ctx, data);
  }
}

async function saveDocument(ctx, data) {
  try {
    const result = await db.run(
      `INSERT INTO documents (title, icon, content, order_num, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [data.title, data.icon, data.content, data.order_num],
    );
    clearSession(ctx.from.id);
    await ctx.reply(
      `✅ *Документ добавлен!*\n\n` +
        `🆔 ID: ${result.lastID}\n` +
        `${data.icon} ${data.title}\n` +
        `🔢 Порядок: ${data.order_num}` +
        (data.content ? `\n📝 Содержание: добавлено` : ""),
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text(
          "⬅️ К документам",
          "menu:documents",
        ),
      },
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Ошибка при сохранении документа");
  }
}

async function handleDocumentEdit(ctx, session, text) {
  const { docId, field } = session.data;

  let value = text;
  if (field === "order_num") {
    value = parseInt(text);
    if (isNaN(value)) {
      await ctx.reply("❌ Введи число!");
      return;
    }
  }
  if (field === "is_active") {
    value = parseInt(text) === 1 ? 1 : 0;
  }

  try {
    await db.run(
      `UPDATE documents SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`,
      [value, docId],
    );
    clearSession(ctx.from.id);
    await ctx.reply(`✅ Поле "${field}" обновлено для документа #${docId}!`, {
      reply_markup: new InlineKeyboard().text(
        "⬅️ К документам",
        "menu:documents",
      ),
    });
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Ошибка при обновлении");
  }
}

// ══════════════════════════════════════════════════════════
//  ОБРАБОТКА ФОТО
// ══════════════════════════════════════════════════════════

bot.on("message:photo", requireAdmin, async (ctx) => {
  const session = getSession(ctx.from.id);

  if (!session) {
    const caption = ctx.message.caption || "";
    const imgMatch = caption.match(/^\/(img|teacher|win|room)\s+(\d+)$/i);
    if (imgMatch) {
      const type = imgMatch[1].toLowerCase();
      const id = parseInt(imgMatch[2]);
      await handleManualPhotoUpdate(ctx, type, id);
    } else {
      await ctx.reply(
        "Нет активного диалога. Используй /menu или укажи подпись: `/room ID`",
        { parse_mode: "Markdown" },
      );
    }
    return;
  }

  if (session.step !== "photo") {
    await ctx.reply(
      "Сейчас не ожидается фото. Следуй инструкциям или /menu для отмены.",
    );
    return;
  }

  const { entity, data } = session;
  const folderMap = {
    event: "events",
    teacher: "teachers",
    win: "wins",
    room: "rooms",
  };
  const folder = folderMap[entity] || "static";

  try {
    const imageUrl = await savePhoto(ctx, folder, entity, Date.now());

    if (entity === "event") {
      await saveEvent(ctx, data, imageUrl);
      return;
    }
    if (entity === "teacher") {
      await saveTeacher(ctx, data, imageUrl);
      return;
    }
    if (entity === "win") {
      await saveWin(ctx, data, imageUrl);
      return;
    }
    if (entity === "room") {
      await saveRoom(ctx, data, imageUrl);
      return;
    }
  } catch (err) {
    console.error("Ошибка загрузки фото:", err);
    await ctx.reply("❌ Ошибка при загрузке фото. Попробуй ещё раз.");
  }
});

async function handleManualPhotoUpdate(ctx, type, id) {
  const tableMap = {
    img: "events",
    teacher: "teachers",
    win: "wins",
    room: "rooms",
  };
  const folderMap = {
    img: "events",
    teacher: "teachers",
    win: "wins",
    room: "rooms",
  };
  const labelMap = {
    img: "Мероприятие",
    teacher: "Педагог",
    win: "Награда",
    room: "Кабинет",
  };

  const table = tableMap[type];
  const folder = folderMap[type];
  const label = labelMap[type];

  const row = await db.get(`SELECT id FROM ${table} WHERE id = ?`, [id]);
  if (!row) {
    await ctx.reply(`❌ ${label} #${id} не найден`);
    return;
  }

  try {
    const imageUrl = await savePhoto(ctx, folder, type, id);
    await db.run(`UPDATE ${table} SET image_url = ? WHERE id = ?`, [
      imageUrl,
      id,
    ]);
    await ctx.reply(`✅ Фото для ${label} #${id} обновлено!`);
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Ошибка при загрузке фото");
  }
}

// ══════════════════════════════════════════════════════════
//  УВЕДОМЛЕНИЯ С САЙТА
// ══════════════════════════════════════════════════════════

const notifyNewContact = async (name, phone, message) => {
  if (!process.env.CHAT_ID) return;
  try {
    await bot.api.sendMessage(
      process.env.CHAT_ID,
      `📬 *Новая заявка с сайта!*\n\n👤 ${name}\n📞 ${phone}\n💬 ${message}`,
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    console.error("Telegram notify error:", err.message);
  }
};

const notifyNewReview = async (id, author, text) => {
  if (!process.env.CHAT_ID) return;
  try {
    await bot.api.sendMessage(
      process.env.CHAT_ID,
      `⭐ *Новый отзыв ждёт модерации!*\n\n👤 ${author}\n«${text.slice(0, 300)}»\n\n✅ /approve ${id}  ❌ /delreview ${id}`,
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    console.error("Telegram notify error:", err.message);
  }
};

// ══════════════════════════════════════════════════════════
//  ЗАПУСК
// ══════════════════════════════════════════════════════════

bot.catch((err) => console.error("❌ Ошибка бота:", err.message));

async function startBot() {
  if (!process.env.BOT_TOKEN) {
    console.error("❌ BOT_TOKEN не задан в .env");
    return;
  }
  try {
    if (process.env.ADMIN_TELEGRAM_ID) {
      console.log(`👑 Admin ID: ${process.env.ADMIN_TELEGRAM_ID}`);
    }
    bot.start();
    console.log("✅ Telegram бот запущен");
  } catch (error) {
    console.error("❌ Ошибка запуска бота:", error.message);
  }
}

module.exports = { bot, notifyNewContact, notifyNewReview };
startBot();
