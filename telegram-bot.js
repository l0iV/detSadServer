// telegram-bot.js — Бот управления сайтом детского сада
const { Bot } = require("grammy");
const db = require("./db/database");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Настройка прокси (MTProto через SOCKS5)
let botOptions = {};
if (process.env.PROXY_URL) {
  try {
    const { ProxyAgent } = require("proxy-agent");
    const agent = new ProxyAgent(process.env.PROXY_URL);
    botOptions = { client: { baseFetchConfig: { agent } } };
    console.log(`🛡️ Используется прокси: ${process.env.PROXY_URL}`);
  } catch (e) {
    console.log("⚠️ proxy-agent не установлен, прокси отключен");
  }
}

// Создаем бота
const bot = new Bot(process.env.BOT_TOKEN, botOptions);

// Пытаемся использовать альтернативный URL для обхода блокировок
try {
  if (typeof bot.api.config.set === "function") {
    bot.api.config.set("api-root", "https://telegg.ornithopter.org");
    console.log("🌐 Используется альтернативный API URL");
  }
} catch (e) {
  console.log("⚠️ Используется стандартный API URL");
}

// ── Проверка администратора ────────────────────────────────
const isAdmin = (ctx) => {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  return ctx.from && ctx.from.id.toString() === adminId;
};

const requireAdmin = async (ctx, next) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("⛔ Доступ запрещён");
    return;
  }
  await next();
};

// ── Форматирование даты ────────────────────────────────────
const formatDateLabel = (dateStr) => {
  const months = [
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
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year} г.`;
};

const validCategories = [
  "ecology",
  "art",
  "holiday",
  "sport",
  "health",
  "other",
];
const categoryEmoji = {
  ecology: "🌿",
  art: "🎨",
  holiday: "🎉",
  sport: "⚽",
  health: "💊",
  other: "📌",
};

// ── Обработчик ошибок бота ─────────────────────────────────
bot.catch = (err) => {
  console.error("❌ Ошибка в боте:", err.message);
};

// ── /start ─────────────────────────────────────────────────
bot.command("start", requireAdmin, async (ctx) => {
  await ctx.reply(
    `🏫 *Бот управления сайтом детского сада*\n\n` +
      `*📅 МЕРОПРИЯТИЯ*\n` +
      `\`/addevent Название | Описание | категория | ГГГГ-ММ-ДД\`\n` +
      `\`/list\` — последние 10 мероприятий\n` +
      `\`/delete ID\` — удалить мероприятие\n` +
      `\`/cats\` — статистика по категориям\n\n` +
      `*🖼️ Картинки к мероприятию*\n` +
      `Отправь фото с подписью: \`/img ID\`\n\n` +
      `*👩‍🏫 ПЕДАГОГИ*\n` +
      `\`/addteacher Имя | Должность | Стаж | Образование | Группа | Телефон\`\n` +
      `\`/teachers\` — список педагогов\n` +
      `\`/delteacher ID\` — удалить педагога\n\n` +
      `*⭐ ОТЗЫВЫ*\n` +
      `\`/reviews\` — отзывы на модерации\n` +
      `\`/approve ID\` — одобрить отзыв\n` +
      `\`/delreview ID\` — отклонить отзыв\n\n` +
      `*📬 ЗАЯВКИ*\n` +
      `\`/contacts\` — последние заявки с сайта\n\n` +
      `*Категории мероприятий:*\n` +
      `ecology 🌿 | art 🎨 | holiday 🎉 | sport ⚽ | health 💊 | other 📌`,
    { parse_mode: "Markdown" },
  );
});

// ── /help ──────────────────────────────────────────────────
bot.command("help", requireAdmin, async (ctx) => {
  await ctx.reply(
    `📋 *Команды бота*\n\n` +
      `/start — главное меню\n` +
      `/addevent — добавить мероприятие\n` +
      `/list — список мероприятий\n` +
      `/delete ID — удалить мероприятие\n` +
      `/cats — статистика категорий\n` +
      `/addteacher — добавить педагога\n` +
      `/teachers — список педагогов\n` +
      `/delteacher ID — удалить педагога\n` +
      `/reviews — отзывы на проверке\n` +
      `/approve ID — одобрить отзыв\n` +
      `/delreview ID — удалить отзыв\n` +
      `/contacts — заявки с сайта`,
    { parse_mode: "Markdown" },
  );
});

// ══════════════════════════════════════════════════════════
//  МЕРОПРИЯТИЯ
// ══════════════════════════════════════════════════════════

// /addevent
bot.command("addevent", requireAdmin, async (ctx) => {
  const text = ctx.message.text.replace("/addevent", "").trim();
  const parts = text.split("|").map((p) => p.trim());

  if (parts.length < 4 || parts.some((p, i) => i < 4 && !p)) {
    return ctx.reply(
      `❌ *Неверный формат*\n\n` +
        `Правильно:\n` +
        `\`/addevent Название | Описание | категория | 2026-05-15\`\n\n` +
        `Категории: ${validCategories.join(", ")}`,
      { parse_mode: "Markdown" },
    );
  }

  const [title, description, category, date] = parts;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return ctx.reply(
      "❌ Неверный формат даты. Нужно: ГГГГ-ММ-ДД (пример: 2026-05-15)",
    );
  }

  if (!validCategories.includes(category)) {
    return ctx.reply(
      `❌ Неверная категория.\nДоступные: ${validCategories.join(", ")}`,
    );
  }

  try {
    const date_label = formatDateLabel(date);
    const result = db
      .prepare(
        `INSERT INTO events (title, description, category, date, date_label)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(title, description, category, date, date_label);

    const id = result.lastInsertRowid;
    const emoji = categoryEmoji[category];

    await ctx.reply(
      `✅ *Мероприятие добавлено!*\n\n` +
        `🆔 *ID:* ${id}\n` +
        `📌 *Название:* ${title}\n` +
        `📅 *Дата:* ${date_label}\n` +
        `🏷️ *Категория:* ${emoji} ${category}\n\n` +
        `🖼️ Чтобы добавить картинку:\n` +
        `Отправь фото с подписью \`/img ${id}\``,
      { parse_mode: "Markdown" },
    );
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Ошибка при добавлении мероприятия");
  }
});

// /list
bot.command("list", requireAdmin, async (ctx) => {
  const events = db
    .prepare(
      `SELECT id, title, date_label, category, image_url
       FROM events ORDER BY date DESC LIMIT 10`,
    )
    .all();

  if (events.length === 0) {
    return ctx.reply("📭 Пока нет ни одного мероприятия");
  }

  let message = "📋 *Последние мероприятия:*\n\n";
  events.forEach((e) => {
    const img = e.image_url ? "🖼️" : "📝";
    const emoji = categoryEmoji[e.category] || "📌";
    message += `*${e.id}.* ${img} ${e.title}\n`;
    message += `   📅 ${e.date_label} | ${emoji} ${e.category}\n\n`;
  });
  message += "❌ Удалить: `/delete ID`\n";
  message += "🖼️ Фото: отправь фото с `/img ID`";

  await ctx.reply(message, { parse_mode: "Markdown" });
});

// /delete
bot.command("delete", requireAdmin, async (ctx) => {
  const id = parseInt(ctx.message.text.replace("/delete", "").trim());

  if (isNaN(id)) {
    return ctx.reply("❌ Укажи ID: `/delete 5`", { parse_mode: "Markdown" });
  }

  const event = db
    .prepare("SELECT image_url, title FROM events WHERE id = ?")
    .get(id);
  if (!event) {
    return ctx.reply(`❌ Мероприятие #${id} не найдено`);
  }

  if (event.image_url) {
    const filepath = path.join(
      __dirname,
      "public",
      event.image_url.replace("/static/", ""),
    );
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }

  db.prepare("DELETE FROM events WHERE id = ?").run(id);
  await ctx.reply(`✅ Мероприятие *#${id} «${event.title}»* удалено`, {
    parse_mode: "Markdown",
  });
});

// /cats
bot.command("cats", requireAdmin, async (ctx) => {
  let message = "*🏷️ Статистика по категориям:*\n\n";
  for (const key of validCategories) {
    const count = db
      .prepare("SELECT COUNT(*) as count FROM events WHERE category = ?")
      .get(key).count;
    const bar =
      "█".repeat(Math.min(count, 10)) +
      "░".repeat(Math.max(0, 10 - Math.min(count, 10)));
    message += `${categoryEmoji[key]} ${key}\n${bar} ${count} событий\n\n`;
  }
  await ctx.reply(message, { parse_mode: "Markdown" });
});

// Обработка фото для мероприятий и педагогов
bot.on("message:photo", requireAdmin, async (ctx) => {
  const caption = ctx.message.caption || "";

  // Для мероприятия
  if (caption.startsWith("/img")) {
    const eventId = parseInt(caption.replace("/img", "").trim());
    if (isNaN(eventId)) {
      return ctx.reply("❌ Укажи ID: отправь фото с подписью `/img 5`");
    }

    const event = db.prepare("SELECT id FROM events WHERE id = ?").get(eventId);
    if (!event) {
      return ctx.reply(`❌ Мероприятие #${eventId} не найдено`);
    }

    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();

      const filename = `event_${eventId}_${Date.now()}.jpg`;
      const relPath = `/static/events/${filename}`;
      const filepath = path.join(__dirname, "public", "events", filename);

      if (!fs.existsSync(path.dirname(filepath))) {
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
      }
      fs.writeFileSync(filepath, Buffer.from(buffer));

      db.prepare("UPDATE events SET image_url = ? WHERE id = ?").run(
        relPath,
        eventId,
      );

      await ctx.reply(`✅ *Картинка добавлена к мероприятию #${eventId}*`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error(error);
      await ctx.reply("❌ Ошибка при загрузке картинки");
    }
  }

  // Для педагога
  if (caption.startsWith("/teacher")) {
    const teacherId = parseInt(caption.replace("/teacher", "").trim());
    if (isNaN(teacherId)) {
      return ctx.reply("❌ Укажи ID: `/teacher 3`");
    }

    const teacher = db
      .prepare("SELECT id FROM teachers WHERE id = ?")
      .get(teacherId);
    if (!teacher) {
      return ctx.reply(`❌ Педагог #${teacherId} не найден`);
    }

    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();

      const filename = `teacher_${teacherId}_${Date.now()}.jpg`;
      const relPath = `/static/teachers/${filename}`;
      const filepath = path.join(__dirname, "public", "teachers", filename);

      if (!fs.existsSync(path.dirname(filepath))) {
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
      }
      fs.writeFileSync(filepath, Buffer.from(buffer));

      db.prepare("UPDATE teachers SET image_url = ? WHERE id = ?").run(
        relPath,
        teacherId,
      );

      await ctx.reply(`✅ *Фото педагога #${teacherId} обновлено*`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error(error);
      await ctx.reply("❌ Ошибка при загрузке фото");
    }
  }
});

// ══════════════════════════════════════════════════════════
//  ПЕДАГОГИ
// ══════════════════════════════════════════════════════════

// /addteacher
bot.command("addteacher", requireAdmin, async (ctx) => {
  const text = ctx.message.text.replace("/addteacher", "").trim();
  const parts = text.split("|").map((p) => p.trim());

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return ctx.reply(
      `❌ *Неверный формат*\n\n` +
        `Обязательно имя и должность:\n` +
        `\`/addteacher Имя | Должность | Стаж | Образование | Группа | Телефон\``,
      { parse_mode: "Markdown" },
    );
  }

  const [name, position, experience, education, group_name, phone] = parts;

  try {
    const result = db
      .prepare(
        `INSERT INTO teachers (name, position, experience, education, group_name, phone)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        name,
        position,
        experience || null,
        education || null,
        group_name || null,
        phone || null,
      );

    await ctx.reply(
      `✅ *Педагог добавлен!*\n\n🆔 ID: ${result.lastInsertRowid}\n👩‍🏫 ${name}\n💼 ${position}` +
        `\n\n🖼️ Отправь фото с подписью \`/teacher ${result.lastInsertRowid}\``,
      { parse_mode: "Markdown" },
    );
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Ошибка при добавлении педагога");
  }
});

// /teachers
bot.command("teachers", requireAdmin, async (ctx) => {
  const teachers = db
    .prepare("SELECT id, name, position, group_name FROM teachers ORDER BY id")
    .all();

  if (teachers.length === 0) {
    return ctx.reply("📭 Список педагогов пуст");
  }

  let message = "👩‍🏫 *Педагоги:*\n\n";
  teachers.forEach((t) => {
    message += `*${t.id}.* ${t.name}\n   💼 ${t.position}`;
    if (t.group_name) message += ` | 👶 ${t.group_name}`;
    message += "\n\n";
  });
  message += "❌ Удалить: `/delteacher ID`";

  await ctx.reply(message, { parse_mode: "Markdown" });
});

// /delteacher
bot.command("delteacher", requireAdmin, async (ctx) => {
  const id = parseInt(ctx.message.text.replace("/delteacher", "").trim());
  if (isNaN(id)) {
    return ctx.reply("❌ Укажи ID: `/delteacher 3`");
  }

  const teacher = db.prepare("SELECT name FROM teachers WHERE id = ?").get(id);
  if (!teacher) return ctx.reply(`❌ Педагог #${id} не найден`);

  db.prepare("DELETE FROM teachers WHERE id = ?").run(id);
  await ctx.reply(`✅ Педагог *#${id} «${teacher.name}»* удалён`, {
    parse_mode: "Markdown",
  });
});

// ══════════════════════════════════════════════════════════
//  ОТЗЫВЫ
// ══════════════════════════════════════════════════════════

// /reviews
bot.command("reviews", requireAdmin, async (ctx) => {
  try {
    const reviews = db
      .prepare(
        `SELECT id, author, text, rating, created_at FROM reviews WHERE approved = 0 ORDER BY created_at DESC LIMIT 10`,
      )
      .all();

    if (reviews.length === 0) {
      return ctx.reply("✅ Нет отзывов, ожидающих проверки");
    }

    let message = `📬 *Отзывы на проверке (${reviews.length}):*\n\n`;
    reviews.forEach((r) => {
      const stars = "⭐".repeat(r.rating || 5);
      const date = r.created_at ? r.created_at.slice(0, 10) : "";
      message += `*#${r.id}* — ${r.author} ${stars} (${date})\n`;
      message += `«${r.text.slice(0, 200)}${r.text.length > 200 ? "..." : ""}»\n\n`;
    });
    message += `✅ Одобрить: \`/approve ID\`\n❌ Удалить: \`/delreview ID\``;

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Ошибка при получении отзывов");
  }
});

// /approve
bot.command("approve", requireAdmin, async (ctx) => {
  const id = parseInt(ctx.message.text.replace("/approve", "").trim());
  if (isNaN(id)) return ctx.reply("❌ Укажи ID: `/approve 3`");

  try {
    const review = db
      .prepare("SELECT author FROM reviews WHERE id = ?")
      .get(id);
    if (!review) return ctx.reply(`❌ Отзыв #${id} не найден`);

    db.prepare("UPDATE reviews SET approved = 1 WHERE id = ?").run(id);
    await ctx.reply(`✅ Отзыв #${id} от ${review.author} одобрен`, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Ошибка при одобрении");
  }
});

// /delreview
bot.command("delreview", requireAdmin, async (ctx) => {
  const id = parseInt(ctx.message.text.replace("/delreview", "").trim());
  if (isNaN(id)) return ctx.reply("❌ Укажи ID: `/delreview 3`");

  try {
    const review = db
      .prepare("SELECT author FROM reviews WHERE id = ?")
      .get(id);
    if (!review) return ctx.reply(`❌ Отзыв #${id} не найден`);

    db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
    await ctx.reply(`✅ Отзыв #${id} удалён`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Ошибка при удалении");
  }
});

// ══════════════════════════════════════════════════════════
//  ЗАЯВКИ
// ══════════════════════════════════════════════════════════

// /contacts
bot.command("contacts", requireAdmin, async (ctx) => {
  try {
    const contacts = db
      .prepare(
        "SELECT id, name, phone, message, created_at FROM contacts ORDER BY created_at DESC LIMIT 10",
      )
      .all();

    if (contacts.length === 0) {
      return ctx.reply("📭 Пока нет заявок с сайта");
    }

    let message = `📬 *Последние заявки (${contacts.length}):*\n\n`;
    contacts.forEach((c) => {
      const date = c.created_at
        ? c.created_at.slice(0, 16).replace("T", " ")
        : "";
      message += `*#${c.id}* — ${date}\n👤 ${c.name} | 📞 ${c.phone}\n💬 ${c.message.slice(0, 100)}...\n\n`;
    });

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Ошибка при получении заявок");
  }
});

// ── Награды (wins) ──────────────────────────────────

// /addreward
bot.command("addreward", requireAdmin, async (ctx) => {
  const parts = ctx.message.text
    .replace("/addreward", "")
    .trim()
    .split("|")
    .map((p) => p.trim());
  if (parts.length < 3) {
    return ctx.reply(
      "❌ Формат: /addreward Описание | Дата | /static/wins/имя_файла.jpg",
    );
  }
  const [description, date, imageUrl] = parts;
  try {
    db.prepare(
      "INSERT INTO wins (description, date, image_url) VALUES (?, ?, ?)",
    ).run(description, date, imageUrl);
    await ctx.reply("✅ Награда добавлена");
  } catch (e) {
    console.error(e);
    await ctx.reply("❌ Ошибка при добавлении награды");
  }
});

// /changeteacher
bot.command("changeteacher", requireAdmin, async (ctx) => {
  const raw = ctx.message.text.replace("/changeteacher", "").trim();
  const [idPart, ...kvParts] = raw.split("|").map((p) => p.trim());
  const id = parseInt(idPart);
  if (isNaN(id) || kvParts.length === 0) {
    return ctx.reply(
      "❌ Формат: /changeteacher ID | поле=значение, поле=значение …",
    );
  }
  const updates = kvParts
    .join("|")
    .split(",")
    .map((s) => s.trim());
  const setClauses = updates
    .map((u) => {
      const [field, val] = u.split("=").map((v) => v.trim());
      return `${field} = ?`;
    })
    .join(", ");
  const values = updates.map((u) => u.split("=")[1].trim());

  try {
    db.prepare(`UPDATE teachers SET ${setClauses} WHERE id = ?`).run(
      ...values,
      id,
    );
    await ctx.reply(`✅ Преподаватель #${id} обновлён`);
  } catch (e) {
    console.error(e);
    await ctx.reply("❌ Ошибка при обновлении преподавателя");
  }
});

// ── Награды (wins) ──────────────────────────────

// /listwins
bot.command("listwins", requireAdmin, async (ctx) => {
  const wins = db.prepare("SELECT * FROM wins ORDER BY id").all();
  if (wins.length === 0) return ctx.reply("📭 Нет наград");
  let msg = "*Награды:*\n";
  wins.forEach((w) => {
    msg += `${w.id}. ${w.description.slice(0, 30)}... (${w.date})\n`;
  });
  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// /deletewins
bot.command("deletewins", requireAdmin, async (ctx) => {
  const id = parseInt(ctx.message.text.replace("/deletewins", "").trim());
  if (isNaN(id)) return ctx.reply("❌ Укажи ID: /deletewins 3");
  db.prepare("DELETE FROM wins WHERE id = ?").run(id);
  await ctx.reply(`✅ Награда #${id} удалена`);
});

// ── Новости (news) ──────────────────────────────

// /addnews
bot.command("addnews", requireAdmin, async (ctx) => {
  const parts = ctx.message.text
    .replace("/addnews", "")
    .trim()
    .split("|")
    .map((p) => p.trim());
  if (parts.length < 2) {
    return ctx.reply("❌ Формат: /addnews Текст | /static/rooms/имя.jpg");
  }
  const [text, imageUrl] = parts;
  try {
    db.prepare("INSERT INTO news (text, image_url) VALUES (?, ?)").run(
      text,
      imageUrl,
    );
    await ctx.reply("✅ Новость добавлена");
  } catch (e) {
    console.error(e);
    await ctx.reply("❌ Ошибка при добавлении новости");
  }
});

// /listnews
bot.command("listnews", requireAdmin, async (ctx) => {
  const news = db.prepare("SELECT * FROM news ORDER BY id").all();
  if (news.length === 0) return ctx.reply("📭 Нет новостей");
  let msg = "*Новости:*\n";
  news.forEach((n) => {
    msg += `${n.id}. ${n.text.slice(0, 30)}...\n`;
  });
  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// /deletenews
bot.command("deletenews", requireAdmin, async (ctx) => {
  const id = parseInt(ctx.message.text.replace("/deletenews", "").trim());
  if (isNaN(id)) return ctx.reply("❌ Укажи ID: /deletenews 2");
  db.prepare("DELETE FROM news WHERE id = ?").run(id);
  await ctx.reply(`✅ Новость #${id} удалена`);
});

// ── Контакты (contacts) ──────────────────────────────

// /deletecontact
bot.command("deletecontact", requireAdmin, async (ctx) => {
  const id = parseInt(ctx.message.text.replace("/deletecontact", "").trim());
  if (isNaN(id)) return ctx.reply("❌ Укажи ID: /deletecontact 5");
  db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
  await ctx.reply(`✅ Заявка #${id} удалена`);
});

// ── Уведомления ────────────────────────────────────────────
const notifyNewContact = async (name, phone, message) => {
  if (!process.env.CHAT_ID) return;
  try {
    await bot.api.sendMessage(
      process.env.CHAT_ID,
      `📬 *Новая заявка!*\n\n👤 ${name}\n📞 ${phone}\n💬 ${message}`,
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
      `⭐ *Новый отзыв!*\n\n👤 ${author}\n«${text.slice(0, 300)}»\n\n✅ /approve ${id}\n❌ /delreview ${id}`,
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    console.error("Telegram notify error:", err.message);
  }
};

// ── Запуск бота ────────────────────────────────────────────
async function startBot() {
  try {
    if (!process.env.BOT_TOKEN) {
      console.error("❌ BOT_TOKEN не задан");
      return;
    }

    const botInfo = await bot.api.getMe();
    console.log(`✅ Бот @${botInfo.username} запущен`);
    if (process.env.ADMIN_TELEGRAM_ID) {
      console.log(`👑 Admin ID: ${process.env.ADMIN_TELEGRAM_ID}`);
    }
    bot.start();
  } catch (error) {
    console.error("❌ Ошибка запуска бота:", error.message);
    console.log("💡 Возможные решения:");
    console.log("   1. Проверьте BOT_TOKEN в .env файле");
    console.log("   2. Напишите @BotFather и создайте новый токен");
    console.log("   3. Убедитесь что интернет работает");
  }
}

startBot();

module.exports = { bot, notifyNewContact, notifyNewReview };
