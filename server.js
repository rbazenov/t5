const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'docs');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PDF_PATH = path.join(ROOT_DIR, 'Ford_Fiesta_Fusion_TR_Carinfo.com.ua_compressed.pdf');
const CACHE_DIR = '/tmp/ford_pdf_page_cache';
const UPLOADED_BOOKS_DIR = '/tmp/uploaded_books';

fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(UPLOADED_BOOKS_DIR, { recursive: true });

const PYTHON_CANDIDATES = [
  path.join(ROOT_DIR, '.venv', 'bin', 'python'),
  '/tmp/pdfvenv/bin/python',
  'python3'
];
const PYTHON_BIN = PYTHON_CANDIDATES.find((p) => p === 'python3' || fs.existsSync(p)) || 'python3';

// Load prebuilt JSON datasets into memory for sub-millisecond responses
const guides = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'guides.json'), 'utf8'));
const manualIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manual_index.json'), 'utf8'));
const pagesText = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pages_text.json'), 'utf8'));

const CATALOG = [
  {
    id: 'ford-fiesta-fusion',
    category: 'cars',
    categoryLabel: 'Легковые автомобили',
    brand: 'Ford',
    model: 'Fiesta Mk5 / Fusion (2001–2010)',
    engines: 'Duratec 1.3 / 1.4 / 1.6 • Duratec-HE 2.0 ST',
    transmissions: 'МКПП Durashift • Робот EST • АКПП AW81-40-LE',
    pagesCount: 385,
    operationsCount: 449,
    videosReady: 4,
    diagramsCount: 62,
    dtcCount: 187,
    status: 'active',
    statusLabel: 'Оцифровано • 4 видео с озвучкой',
    coverUrl: '/media/cover.jpg',
    description: 'Полное иллюстрированное руководство ИД «Третий Рим» (385 стр.): пошаговые операции с моментами затяжки, 62 цветные электросхемы, 187 кодов OBD-II и готовые озвученные видеогиды.'
  },
  {
    id: 'xcmg-xe215c',
    category: 'heavy',
    categoryLabel: 'Спецтехника (экскаваторы)',
    brand: 'XCMG',
    model: 'XE215C / XE215DA Гусеничный экскаватор',
    engines: 'Isuzu BB-6BG1TRP (6 цил., турбодизель) • Гидравлика Kawasaki K3V112',
    transmissions: 'Гидроход 2-скоростной • Поворотный редуктор',
    pagesCount: 940,
    operationsCount: 312,
    videosReady: 0,
    diagramsCount: 48,
    dtcCount: 240,
    status: 'pipeline',
    statusLabel: 'B2B-демо • Автоперевод CN/EN → RU',
    coverUrl: null,
    accent: '#f59e0b',
    sampleTopics: [
      'Регулировка давления главного гидронасоса Kawasaki K3V112',
      'Замена фильтров гидробака и развоздушивание гидросистемы',
      'Калибровка пропорционального соленоида и диагностика ошибок монитора'
    ],
    description: 'Пример высокомаржинального B2B-кейса: перевод англо-/китайскоязычного сервисного мануала спецтехники с генерацией голосовых видеоинструкций для выездных бригад в поле.'
  },
  {
    id: 'jcb-3cx-super',
    category: 'heavy',
    categoryLabel: 'Спецтехника (экскаваторы-погрузчики)',
    brand: 'JCB',
    model: '3CX / 4CX Super (Dieselmax 4.4)',
    engines: 'JCB Dieselmax 444 (68–74 кВт)',
    transmissions: 'JCB Synchroshuttle / Powershift 4WD',
    pagesCount: 1280,
    operationsCount: 520,
    videosReady: 0,
    diagramsCount: 74,
    dtcCount: 310,
    status: 'pipeline',
    statusLabel: 'B2B-демо • Сервисный пакет парка',
    coverUrl: null,
    accent: '#eab308',
    sampleTopics: [
      'Переборка моста JCB Max-Trac и мокрых многодисковых тормозов',
      'Проверка давления подпитки КПП Powershift и соленоидов реверса',
      'Замена уплотнений гидроцилиндра рукояти и стрелы'
    ],
    description: 'Пошаговые видеокарты для ремонтных баз строительной техники: сокращают время поиска моментов затяжки и гидравлических портов контрольного замера давления.'
  },
  {
    id: 'kamaz-54901-k5',
    category: 'trucks',
    categoryLabel: 'Грузовые и коммерческие',
    brand: 'КАМАЗ',
    model: '54901 (Поколение К5)',
    engines: 'КАМАЗ-910.12-450 (Р6, 11.9 л, Common Rail)',
    transmissions: 'АМТ ZF TraXon 12TX2210 TD',
    pagesCount: 1150,
    operationsCount: 410,
    videosReady: 0,
    diagramsCount: 95,
    dtcCount: 490,
    status: 'pipeline',
    statusLabel: 'B2B-демо • Автопарки и СТО',
    coverUrl: null,
    accent: '#38bdf8',
    sampleTopics: [
      'Регулировка тепловых зазоров клапанов и моторного тормоза Р6 910',
      'Диагностика пневмоконтуров EBS Wabco и энергоаккумуляторов',
      'Адаптация сцепления роботизированной КПП ZF TraXon'
    ],
    description: 'Корпоративная база знаний для грузовых автопарков: быстрый поиск по кодам ошибок CAN J1939, пневмосхемам и регламентным картам ТО.'
  },
  {
    id: 'mtz-belarus-82',
    category: 'agri',
    categoryLabel: 'Сельхозтехника (тракторы и комбайны)',
    brand: 'МТЗ / John Deere',
    model: 'Беларус 82.1 / 1221.2 • John Deere 6B',
    engines: 'Д-243 / Д-260 (ММЗ) • PowerTech 4.5L',
    transmissions: 'Механическая 18/4 с редуктором • ВОМ 540/1000',
    pagesCount: 620,
    operationsCount: 235,
    videosReady: 0,
    diagramsCount: 28,
    dtcCount: 95,
    status: 'pipeline',
    statusLabel: 'B2B-демо • Агрохолдинги (офлайн-режим)',
    coverUrl: null,
    accent: '#22c55e',
    sampleTopics: [
      'Регулировка тормозных лент планетарного механизма ВОМ',
      'Настройка силового и позиционного регулятора задней гидронавески',
      'Проверка угла опережения впрыска топлива ТНВД в полевых условиях'
    ],
    description: 'Офлайн-пакеты с озвучкой для механизаторов и полевых инженеров агрохолдингов, где нет стабильного мобильного интернета во время посевной и уборки.'
  }
];

// Preview-friendly headers (allow any host/origin & iframe embedding)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Compress JSON/HTML/CSS/JS while keeping media range streaming untouched
app.use(compression({
  filter: (req, res) => {
    if (req.path.startsWith('/media/')) return false;
    return compression.filter(req, res);
  }
}));

app.use(express.json());

// Static files (express.static natively supports Accept-Ranges: bytes & 206 Partial Content for MP4/MP3!)
app.use(express.static(PUBLIC_DIR, {
  acceptRanges: true,
  maxAge: '1h',
  etag: true
}));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, pagesIndexed: pagesText.length, guidesCount: guides.length });
});

app.get('/api/catalog', (req, res) => {
  res.json({ items: CATALOG });
});

app.get('/api/guides', (req, res) => {
  res.json({ guides });
});

app.get('/api/guides/:slug', (req, res) => {
  const g = guides.find((item) => item.slug === req.params.slug);
  if (!g) return res.status(404).json({ error: 'Видеогид не найден' });
  res.json(g);
});

app.get('/api/manual', (req, res) => {
  res.json(manualIndex);
});

app.get('/api/page/:pdfPage/text', (req, res) => {
  const p = parseInt(req.params.pdfPage, 10);
  if (Number.isNaN(p) || p < 1 || p > pagesText.length) {
    return res.status(404).json({ error: 'Страница вне диапазона 1..385' });
  }
  res.json(pagesText[p - 1]);
});

app.get('/api/page/:pdfPage/image', (req, res) => {
  const p = parseInt(req.params.pdfPage, 10);
  const dpi = Math.min(240, Math.max(90, parseInt(req.query.dpi || '150', 10)));
  if (Number.isNaN(p) || p < 1 || p > pagesText.length) {
    return res.status(404).json({ error: 'Страница вне диапазона 1..385' });
  }
  const cachedFile = path.join(CACHE_DIR, `p_${p}_dpi_${dpi}.png`);
  if (fs.existsSync(cachedFile)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(cachedFile).pipe(res);
  }

  execFile(
    PYTHON_BIN,
    [path.join(ROOT_DIR, 'scripts', 'render_page.py'), PDF_PATH, String(p), String(dpi), cachedFile],
    { timeout: 15000 },
    (err) => {
      if (err || !fs.existsSync(cachedFile)) {
        return res.status(500).json({ error: 'Не удалось отрендерить страницу PDF' });
      }
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(cachedFile).pipe(res);
    }
  );
});

app.get('/api/search', (req, res) => {
  const rawQ = String(req.query.q || '').trim();
  if (!rawQ) {
    return res.json({ query: '', guides: [], toc: [], dtc: [], diagrams: [], pages: [] });
  }
  const q = rawQ.toLowerCase();
  const terms = q.split(/\s+/).filter((t) => t.length >= 2);

  const matchAll = (str) => {
    const s = String(str || '').toLowerCase();
    if (s.includes(q)) return true;
    return terms.length > 0 && terms.every((t) => s.includes(t));
  };

  // 1. Video guides
  const matchedGuides = guides.filter((g) =>
    matchAll(`${g.title} ${g.section} ${g.tools.join(' ')} ${g.consumables.join(' ')}`)
  ).map((g) => ({
    slug: g.slug,
    title: g.title,
    bookPages: g.bookPages,
    workTime: g.workTime,
    totalDuration: g.totalDuration
  }));

  // 2. TOC subsections
  const matchedToc = [];
  for (const sec of manualIndex.sections) {
    for (const item of sec.items) {
      if (matchAll(item.title)) {
        matchedToc.push({
          section: sec.title,
          title: item.title,
          bookPage: item.bookPage,
          pdfPage: item.pdfPage
        });
      }
    }
  }

  // 3. OBD-II DTC codes (also normalize Russian Р/В/С to Latin P/B/C)
  const cyrNorm = rawQ.toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/В/g, 'B')
    .replace(/С/g, 'C')
    .replace(/О/g, '0');
  const matchedDtc = manualIndex.dtcCodes.filter((d) =>
    d.code.toUpperCase().includes(cyrNorm) || matchAll(`${d.code} ${d.description}`)
  ).slice(0, 20);

  // 4. Wiring diagrams
  const matchedDiagrams = manualIndex.wiringDiagrams.filter((w) =>
    matchAll(`${w.code} ${w.title} ${w.components}`)
  ).slice(0, 15);

  // 5. Full-text search across all 385 PDF pages
  const matchedPages = [];
  for (const pg of pagesText) {
    if (!pg.text) continue;
    const lower = pg.text.toLowerCase();
    let idx = lower.indexOf(q);
    if (idx === -1 && terms.length > 0 && terms.every((t) => lower.includes(t))) {
      idx = lower.indexOf(terms[0]);
    }
    if (idx !== -1) {
      const start = Math.max(0, idx - 85);
      const end = Math.min(pg.text.length, idx + 165);
      const snippet = (start > 0 ? '…' : '') + pg.text.slice(start, end) + (end < pg.text.length ? '…' : '');
      matchedPages.push({
        pdfPage: pg.pdfPage,
        bookPage: pg.bookPage,
        snippet
      });
      if (matchedPages.length >= 30) break;
    }
  }

  res.json({
    query: rawQ,
    guides: matchedGuides,
    toc: matchedToc.slice(0, 25),
    dtc: matchedDtc,
    diagrams: matchedDiagrams,
    pages: matchedPages
  });
});

app.post('/api/books/upload', express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '150mb' }), (req, res) => {
  const rawName = String(req.query.name || 'manual.pdf').replace(/[^a-zA-Z0-9._\u0400-\u04FF-]/g, '_');
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 100) {
    return res.status(400).json({ error: 'Пустой или некорректный PDF-файл' });
  }
  const savedName = `${Date.now()}_${rawName}`;
  const outPath = path.join(UPLOADED_BOOKS_DIR, savedName);
  fs.writeFileSync(outPath, buf);
  res.json({ ok: true, savedName, bytes: buf.length });
});

app.listen(PORT, HOST, () => {
  console.log(`ManualVideo PRO server listening on http://${HOST}:${PORT}`);
});
