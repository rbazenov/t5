(function () {
  'use strict';

  /* Configure PDF.js worker */
  function ensurePdfJsReady() {
    if (!window.pdfjsLib) {
      throw new Error('Библиотека PDF.js не загружена');
    }
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.js';
    }
    return window.pdfjsLib;
  }

  /* =========================================================================
   * 1. IndexedDB Storage for Uploaded Books (Metadata + Raw PDF Blob)
   * ========================================================================= */
  const DB_NAME = 'ManualVideoProDB';
  const DB_VERSION = 1;
  const STORE_META = 'books_meta';
  const STORE_BLOBS = 'books_blobs';

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        return reject(new Error('IndexedDB недоступна в этом браузере'));
      }
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Ошибка открытия IndexedDB'));
    });
  }

  const BookStorage = {
    async saveBook(bookRecord, pdfBlob) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
        tx.objectStore(STORE_META).put(bookRecord);
        if (pdfBlob) {
          tx.objectStore(STORE_BLOBS).put({ id: bookRecord.id, blob: pdfBlob });
        }
        tx.oncomplete = () => {
          db.close();
          resolve(bookRecord);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('Не удалось сохранить книгу в IndexedDB'));
        };
      });
    },

    async listBooks() {
      try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_META, 'readonly');
          const req = tx.objectStore(STORE_META).getAll();
          req.onsuccess = () => {
            db.close();
            const items = req.result || [];
            items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            resolve(items);
          };
          req.onerror = () => {
            db.close();
            reject(req.error);
          };
        });
      } catch (_) {
        return [];
      }
    },

    async getBookPdfBlob(bookId) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, 'readonly');
        const req = tx.objectStore(STORE_BLOBS).get(bookId);
        req.onsuccess = () => {
          db.close();
          resolve(req.result ? req.result.blob : null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      });
    },

    async deleteBook(bookId) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
        tx.objectStore(STORE_META).delete(bookId);
        tx.objectStore(STORE_BLOBS).delete(bookId);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    }
  };

  /* =========================================================================
   * 2. Speech Synthesis Engine (Russian Voiceover for Uploaded Books)
   * ========================================================================= */
  const SpeechEngine = {
    voices: [],
    preferredVoiceURI: '',

    init() {
      if (!window.speechSynthesis) return;
      const load = () => {
        this.voices = window.speechSynthesis.getVoices() || [];
      };
      load();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = load;
      }
    },

    getRussianVoices() {
      if (!window.speechSynthesis) return [];
      const all = window.speechSynthesis.getVoices() || [];
      const ru = all.filter((v) => /^ru(-|_|$)/i.test(v.lang) || /russian|русск/i.test(v.name));
      return ru.length ? ru : all.slice(0, 8);
    },

    pickVoice() {
      const list = this.getRussianVoices();
      if (!list.length) return null;
      if (this.preferredVoiceURI) {
        const chosen = list.find((v) => v.voiceURI === this.preferredVoiceURI);
        if (chosen) return chosen;
      }
      // Prefer natural / neural / Microsoft / Google Russian voices if available
      const ranked = [...list].sort((a, b) => {
        const score = (v) => {
          let s = 0;
          if (/^ru/i.test(v.lang)) s += 10;
          if (/natural|neural|online|google|dmitry|pavel|yuri|milena|svetlana/i.test(v.name)) s += 5;
          return s;
        };
        return score(b) - score(a);
      });
      return ranked[0];
    },

    stop() {
      if (!window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    },

    speak(text, { rate = 1.0, onEnd = null, onError = null } = {}) {
      this.stop();
      if (!window.speechSynthesis || !text) {
        if (onEnd) setTimeout(onEnd, 300);
        return null;
      }
      const utter = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
      utter.lang = 'ru-RU';
      utter.rate = Math.min(1.8, Math.max(0.7, rate || 1.0));
      const voice = this.pickVoice();
      if (voice) utter.voice = voice;
      utter.onend = () => {
        if (onEnd) onEnd();
      };
      utter.onerror = (ev) => {
        if (ev && ev.error === 'interrupted') return;
        if (onError) onError(ev);
        else if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utter);
      return utter;
    }
  };
  SpeechEngine.init();

  function cleanTextForSpeech(raw) {
    return String(raw || '')
      .replace(/Н\s*[·*]\s*м/gi, 'ньютон-метров')
      .replace(/\bНм\b/g, 'ньютон-метров')
      .replace(/\bNm\b/g, 'ньютон-метров')
      .replace(/кгс\s*[·*]\s*м/gi, 'килограмм-сил на метр')
      .replace(/\bмм\b/g, 'миллиметров')
      .replace(/\bсм\b/g, 'сантиметров')
      .replace(/\bтыс\.\s*км/gi, 'тысяч километров')
      .replace(/\bкм\/ч\b/gi, 'километров в час')
      .replace(/\bл\.с\./gi, 'лошадиных сил')
      .replace(/\bоб\/мин\b/gi, 'оборотов в минуту')
      .replace(/\bДВС\b/g, 'двигателя')
      .replace(/\bГБЦ\b/g, 'головки блока цилиндров')
      .replace(/\bКПП\b/g, 'коробки передач')
      .replace(/\bАКБ\b/g, 'аккумулятора')
      .replace(/[•▪►▶◀]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* =========================================================================
   * 3. PDF.js Document Loader, Page Renderer & Smart Repair Guide Extractor
   * ========================================================================= */
  async function openPdfFromBlob(blobOrBuffer) {
    const pdfjsLib = ensurePdfJsReady();
    const arrayBuffer = blobOrBuffer instanceof ArrayBuffer
      ? blobOrBuffer
      : await blobOrBuffer.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: './vendor/pdfjs/cmaps/',
      cMapPacked: true
    });
    return await loadingTask.promise;
  }

  async function renderPageToDataUrl(pdfDoc, pageNum, { scale = 1.4, maxWidth = 1100, quality = 0.85, cropBox = null } = {}) {
    const p = Math.min(pdfDoc.numPages, Math.max(1, pageNum));
    const page = await pdfDoc.getPage(p);
    let viewport = page.getViewport({ scale });
    if (viewport.width > maxWidth) {
      const adj = scale * (maxWidth / viewport.width);
      viewport = page.getViewport({ scale: adj });
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    if (cropBox) {
      const sx = Math.floor(canvas.width * cropBox.x);
      const sy = Math.floor(canvas.height * cropBox.y);
      const sw = Math.max(1, Math.floor(canvas.width * cropBox.w));
      const sh = Math.max(1, Math.floor(canvas.height * cropBox.h));
      const sub = document.createElement('canvas');
      sub.width = sw;
      sub.height = sh;
      sub.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      return sub.toDataURL('image/jpeg', quality);
    }
    return canvas.toDataURL('image/jpeg', quality);
  }

  async function extractStructuredLines(page) {
    const tc = await page.getTextContent();
    const items = tc.items || [];
    if (!items.length) return [];

    // Preserve PDF natural column/block reading order instead of interleaving multi-column y-coordinates
    const rawLines = [];
    let curText = '';
    let prevY = null;
    let prevEndX = null;

    for (const it of items) {
      const s = it.str;
      if (!s || !s.trim()) {
        if (it.hasEOL && curText.trim()) {
          rawLines.push(curText.trim());
          curText = '';
          prevY = null;
          prevEndX = null;
        }
        continue;
      }
      const x = it.transform ? it.transform[4] : 0;
      const y = it.transform ? it.transform[5] : 0;
      const w = it.width || (s.length * 4.8);

      const sameBaseline = prevY !== null && Math.abs(y - prevY) <= 4.2;
      const sameColumnFlow = prevEndX !== null && x >= prevEndX - 12 && (x - prevEndX) < 38;

      if (sameBaseline && sameColumnFlow) {
        const needSpace = curText && !curText.endsWith(' ') && !s.startsWith(' ') && (x - prevEndX) > 1.2;
        curText += (needSpace ? ' ' : '') + s;
      } else {
        if (curText.trim()) {
          rawLines.push(curText.trim());
        }
        curText = s;
      }

      prevY = y;
      prevEndX = x + w;

      if (it.hasEOL && curText.trim()) {
        rawLines.push(curText.trim());
        curText = '';
        prevY = null;
        prevEndX = null;
      }
    }
    if (curText.trim()) {
      rawLines.push(curText.trim());
    }

    // Re-join hyphenated word wraps & merge consecutive short ALL-CAPS heading lines
    const merged = [];
    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i].replace(/\s+/g, ' ').trim();
      if (!line) continue;

      // Join wrapped hyphenated Russian/English words across lines inside the same paragraph
      while (
        line.endsWith('-') &&
        i + 1 < rawLines.length &&
        /^[а-яёa-z]/.test(rawLines[i + 1].trim())
      ) {
        line = line.slice(0, -1) + rawLines[i + 1].trim();
        i++;
      }

      // Join 2-3 line ALL-CAPS section/procedure headings (e.g. "ЗАМЕНА МАСЛА" + "В ДВИГАТЕЛЕ И ФИЛЬТРА")
      const isCalloutBox = (s) => /^(?:ПРЕДУПРЕЖДЕНИ|ВНИМАНИЕ|ПРИМЕЧАНИ|ПОЛЕЗНЫЙ\s*СОВЕТ|WARNING|CAUTION|NOTE)/i.test(s);
      const isCapsHeading = (s) =>
        s.length >= 4 &&
        s.length <= 55 &&
        s === s.toUpperCase() &&
        /[А-ЯЁA-Z]{3}/.test(s) &&
        !/^\d+[.)]/.test(s) &&
        !s.includes('..') &&
        !isCalloutBox(s);

      if (isCapsHeading(line)) {
        let joinedCaps = line;
        let look = 0;
        while (look < 2 && i + 1 < rawLines.length && isCapsHeading(rawLines[i + 1].trim())) {
          joinedCaps += ' ' + rawLines[i + 1].trim();
          i++;
          look++;
        }
        line = joinedCaps.replace(/\s+/g, ' ').trim();
      }

      merged.push(line);
    }

    return merged;
  }

  function guessBookNameFromFilename(filename) {
    const base = String(filename || 'Руководство по ремонту')
      .replace(/\.pdf$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b(compressed|carinfo|com|ua|ru|manual|service|workshop|repair)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return base || 'Новое руководство PDF';
  }

  const REPAIR_HEADING_RE = /^(?:\d+(?:\.\d+)*\.?\s*)?(?:ЗАМЕНА|СНЯТИЕ\s+И\s+УСТАНОВКА|СНЯТИЕ|РАЗБОРКА\s+И\s+СБОРКА|РАЗБОРКА|РЕМОНТ|ПРОВЕРКА\s+И\s+РЕГУЛИРОВКА|ПРОВЕРКА|РЕГУЛИРОВКА|ОБСЛУЖИВАНИЕ|ПРОКАЧКА|ДИАГНОСТИКА|REMOVAL\s+AND\s+INSTALLATION|REPLACEMENT|INSPECTION|ADJUSTMENT|DISASSEMBLY|BLEEDING)\b/i;
  const TOOL_EXTRACT_RE = /(?:Вам потребуются|Необходимый инструмент|Инструмент|Специнструмент|Tools required)\s*[:–-]?\s*([^.!?\n]{5,180})/i;
  const WARN_EXTRACT_RE = /(?:ПРЕДУПРЕЖДЕНИЕ|ПРЕДУПРЕЖДЕНИЯ|ВНИМАНИЕ|ОСТОРОЖНО|WARNING|CAUTION)\s*[!:–-]?\s*([^.!?\n]{10,200}[.!?]?)/i;
  const TORQUE_RE = /(\d{1,3}(?:[.,]\d+)?\s*(?:–|-)\s*\d{1,3}(?:[.,]\d+)?|\d{1,3}(?:[.,]\d+)?)\s*(Н\s*[·*]\s*м|Нм|Nm|кгс\s*[·*]\s*м)/gi;
  const FLUID_RE = /(\d{1,3}(?:[.,]\d+)?)\s*(л|литр[а-я]*|мл)\b/gi;
  const DTC_RE = /\b([PBCUРВСУ][0-3]\d{3})\b[\s:–-]+([А-Яа-яA-Za-z0-9 ,./()-]{10,140})/g;

  async function processUploadedPdf(file, userMeta, onProgress) {
    const report = (pct, msg) => {
      if (onProgress) onProgress(Math.round(pct), msg);
    };

    report(4, `Открытие PDF-файла «${file.name}»…`);
    const arrayBuffer = await file.arrayBuffer();
    const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const pdfDoc = await openPdfFromBlob(arrayBuffer);
    const totalPages = pdfDoc.numPages;

    report(10, `Файл открыт (${totalPages} стр.). Рендеринг обложки…`);
    const coverDataUrl = await renderPageToDataUrl(pdfDoc, 1, { scale: 0.9, maxWidth: 420, quality: 0.84 });

    // Extract text from pages (up to 450 pages upfront to keep browser fast & responsive)
    const maxScanPages = Math.min(totalPages, 450);
    const pagesText = [];
    const pageLinesMap = new Map();

    for (let p = 1; p <= maxScanPages; p++) {
      const page = await pdfDoc.getPage(p);
      const lines = await extractStructuredLines(page);
      pageLinesMap.set(p, lines);
      const joined = lines.join('\n').replace(/-\n/g, '').replace(/\s+/g, ' ').trim();
      pagesText.push({
        pdfPage: p,
        bookPage: p > 1 ? p - 1 : 1,
        text: joined
      });
      if (p % 10 === 0 || p === maxScanPages) {
        report(10 + (p / maxScanPages) * 42, `Чтение текстового слоя: стр. ${p} из ${maxScanPages}…`);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    // Stub remaining pages if > 450 so page navigation works up to totalPages
    for (let p = maxScanPages + 1; p <= totalPages; p++) {
      pagesText.push({ pdfPage: p, bookPage: p - 1, text: '' });
    }

    report(55, 'Анализ оглавления, разделов, электросхем и кодов ошибок…');

    // 1. Try PDF Outline (bookmarks) or dotted TOC lines
    const sections = await extractSectionsFromPdf(pdfDoc, pageLinesMap, totalPages);

    // 2. Detect Wiring / Hydraulic Diagrams
    const wiringDiagrams = [];
    for (const [p, lines] of pageLinesMap.entries()) {
      for (const ln of lines) {
        if (/^(?:Схема|Электросхема|Гидравлическая схема|Пневмосхема|Wiring|Schematic|Circuit)\s*\d*/i.test(ln) && ln.length < 180) {
          const parts = ln.split(/[:.—-]/);
          wiringDiagrams.push({
            code: (parts[0] || `Стр. ${p}`).trim().slice(0, 26),
            title: (parts[1] || ln).trim().slice(0, 90),
            components: lines.slice(0, 8).join(' ').slice(0, 220),
            bookPage: p,
            pdfPage: p
          });
          break;
        }
      }
      if (wiringDiagrams.length >= 60) break;
    }

    // 3. Detect OBD-II / Fault Codes
    const dtcMap = new Map();
    const cyrLat = { 'Р': 'P', 'В': 'B', 'С': 'C', 'У': 'U' };
    for (const pg of pagesText) {
      if (!pg.text) continue;
      let m;
      DTC_RE.lastIndex = 0;
      while ((m = DTC_RE.exec(pg.text)) !== null) {
        const rawCode = m[1].toUpperCase();
        const code = (cyrLat[rawCode[0]] || rawCode[0]) + rawCode.slice(1);
        const desc = m[2].trim();
        if (!dtcMap.has(code) && desc.length >= 8) {
          const cat = code[0];
          dtcMap.set(code, {
            code,
            category: ['P', 'B', 'C', 'U'].includes(cat) ? cat : 'P',
            categoryName: {
              P: 'Силовой агрегат и трансмиссия',
              B: 'Кузов и системы безопасности',
              C: 'Шасси, тормоза и рулевое',
              U: 'Шина CAN и связь модулей'
            }[cat] || 'Диагностика',
            description: desc,
            bookPage: pg.bookPage,
            pdfPage: pg.pdfPage
          });
        }
        if (dtcMap.size >= 200) break;
      }
      if (dtcMap.size >= 200) break;
    }
    const dtcCodes = Array.from(dtcMap.values());

    // 4. Detect Torques & Fluids across the book
    const torques = [];
    const fluids = [];
    for (const [p, lines] of pageLinesMap.entries()) {
      for (const ln of lines) {
        if (torques.length < 35 && /(\d+)\s*(?:Н\s*[·*]\s*м|Нм|Nm|кгс)/i.test(ln) && ln.length > 12 && ln.length < 150) {
          const tm = ln.match(/(\d{1,3}(?:[.,]\d+)?(?:\s*[–-]\s*\d{1,3}(?:[.,]\d+)?)?\s*(?:Н\s*[·*]\s*м|Нм|Nm|кгс\s*[·*]\s*м))/i);
          if (tm) {
            const partName = ln.replace(tm[0], '').replace(/^[—–\-:.\d\s]+|[—–\-:.\s]+$/g, '').trim();
            if (partName.length >= 5) {
              torques.push({
                group: `Стр. ${p}`,
                part: partName.slice(0, 95),
                nm: tm[1].replace(/\s+/g, ' ')
              });
            }
          }
        }
        if (fluids.length < 18 && /(?:масло|жидкость|антифриз|топливн|охлажд|гидробак|картер|oil|coolant|fluid)/i.test(ln) && /\d+(?:[.,]\d+)?\s*л\b/i.test(ln) && ln.length < 160) {
          const fm = ln.match(/(\d{1,3}(?:[.,]\d+)?\s*л)\b/i);
          if (fm) {
            fluids.push({
              node: ln.slice(0, 75),
              volume: fm[1],
              spec: `Стр. ${p} руководства`
            });
          }
        }
      }
    }

    const cleanModel = (userMeta.model || guessBookNameFromFilename(file.name)).trim();
    const cleanBrand = (userMeta.brand || cleanModel.split(' ')[0] || 'Техника').trim();

    report(68, 'Формирование пошаговых видеогидов и сценариев дикторской озвучки…');
    const guides = await buildGuidesFromPdf(
      pdfDoc,
      pageLinesMap,
      totalPages,
      { ...userMeta, brand: cleanBrand, model: cleanModel },
      (subPct, subMsg) => {
        report(68 + subPct * 0.26, subMsg);
      }
    );
    const bookId = 'user-book-' + Date.now().toString(36);
    const category = userMeta.category || 'cars';
    const categoryLabel = {
      cars: 'Легковые автомобили',
      heavy: 'Спецтехника (экскаваторы / погрузчики)',
      trucks: 'Грузовые и коммерческие',
      agri: 'Сельхозтехника'
    }[category] || 'Руководство пользователя';

    const manualIndex = {
      bookMeta: {
        title: `${cleanBrand} ${cleanModel} — Загруженное руководство`,
        publisher: `Файл: ${file.name}`,
        totalPages
      },
      fluids: fluids.length ? fluids : [
        { node: 'Заправочные емкости', volume: `${totalPages} стр.`, spec: 'Используйте поиск (/) по слову «масло» или «объем» для точных таблиц вашей книги' }
      ],
      torques: torques.length ? torques : [
        { group: 'Справочник', part: 'Моменты затяжки доступны на страницах узлов во вкладке «Вся книга»', nm: 'См. PDF' }
      ],
      lamps: [
        { light: 'Спецификация электрооборудования', type: 'По книге', watts: `${totalPages} стр.` }
      ],
      maintenance: guides.slice(0, 6).map((g) => ({
        item: g.title,
        km20: 'По регламенту',
        km40: 'По регламенту',
        km60: 'Контроль / Замена',
        km80: 'По регламенту',
        km100: 'По регламенту',
        km120: 'Контроль / Замена',
        page: g.pdfPages[0]
      })),
      sections,
      wiringDiagrams,
      dtcCodes
    };

    const totalSubsections = sections.reduce((acc, s) => acc + s.items.length, 0);

    const bookRecord = {
      id: bookId,
      isBuiltIn: false,
      createdAt: Date.now(),
      fileName: file.name,
      fileSizeMb: +(file.size / (1024 * 1024)).toFixed(1),
      category,
      categoryLabel,
      brand: cleanBrand,
      model: cleanModel.replace(new RegExp('^' + escapeRegExp(cleanBrand) + '\\s*', 'i'), '') || cleanModel,
      fullTitle: `${cleanBrand} ${cleanModel}`.trim(),
      engines: userMeta.engines || `PDF-руководство (${totalPages} стр.)`,
      pagesCount: totalPages,
      operationsCount: Math.max(totalSubsections, guides.length),
      videosReady: guides.length,
      diagramsCount: wiringDiagrams.length,
      dtcCount: dtcCodes.length,
      status: 'active',
      statusLabel: `Загружено вами • ${guides.length} озвученных гидов`,
      coverUrl: coverDataUrl,
      description: `Загруженный PDF-документ «${file.name}» (${totalPages} стр.): автоматически выделены операции ремонта, иллюстрации страниц, озвучка TTS и полнотекстовый поиск.`,
      guides,
      manual: manualIndex,
      pagesText
    };

    report(96, 'Сохранение книги в локальную базу браузера (IndexedDB)…');
    await BookStorage.saveBook(bookRecord, pdfBlob);

    report(100, 'Готово! Открываем видеогиды новой книги…');
    return { bookRecord, pdfDoc };
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function extractSectionsFromPdf(pdfDoc, pageLinesMap, totalPages) {
    // 1. Try built-in PDF bookmarks (Outline)
    try {
      const outline = await pdfDoc.getOutline();
      if (outline && outline.length >= 2) {
        const outSections = [];
        for (const node of outline.slice(0, 30)) {
          let pNum = 1;
          try {
            if (node.dest) {
              const dest = typeof node.dest === 'string' ? await pdfDoc.getDestination(node.dest) : node.dest;
              if (dest && dest[0]) {
                pNum = (await pdfDoc.getPageIndex(dest[0])) + 1;
              }
            }
          } catch (_) {}
          const subItems = [];
          for (const child of (node.items || []).slice(0, 45)) {
            let cp = pNum;
            try {
              if (child.dest) {
                const cdest = typeof child.dest === 'string' ? await pdfDoc.getDestination(child.dest) : child.dest;
                if (cdest && cdest[0]) {
                  cp = (await pdfDoc.getPageIndex(cdest[0])) + 1;
                }
              }
            } catch (_) {}
            subItems.push({ title: child.title.trim(), bookPage: cp, pdfPage: cp });
          }
          outSections.push({
            title: (node.title || `Раздел`).trim(),
            bookPage: pNum,
            pdfPage: pNum,
            items: subItems
          });
        }
        if (outSections.length) return outSections;
      }
    } catch (_) {}

    // 2. Scan first 15 & last 10 scanned pages for dotted TOC entries ("Название .... 45")
    const tocCandidates = [];
    const checkPages = [];
    for (let i = 1; i <= Math.min(20, pageLinesMap.size); i++) checkPages.push(i);
    for (let i = Math.max(21, pageLinesMap.size - 10); i <= pageLinesMap.size; i++) checkPages.push(i);

    for (const p of checkPages) {
      const lines = pageLinesMap.get(p) || [];
      for (const ln of lines) {
        if (ln.length >= 8 && ln.length <= 180 && (ln.includes('..') || ln.includes('. .') || ln.includes('…'))) {
          const tail = ln.match(/[\s.\u2026·]{3,}(\d{1,4})$/);
          if (tail) {
            const titlePart = ln.slice(0, tail.index).trim();
            if (titlePart.length >= 3 && /^[А-ЯЁA-Z0-9]/.test(titlePart)) {
              const pg = Math.min(totalPages, Math.max(1, parseInt(tail[1], 10)));
              tocCandidates.push({ title: titlePart.slice(0, 95), bookPage: pg, pdfPage: pg });
            }
          }
        }
      }
    }

    if (tocCandidates.length >= 5) {
      const secs = [];
      let cur = { title: 'ОГЛАВЛЕНИЕ КНИГИ', bookPage: 1, pdfPage: 1, items: [] };
      for (const item of tocCandidates.slice(0, 260)) {
        if (/^(?:РАЗДЕЛ|ГЛАВА|ЧАСТЬ|SECTION|CHAPTER|PART)\b/i.test(item.title)) {
          if (cur.items.length || cur.title !== 'ОГЛАВЛЕНИЕ КНИГИ') secs.push(cur);
          cur = { title: item.title, bookPage: item.bookPage, pdfPage: item.pdfPage, items: [] };
        } else {
          cur.items.push(item);
        }
      }
      secs.push(cur);
      return secs;
    }

    // 3. Fallback: group pages into clean navigable blocks + detected headings
    const autoSec = { title: 'СТРАНИЦЫ И УЗЛЫ ДОКУМЕНТА', bookPage: 1, pdfPage: 1, items: [] };
    const step = totalPages <= 30 ? 1 : Math.max(5, Math.ceil(totalPages / 30));
    for (let p = 1; p <= totalPages; p += step) {
      const lines = pageLinesMap.get(p) || [];
      const heading = lines.find((l) => l.length > 5 && l.length < 85 && !/^\d+$/.test(l)) || `Страница ${p}`;
      autoSec.items.push({
        title: `Стр. ${p}: ${heading.slice(0, 68)}`,
        bookPage: p,
        pdfPage: p
      });
    }
    return [autoSec];
  }

  async function buildGuidesFromPdf(pdfDoc, pageLinesMap, totalPages, userMeta, onSubProgress) {
    // Score pages that look like actionable step-by-step repair procedures
    const candidates = [];
    for (const [p, lines] of pageLinesMap.entries()) {
      if (p <= 4 && totalPages > 12) continue;
      let heading = null;
      let capsTitle = null;
      let numberedSteps = 0;
      for (let li = 0; li < lines.length; li++) {
        const ln = lines[li];
        // Skip running page headers on line 0/1 like "36 Ford Fiesta/Fusion"
        if (li <= 1 && /^\d{1,4}\s+[A-Za-zА-Яа-я]/.test(ln) && !REPAIR_HEADING_RE.test(ln)) {
          continue;
        }
        if (!heading && REPAIR_HEADING_RE.test(ln) && ln.length >= 8 && ln.length <= 105 && !ln.includes('..')) {
          heading = ln;
        }
        if (!capsTitle && li >= 1 && ln.length >= 10 && ln.length <= 85 && ln === ln.toUpperCase() && /[А-ЯЁA-Z]{4}/.test(ln) && !/^(?:ПРЕДУПРЕЖДЕНИ|ВНИМАНИЕ|ПРИМЕЧАНИ|ПОЛЕЗНЫЙ\s*СОВЕТ)/i.test(ln)) {
          capsTitle = ln;
        }
        if (/^\d{1,2}\.\s+[А-ЯЁA-Z…]/.test(ln)) {
          numberedSteps++;
        }
      }
      if (heading || numberedSteps >= 3) {
        const fallbackLine = capsTitle
          || lines.slice(1).find((l) => l.length >= 12 && l.length <= 85 && !/^\d{1,4}\s/.test(l) && !/^\d{1,2}\./.test(l))
          || `Операция ремонта (стр. ${p})`;
        const title = heading || fallbackLine;
        candidates.push({
          page: p,
          title: formatProcedureTitle(title),
          score: (heading ? 18 : 0) + Math.min(14, numberedSteps * 2)
        });
      }
    }

    // Sort by best score & spread across diverse chapters of the book
    candidates.sort((a, b) => b.score - a.score || a.page - b.page);
    const chosen = [];
    const minGap = totalPages > 40 ? Math.max(4, Math.floor(totalPages / 14)) : 2;
    for (const c of candidates) {
      if (chosen.some((existing) => Math.abs(existing.page - c.page) < minGap)) continue;
      chosen.push(c);
      if (chosen.length >= 4) break;
    }
    if (chosen.length < 4) {
      for (const c of candidates) {
        if (chosen.some((existing) => Math.abs(existing.page - c.page) < 2)) continue;
        chosen.push(c);
        if (chosen.length >= 4) break;
      }
    }
    chosen.sort((a, b) => a.page - b.page);

    // Fallback if document is scanned or has non-standard headings: create up to 3 visual chapters across the PDF
    if (chosen.length === 0) {
      const span = Math.max(1, Math.floor(totalPages / Math.min(3, totalPages)));
      for (let i = 0; i < Math.min(3, totalPages); i++) {
        const startP = Math.min(totalPages, 1 + i * span);
        const lines = pageLinesMap.get(startP) || [];
        const firstLine = lines.find((l) => l.length > 6 && l.length < 80) || `Раздел документа ${i + 1}`;
        chosen.push({
          page: startP,
          title: formatProcedureTitle(firstLine),
          score: 1
        });
      }
    }

    const guides = [];
    for (let idx = 0; idx < chosen.length; idx++) {
      const item = chosen[idx];
      const p1 = item.page;
      const p2 = p1 < totalPages ? p1 + 1 : p1;
      const pagesForGuide = p2 !== p1 ? [p1, p2] : [p1];

      onSubProgress(((idx + 0.3) / chosen.length) * 100, `Рендеринг иллюстраций видеогида ${idx + 1} из ${chosen.length} (стр. ${p1})…`);

      const combinedLines = [];
      for (const gp of pagesForGuide) {
        combinedLines.push(...(pageLinesMap.get(gp) || []));
      }
      const joinedText = combinedLines.join(' ');

      // Extract complete multi-line numbered steps or clean sentences
      const extractedStepsText = [];
      for (let li = 0; li < combinedLines.length; li++) {
        const sm = combinedLines[li].match(/^(\d{1,2})\.\s*(.+)$/);
        if (sm && sm[2].length >= 4) {
          let fullStep = sm[2].trim();
          let look = 0;
          while (
            look < 3 &&
            li + 1 < combinedLines.length &&
            fullStep.length < 165 &&
            !/[.!?]$/.test(fullStep)
          ) {
            const nxt = combinedLines[li + 1];
            if (/^\d{1,2}\.\s/.test(nxt) || nxt === nxt.toUpperCase()) break;
            fullStep = (fullStep.endsWith('-') ? fullStep.slice(0, -1) : fullStep + ' ') + nxt.trim();
            li++;
            look++;
          }
          if (fullStep.length >= 10) {
            extractedStepsText.push(fullStep.replace(/\s+/g, ' ').trim());
          }
        }
      }
      if (extractedStepsText.length < 2) {
        const sentences = joinedText
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 25 && s.length <= 180);
        extractedStepsText.push(...sentences.slice(0, 6));
      }
      if (extractedStepsText.length === 0) {
        extractedStepsText.push(
          `Ознакомьтесь со схемой и расположением узлов на странице ${p1} руководства.`,
          `Выполните операции согласно заводским указаниям и соблюдайте технику безопасности.`
        );
      }

      // Extract tools, warning, torques
      const toolMatch = joinedText.match(TOOL_EXTRACT_RE);
      const warnMatch = joinedText.match(WARN_EXTRACT_RE);
      const foundTorques = [];
      let tm;
      TORQUE_RE.lastIndex = 0;
      while ((tm = TORQUE_RE.exec(joinedText)) !== null && foundTorques.length < 4) {
        foundTorques.push(`${tm[1]} ${tm[2]}`);
      }

      // Render high-res visual frames (upper & lower crops of each page so the player zooms into clear details)
      const stepVisuals = [];
      for (const gp of pagesForGuide) {
        const fullImg = await renderPageToDataUrl(pdfDoc, gp, { scale: 1.45, maxWidth: 1050, quality: 0.85 });
        const topHalf = await renderPageToDataUrl(pdfDoc, gp, { scale: 1.55, maxWidth: 1050, quality: 0.85, cropBox: { x: 0.03, y: 0.06, w: 0.94, h: 0.48 } });
        const botHalf = await renderPageToDataUrl(pdfDoc, gp, { scale: 1.55, maxWidth: 1050, quality: 0.85, cropBox: { x: 0.03, y: 0.46, w: 0.94, h: 0.48 } });
        stepVisuals.push(fullImg, topHalf, botHalf);
      }

      // Split into 2 logical chapters if >= 4 steps, else 1 chapter
      const cappedSteps = extractedStepsText.slice(0, 8);
      const mid = cappedSteps.length >= 4 ? Math.ceil(cappedSteps.length / 2) : cappedSteps.length;
      const groups = cappedSteps.length >= 4
        ? [cappedSteps.slice(0, mid), cappedSteps.slice(mid)]
        : [cappedSteps];

      let cursorTime = 0;
      const chapters = groups.map((grp, chIdx) => {
        const stepsObjs = grp.map((cap, sIdx) => {
          const globalNum = chIdx * mid + sIdx + 1;
          const img = stepVisuals[(globalNum - 1) % stepVisuals.length];
          return {
            num: globalNum,
            image: img,
            caption: cap.slice(0, 175),
            tool: toolMatch ? toolMatch[1].slice(0, 65) : 'Стандартный слесарный инструмент'
          };
        });

        const intro = chIdx === 0 ? `${item.title}. ` : `Продолжение операции, этап ${chIdx + 1}. `;
        const warnVoice = chIdx === 0 && warnMatch ? ` Внимание: ${warnMatch[1]}` : '';
        const voiceScript = `${intro}${grp.join(' ')}${warnVoice}`.slice(0, 950);
        // Estimate ~13 chars/sec for natural Russian TTS
        const estDur = Math.max(14, Math.round(voiceScript.length / 13));
        const chObj = {
          id: `up-${idx}-ch-${chIdx + 1}`,
          index: chIdx + 1,
          title: groups.length > 1 ? `Этап ${chIdx + 1}. ${chIdx === 0 ? 'Подготовка и разборка узла' : 'Сборка, регулировка и контроль'}` : `Этап 1. Пошаговое выполнение операции`,
          audioUrl: null, // Uses SpeechEngine live Russian TTS
          synthesizedTts: true,
          duration: estDur,
          startTime: cursorTime,
          endTime: cursorTime + estDur,
          voiceScript,
          keyMetric: foundTorques.length ? `Моменты: ${foundTorques.join(' • ')}` : `Стр. ${pagesForGuide.join('–')} руководства`,
          warning: warnMatch ? warnMatch[1].slice(0, 150) : 'Соблюдайте технику безопасности и чистоту резьбовых соединений.',
          steps: stepsObjs
        };
        cursorTime += estDur;
        return chObj;
      });

      guides.push({
        slug: `uploaded-guide-${idx + 1}`,
        isSynthesizedVideo: true,
        vehicleBadge: (userMeta.brand ? `${userMeta.brand} ${userMeta.model || ''}` : guessBookNameFromFilename('Руководство')).trim().toUpperCase().slice(0, 26),
        title: item.title,
        shortTitle: item.title.slice(0, 52),
        section: `Страницы ${pagesForGuide.join('–')} загруженного PDF`,
        bookPages: pagesForGuide.join('–'),
        pdfPages: pagesForGuide,
        difficulty: cappedSteps.length >= 6 ? 3 : 2,
        workers: 1,
        workplace: 'По техкарте PDF',
        workTime: `${Math.max(20, cappedSteps.length * 10)} мин`,
        interval: 'Согласно регламенту ТО',
        engines: [userMeta.engines || 'Все модификации книги'],
        videoUrl: null,
        posterUrl: stepVisuals[0],
        totalDuration: cursorTime,
        tools: toolMatch
          ? toolMatch[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 6)
          : ['Набор торцовых головок и ключей', 'Отвертки и динамометрический ключ', 'Чистая ветошь и средства защиты'],
        consumables: ['Запасные части и расходные материалы по каталогу модели'],
        torques: foundTorques.length
          ? foundTorques.map((v, ti) => ({ part: `Резьбовое соединение #${ti + 1} (стр. ${p1})`, value: v }))
          : [{ part: `Контроль затяжки (см. стр. ${p1})`, value: 'По таблице PDF' }],
        chapters
      });
    }

    return guides;
  }

  function formatProcedureTitle(raw) {
    const clean = String(raw || '').replace(/\s+/g, ' ').replace(/[.:;]+$/, '').trim();
    if (!clean) return 'Операция технического обслуживания';
    if (clean === clean.toUpperCase() && clean.length > 4) {
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
    return clean;
  }

  /* =========================================================================
   * 4. CanvasCinemaPlayer — 60fps 1280×720 HUD Video Player + TTS + WebM Export
   * ========================================================================= */
  class CanvasCinemaPlayer {
    constructor(canvasEl, callbacks = {}) {
      this.canvas = canvasEl;
      this.ctx = canvasEl ? canvasEl.getContext('2d') : null;
      this.guide = null;
      this.playing = false;
      this.rate = 1.0;
      this.currentTime = 0;
      this.rafId = null;
      this.lastTick = 0;
      this.activeSpokenChapter = -1;
      this.imageCache = new Map();
      this.onTimeUpdate = callbacks.onTimeUpdate || null;
      this.onStateChange = callbacks.onStateChange || null;
      this.onChapterChange = callbacks.onChapterChange || null;
    }

    loadGuide(guide) {
      this.pause();
      this.guide = guide;
      this.currentTime = 0;
      this.activeSpokenChapter = -1;
      this.preloadImages(guide).then(() => {
        this.renderFrame();
      });
      this.renderFrame();
      if (this.onTimeUpdate) this.onTimeUpdate(0, this.getTotalDuration());
    }

    async preloadImages(guide) {
      if (!guide) return;
      const urls = new Set();
      guide.chapters.forEach((ch) => ch.steps.forEach((st) => urls.add(st.image)));
      await Promise.all(Array.from(urls).map((u) => {
        if (this.imageCache.has(u)) return Promise.resolve();
        return new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            this.imageCache.set(u, im);
            res();
          };
          im.onerror = () => res();
          im.src = u;
        });
      }));
    }

    getTotalDuration() {
      return (this.guide && this.guide.totalDuration) || 30;
    }

    setRate(r) {
      this.rate = Math.min(1.75, Math.max(0.75, r || 1.0));
      if (this.playing) {
        // Restart current chapter speech at new rate
        this.speakChapterForCurrentTime(true);
      }
    }

    play() {
      if (!this.guide || this.playing) return;
      if (this.currentTime >= this.getTotalDuration() - 0.3) {
        this.currentTime = 0;
        this.activeSpokenChapter = -1;
      }
      this.playing = true;
      this.lastTick = performance.now();
      this.speakChapterForCurrentTime(true);
      this.loop();
      if (this.onStateChange) this.onStateChange(true);
    }

    pause() {
      this.playing = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      SpeechEngine.stop();
      if (this.onStateChange) this.onStateChange(false);
    }

    toggle() {
      if (this.playing) this.pause();
      else this.play();
    }

    seek(sec) {
      const total = this.getTotalDuration();
      this.currentTime = Math.min(total, Math.max(0, sec || 0));
      this.renderFrame();
      if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, total);
      const chIdx = this.getChapterIndexAt(this.currentTime);
      if (this.onChapterChange) this.onChapterChange(chIdx);
      if (this.playing) {
        this.speakChapterForCurrentTime(true);
      }
    }

    getChapterIndexAt(t) {
      if (!this.guide || !this.guide.chapters.length) return 0;
      const idx = this.guide.chapters.findIndex((c) => t >= c.startTime && t < c.endTime);
      return idx === -1 ? this.guide.chapters.length - 1 : idx;
    }

    speakChapterForCurrentTime(force = false) {
      if (!this.guide) return;
      const chIdx = this.getChapterIndexAt(this.currentTime);
      if (!force && chIdx === this.activeSpokenChapter) return;
      this.activeSpokenChapter = chIdx;
      const ch = this.guide.chapters[chIdx];
      if (this.onChapterChange) this.onChapterChange(chIdx);
      if (ch && this.playing) {
        SpeechEngine.speak(ch.voiceScript, { rate: this.rate });
      }
    }

    loop() {
      if (!this.playing) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastTick) / 1000) * this.rate;
      this.lastTick = now;
      this.currentTime += dt;

      const total = this.getTotalDuration();
      if (this.currentTime >= total) {
        this.currentTime = total;
        this.renderFrame();
        if (this.onTimeUpdate) this.onTimeUpdate(total, total);
        this.pause();
        return;
      }

      this.speakChapterForCurrentTime(false);
      this.renderFrame();
      if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, total);
      this.rafId = requestAnimationFrame(() => this.loop());
    }

    renderFrame() {
      if (!this.ctx || !this.guide) return;
      const ctx = this.ctx;
      const W = 1280;
      const H = 720;
      const g = this.guide;
      const chIdx = this.getChapterIndexAt(this.currentTime);
      const ch = g.chapters[chIdx] || g.chapters[0];
      if (!ch) return;

      const chSpan = Math.max(1, ch.endTime - ch.startTime);
      const chRel = Math.min(0.999, Math.max(0, (this.currentTime - ch.startTime) / chSpan));
      const stepIdx = Math.min(ch.steps.length - 1, Math.floor(chRel * ch.steps.length));
      const step = ch.steps[stepIdx] || ch.steps[0];
      const stepLocalProg = (chRel * ch.steps.length) - stepIdx;

      const allStepsCount = g.chapters.reduce((a, c) => a + c.steps.length, 0);
      const prevStepsCount = g.chapters.slice(0, chIdx).reduce((a, c) => a + c.steps.length, 0);
      const globalStepNum = prevStepsCount + stepIdx + 1;

      // Base dark background
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, W, H);

      // Top Header Bar
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, W, 74);
      ctx.strokeStyle = '#26334d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 74);
      ctx.lineTo(W, 74);
      ctx.stroke();

      // Vehicle Badge
      const badgeTxt = (g.vehicleBadge || 'ЗАГРУЖЕННАЯ КНИГА').slice(0, 22);
      roundRect(ctx, 28, 18, 250, 36, 8, '#f59e0b');
      ctx.fillStyle = '#0b0f19';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillText(badgeTxt, 40, 41);

      // Title & Meta
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 21px Inter, system-ui, sans-serif';
      ctx.fillText(g.shortTitle.slice(0, 46), 294, 34);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.fillText(`Стр. ${g.bookPages}  •  ${g.workplace}  •  Оценка: ${g.workTime}`, 294, 57);

      // Right Difficulty Pill
      roundRect(ctx, 1044, 18, 208, 36, 8, '#1e293b', '#334155');
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillText(`СЛОЖНОСТЬ: ${g.difficulty}/5`, 1062, 41);

      // Left Telemetry Card
      roundRect(ctx, 28, 94, 440, 562, 14, '#111827', '#26334d');

      roundRect(ctx, 48, 114, 138, 30, 6, '#1e3a8a');
      ctx.fillStyle = '#bfdbfe';
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      ctx.fillText(`ЭТАП ${ch.index} ИЗ ${g.chapters.length}`, 60, 134);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`ШАГ ${String(globalStepNum).padStart(2, '0')} / ${String(allStepsCount).padStart(2, '0')}`, 336, 135);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px Inter, system-ui, sans-serif';
      drawWrappedText(ctx, ch.title, 48, 170, 400, 21, 2);

      // Main Step Instruction
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 19px Inter, system-ui, sans-serif';
      drawWrappedText(ctx, step.caption, 48, 232, 400, 26, 5);

      // Tool Box
      roundRect(ctx, 48, 384, 400, 68, 10, '#0f172a', '#334155');
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.fillText('ИНСТРУМЕНТ / ОПЕРАЦИЯ', 62, 405);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 15px Inter, system-ui, sans-serif';
      drawWrappedText(ctx, step.tool, 62, 428, 372, 19, 1);

      // Torque / Metric Box
      roundRect(ctx, 48, 464, 400, 72, 10, '#0f172a', '#334155');
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.fillText('ТЕХНИЧЕСКИЙ КОНТРОЛЬ / СТРАНИЦА', 62, 485);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '15px Inter, system-ui, sans-serif';
      drawWrappedText(ctx, ch.keyMetric, 62, 508, 372, 19, 2);

      // Warning Box
      roundRect(ctx, 48, 548, 400, 92, 10, '#3b1219', '#b91c1c');
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.fillText('ВАЖНОЕ ПРЕДУПРЕЖДЕНИЕ', 62, 568);
      ctx.fillStyle = '#fee2e2';
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      drawWrappedText(ctx, ch.warning, 62, 590, 372, 18, 2);

      // Right Stage Viewport with Smooth Ken Burns Motion
      roundRect(ctx, 490, 94, 762, 562, 14, '#111827', '#26334d');
      const imgObj = this.imageCache.get(step.image);
      if (imgObj && imgObj.width > 0) {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(504, 108, 734, 534, 10);
        } else {
          ctx.rect(504, 108, 734, 534);
        }
        ctx.clip();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(504, 108, 734, 534);

        const zoom = 1.0 + 0.065 * stepLocalProg;
        const baseScale = Math.min(714 / imgObj.width, 514 / imgObj.height);
        const dw = imgObj.width * baseScale * zoom;
        const dh = imgObj.height * baseScale * zoom;
        const dx = 504 + (734 - dw) / 2;
        const dy = 108 + (534 - dh) / 2;
        ctx.drawImage(imgObj, dx, dy, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '16px Inter, system-ui, sans-serif';
        ctx.fillText('Загрузка иллюстрации из PDF…', 770, 375);
      }

      // Bottom Progress Bar
      roundRect(ctx, 28, 676, 1224, 16, 8, '#1e293b');
      const ratio = Math.min(1, Math.max(0.02, this.currentTime / Math.max(1, this.getTotalDuration())));
      roundRect(ctx, 28, 676, Math.round(1224 * ratio), 16, 8, '#f59e0b');
    }

    async exportWebm(onExportStatus) {
      if (!this.canvas || !this.canvas.captureStream || typeof MediaRecorder === 'undefined') {
        alert('Экспорт WebM не поддерживается в этом браузере.');
        return;
      }
      const stream = this.canvas.captureStream(24);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: mime });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(this.guide && this.guide.slug) || 'repair-guide'}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        if (onExportStatus) onExportStatus(false);
      };
      if (onExportStatus) onExportStatus(true);
      this.currentTime = 0;
      this.activeSpokenChapter = -1;
      rec.start();
      this.play();
      const checkDone = setInterval(() => {
        if (!this.playing) {
          clearInterval(checkDone);
          if (rec.state !== 'inactive') rec.stop();
        }
      }, 250);
    }
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawWrappedText(ctx, text, x, y, maxW, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/);
    let line = '';
    let lineCount = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y + lineCount * lineHeight);
        lineCount++;
        line = words[i];
        if (lineCount >= maxLines) return;
      } else {
        line = test;
      }
    }
    if (line && lineCount < maxLines) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
    }
  }

  window.ManualBookEngine = {
    BookStorage,
    SpeechEngine,
    openPdfFromBlob,
    renderPageToDataUrl,
    processUploadedPdf,
    guessBookNameFromFilename,
    CanvasCinemaPlayer
  };
})();
