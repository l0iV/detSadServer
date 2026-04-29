const db = require("./db/database");
const events = [
  {
    title: "Черепашки",
    date: "2025-06-20",
    date_label: "20 июня 2025 г.",
    category: "ecology",
    image_url: "/static/events/jerepaxa.jpg",
    description:
      "Группа Буратино провела время на экологической неделе, изучая черепашек 🐢! Черепахи — удивительные существа, о которых можно узнать множество интересного.",
  },
  {
    title: "День бабочек",
    date: "2025-06-19",
    date_label: "19 июня 2025 г.",
    category: "art",
    image_url: "/static/events/babojki.jpg",
    description:
      "🦋 В нашем детском саду прошёл «День бабочек». Ребята сами лепили и украшали бабочек из пластилина и цветной бумаги — каждая получилась уникальной!",
  },
  {
    title: "Международный день чая",
    date: "2025-06-19",
    date_label: "19 июня 2025 г.",
    category: "other",
    image_url: "/static/events/tea.jpg",
    description:
      "В городском филиале библиотеки №3 прошёл тематический день чая. Дети узнали об истории чайных традиций разных народов мира.",
  },
  {
    title: "Акция «Макулатура»",
    date: "2025-06-18",
    date_label: "18 июня 2025 г.",
    category: "ecology",
    image_url: "/static/events/paper.jpg",
    description:
      "В рамках экологической недели 🌳 была сдана макулатура — значимый шаг к сохранению природы. Спасибо всем участникам!",
  },
  {
    title: "Лекарственные растения",
    date: "2025-06-17",
    date_label: "17 июня 2025 г.",
    category: "ecology",
    image_url: "/static/events/flowers.jpg",
    description:
      "День лекарственных растений в рамках экологической недели. Цель — расширение представлений детей о целебных свойствах трав.",
  },
  {
    title: "Птичка-невеличка",
    date: "2025-06-16",
    date_label: "16 июня 2025 г.",
    category: "art",
    image_url: "/static/events/bird.jpg",
    description:
      "Дети подготовительной группы создавали птиц в смешанной технике: восковой мелок + акварель. Результат получился живым и красочным!",
  },
  {
    title: "Совушка",
    date: "2025-06-09",
    date_label: "9 июня 2025 г.",
    category: "art",
    image_url: "/static/events/sova.jpg",
    description:
      "Нетрадиционная техника рисования «Совушка» — отпечаток марлей и ватной палочкой с элементами аппликации.",
  },
  {
    title: "День России в парке «Химик»",
    date: "2025-06-12",
    date_label: "12 июня 2025 г.",
    category: "holiday",
    image_url: "/static/events/day_russia.jpg",
    description:
      "Педагоги приняли участие в праздновании Дня России. Такие события воспитывают патриотизм и укрепляют связь сада с родителями.",
  },
];

// Очищаем таблицу перед заполнением (чтобы не дублировать)
db.prepare("DELETE FROM events").run();
db.prepare("DELETE FROM sqlite_sequence WHERE name='events'").run();

const insert = db.prepare(`
  INSERT INTO events (title, date, date_label, category, image_url, description)
  VALUES (@title, @date, @date_label, @category, @image_url, @description)
`);

// Вставляем все события одной транзакцией (быстро и безопасно)
const insertAll = db.transaction((items) => {
  for (const item of items) insert.run(item);
});

insertAll(events);

console.log(`✅ Залито ${events.length} событий в БД`);
