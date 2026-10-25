(function () {
  'use strict';

  const state = {
    activeTab: 'player',
    activeBookId: 'ford-fiesta-fusion',
    builtInFordBook: null,
    uploadedBooks: [], // Loaded from IndexedDB
    loadedPdfDocs: new Map(), // bookId -> PDFDocumentProxy
    guides: [],
    currentGuide: null,
    playerMode: 'video', // 'video' | 'steps'
    currentChapterIdx: 0,
    currentStepInChapterIdx: 0,
    manualStepOverride: false,
    hfSpeakingTts: false,
    hfTtsTimer: null,
    checkedItems: {},
    baseCatalog: [],
    catalogFilter: 'all',
    manual: null,
    activePagesText: null,
    bookSidebarMode: 'toc', // 'toc' | 'diagrams'
    currentPdfPage: 5,
    totalPdfPages: 385,
    pdfZoom: 100,
    showExtractedText: false,
    dtcCategory: 'ALL',
    selectedMileage: 'km20',
    speechRec: null,
    voiceListening: false,
    pendingPdfFile: null,
    builtInPdfDoc: null,
    agentProcedures: [],
    agentCategory: 'all',
    activeAgentProcId: null,
    currentShortVideo: null
  };

  try {
    state.checkedItems = JSON.parse(localStorage.getItem('mvpro_checklist') || '{}');
  } catch (_) {
    state.checkedItems = {};
  }

  const $ = (id) => document.getElementById(id);
  let hasLiveBackend = true;
  let fordStaticPagesText = null;
  let cinemaPlayer = null;
  let shortAgentPlayer = null;
  let hfAnimRaf = null;

  function assetUrl(u) {
    if (!u) return '';
    if (String(u).startsWith('data:') || String(u).startsWith('blob:') || String(u).startsWith('http')) {
      return u;
    }
    return String(u).replace(/^\//, './');
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stopAllPlayback() {
    const v = $('mainVideoPlayer');
    const a = $('hfStageAudio');
    if (v && !v.paused) v.pause();
    if (a && !a.paused) a.pause();
    if (cinemaPlayer && cinemaPlayer.playing) cinemaPlayer.pause();
    if (shortAgentPlayer && shortAgentPlayer.playing) shortAgentPlayer.pause();
    if (window.ManualBookEngine) {
      window.ManualBookEngine.SpeechEngine.stop();
    }
    state.hfSpeakingTts = false;
    if (state.hfTtsTimer) {
      clearInterval(state.hfTtsTimer);
      state.hfTtsTimer = null;
    }
    updateHfPlayButtonLabel();
  }

  /* =========================================================================
   * Active Book Switching (Built-in Ford <-> Any User-Uploaded PDF Book)
   * ========================================================================= */
  function renderActiveBookSelect() {
    const sel = $('activeBookSelect');
    if (!sel) return;
    const options = [
      `<option value="ford-fiesta-fusion" ${state.activeBookId === 'ford-fiesta-fusion' ? 'selected' : ''}>Ford Fiesta / Fusion (385 стр.)</option>`,
      ...state.uploadedBooks.map((b) => `
        <option value="${escapeHtml(b.id)}" ${state.activeBookId === b.id ? 'selected' : ''}>
          📘 ${escapeHtml(b.fullTitle || (b.brand + ' ' + b.model))} (${b.pagesCount} стр.)
        </option>
      `)
    ];
    sel.innerHTML = options.join('');
    const totalActiveBooks = 1 + state.uploadedBooks.length;
    $('catalogCountBadge').textContent = `Книг: ${totalActiveBooks}`;
  }

  async function activateBook(bookId) {
    stopAllPlayback();

    if (bookId === 'ford-fiesta-fusion' || !state.uploadedBooks.some((b) => b.id === bookId)) {
      state.activeBookId = 'ford-fiesta-fusion';
      state.guides = state.builtInFordBook.guides;
      state.manual = state.builtInFordBook.manual;
      if (!fordStaticPagesText) {
        try {
          fordStaticPagesText = await fetch('./data/pages_text.json').then((r) => r.json());
        } catch (_) {
          fordStaticPagesText = [];
        }
      }
      state.activePagesText = fordStaticPagesText;
      state.totalPdfPages = 385;
      state.currentPdfPage = 5;

      $('playerHeroTitle').textContent = 'Цветные анимированные видеоруководства с голосом диктора';
      $('playerHeroSub').innerHTML = 'Каждое действие оживлено в цвете: вращение ключей, динамометрическая затяжка, слив/залив жидкостей и фазы ГРМ из книги <strong>Ford Fiesta / Fusion</strong> + ИИ-Агент коротких видео по всем разделам.';
      $('guidesCountBadge').textContent = `${state.guides.length} MP4`;
    } else {
      const userBook = state.uploadedBooks.find((b) => b.id === bookId);
      state.activeBookId = userBook.id;
      state.guides = userBook.guides || [];
      state.manual = userBook.manual;
      state.activePagesText = userBook.pagesText || [];
      state.totalPdfPages = userBook.pagesCount || 1;
      state.currentPdfPage = 1;

      $('playerHeroTitle').textContent = `Анимированные видеогиды: ${userBook.fullTitle || (userBook.brand + ' ' + userBook.model)}`;
      $('playerHeroSub').innerHTML = `Автоматически оцифровано и раскрашено из вашего файла <strong>${escapeHtml(userBook.fileName)}</strong> (${userBook.pagesCount} стр.): каждое действие оживлено с русской озвучкой.`;
      $('guidesCountBadge').textContent = `${state.guides.length} гид.`;
    }

    $('bookPagesBadge').textContent = `${state.totalPdfPages} стр.`;
    $('pdfPageInput').max = String(state.totalPdfPages);
    $('pdfTotalPagesLabel').textContent = `из ${state.totalPdfPages}`;
    $('dtcCountBadge').textContent = state.manual && state.manual.dtcCodes ? state.manual.dtcCodes.length : 0;

    renderActiveBookSelect();
    if (state.guides.length > 0) {
      selectGuide(state.guides[0]);
    }
    renderCatalog();
    renderBookSidebar();
    renderDtcTable();
    renderSpecsTab();
    loadPdfPage(state.currentPdfPage);
    await refreshAgentWorkspace();
  }

  async function ensureUploadedPdfDoc(bookId) {
    if (state.loadedPdfDocs.has(bookId)) {
      return state.loadedPdfDocs.get(bookId);
    }
    if (!window.ManualBookEngine) return null;
    const blob = await window.ManualBookEngine.BookStorage.getBookPdfBlob(bookId);
    if (!blob) return null;
    const pdfDoc = await window.ManualBookEngine.openPdfFromBlob(blob);
    state.loadedPdfDocs.set(bookId, pdfDoc);
    return pdfDoc;
  }

  /* Navigation */
  function switchTab(tabId) {
    if (tabId !== state.activeTab) {
      stopAllPlayback();
    }
    state.activeTab = tabId;
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });
  }

  function openPdfPageInViewer(pdfPage) {
    const p = Math.min(state.totalPdfPages, Math.max(1, parseInt(pdfPage, 10) || 1));
    switchTab('book');
    loadPdfPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Guide Selector & Player */
  function renderGuideStrip() {
    const strip = $('guideSelectorStrip');
    strip.innerHTML = state.guides.map((g) => {
      const isAct = state.currentGuide && state.currentGuide.slug === g.slug;
      const stepsTotal = g.chapters.reduce((acc, c) => acc + c.steps.length, 0);
      return `
        <button class="guide-select-card ${isAct ? 'active' : ''}" data-slug="${escapeHtml(g.slug)}">
          <img class="gsc-thumb" src="${escapeHtml(assetUrl(g.posterUrl))}" alt="${escapeHtml(g.shortTitle)}" />
          <div class="gsc-info">
            <div class="gsc-title">${escapeHtml(g.shortTitle)}</div>
            <div class="gsc-meta">
              <span class="gsc-badge-dur">▶ ${fmtTime(g.totalDuration)}</span>
              <span>${g.chapters.length} эт. • ${stepsTotal} фото</span>
              <span>Стр. ${escapeHtml(g.bookPages)}</span>
            </div>
          </div>
        </button>
      `;
    }).join('');

    strip.querySelectorAll('.guide-select-card').forEach((card) => {
      card.addEventListener('click', () => {
        const found = state.guides.find((g) => g.slug === card.dataset.slug);
        if (found) selectGuide(found);
      });
    });
  }

  function selectGuide(guide) {
    stopAllPlayback();

    state.currentGuide = guide;
    state.currentChapterIdx = 0;
    state.currentStepInChapterIdx = 0;
    state.manualStepOverride = false;

    renderGuideStrip();
    renderVideoPlayer(guide);
    renderHandsFreeStage(false);
    renderChaptersList();
    renderSidePassport(guide);
  }

  function setPlayerMode(mode) {
    stopAllPlayback();
    state.playerMode = mode;
    $('modeVideoBtn').classList.toggle('active', mode === 'video');
    $('modeStepBtn').classList.toggle('active', mode === 'steps');
    $('videoModeContainer').classList.toggle('hidden', mode !== 'video');
    $('videoExtraControls').classList.toggle('hidden', mode !== 'video');
    $('stepsModeContainer').classList.toggle('hidden', mode !== 'steps');

    if (mode === 'steps') {
      renderHandsFreeStage(false);
    } else if (state.currentGuide) {
      renderVideoPlayer(state.currentGuide);
    }
  }

  function renderVideoPlayer(guide) {
    const isSynth = !!guide.isSynthesizedVideo;
    $('mp4VideoWrapper').classList.toggle('hidden', isSynth);
    $('synthVideoWrap').classList.toggle('hidden', !isSynth);
    $('downloadMp4Link').classList.toggle('hidden', isSynth);
    $('exportWebmBtn').classList.toggle('hidden', !isSynth);

    const rate = parseFloat($('videoSpeedSelect').value || '1');

    if (!isSynth) {
      const v = $('mainVideoPlayer');
      v.src = assetUrl(guide.videoUrl);
      v.poster = assetUrl(guide.posterUrl);
      v.load();
      v.playbackRate = rate;

      const dl = $('downloadMp4Link');
      dl.href = assetUrl(guide.videoUrl);
      dl.setAttribute('download', `ford_${guide.slug}.mp4`);
    } else if (cinemaPlayer) {
      cinemaPlayer.setRate(rate);
      cinemaPlayer.loadGuide(guide);
      $('synthScrubber').max = String(guide.totalDuration || 30);
      $('synthScrubber').value = '0';
      $('synthTimeLabel').textContent = `0:00 / ${fmtTime(guide.totalDuration)}`;
      $('synthPlayBtn').textContent = '▶ Пуск с озвучкой';
    }

    const ch0 = guide.chapters[0];
    $('liveVideoTranscriptText').textContent = ch0 ? ch0.voiceScript : '';
  }

  function renderChaptersList() {
    const g = state.currentGuide;
    if (!g) return;
    $('chaptersSummaryMeta').textContent = `Общая длительность: ${fmtTime(g.totalDuration)}`;

    const container = $('chaptersList');
    container.innerHTML = g.chapters.map((ch, idx) => {
      const active = idx === state.currentChapterIdx;
      return `
        <div class="chapter-row ${active ? 'active' : ''}" data-ch-idx="${idx}">
          <div class="ch-row-left">
            <span class="ch-time-pill">${fmtTime(ch.startTime)} – ${fmtTime(ch.endTime)}</span>
            <div>
              <div class="ch-row-title">${escapeHtml(ch.title)}</div>
              <div class="ch-row-sub">${ch.steps.length} фото • ${escapeHtml(ch.keyMetric)}</div>
            </div>
          </div>
          <span class="btn-ghost-sm">${state.playerMode === 'video' ? '▶ Таймкод' : '🔊 Выбрать'}</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.chapter-row').forEach((row) => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.chIdx, 10);
        state.currentChapterIdx = idx;
        state.currentStepInChapterIdx = 0;
        state.manualStepOverride = false;

        if (state.playerMode === 'video') {
          const targetCh = g.chapters[idx];
          if (g.isSynthesizedVideo && cinemaPlayer && targetCh) {
            cinemaPlayer.seek(targetCh.startTime + 0.05);
            cinemaPlayer.play();
          } else {
            const v = $('mainVideoPlayer');
            if (targetCh) {
              v.currentTime = targetCh.startTime + 0.05;
              v.play().catch(() => {});
            }
          }
          highlightChapterRow(idx);
        } else {
          renderHandsFreeStage(true);
        }
      });
    });
  }

  function highlightChapterRow(idx) {
    state.currentChapterIdx = idx;
    document.querySelectorAll('#chaptersList .chapter-row').forEach((el, i) => {
      el.classList.toggle('active', i === idx);
    });
    const g = state.currentGuide;
    if (g && g.chapters[idx]) {
      $('liveVideoTranscriptText').textContent = g.chapters[idx].voiceScript;
    }
  }

  /* Hands-Free Step Mode (Supports both MP3 files & Browser TTS for Uploaded PDFs) */
  function renderHandsFreeStage(autoPlay = false) {
    const g = state.currentGuide;
    if (!g) return;
    const ch = g.chapters[state.currentChapterIdx];
    if (!ch) return;

    const step = ch.steps[state.currentStepInChapterIdx] || ch.steps[0];
    $('hfStagePill').textContent = `ЭТАП ${ch.index} ИЗ ${g.chapters.length}`;
    $('hfStageTitle').textContent = ch.title;

    $('hfCurrentPhoto').src = assetUrl(step.image);
    $('hfStepCounterBadge').textContent = `Операция ${step.num} (фото ${state.currentStepInChapterIdx + 1}/${ch.steps.length})`;
    $('hfStepCaption').textContent = step.caption;
    $('hfStepTool').textContent = step.tool;
    $('hfChapterMetric').textContent = ch.keyMetric;
    $('hfChapterWarning').textContent = ch.warning;

    const thumbs = $('hfStepThumbs');
    thumbs.innerHTML = ch.steps.map((st, sIdx) => `
      <button class="hf-thumb-btn ${sIdx === state.currentStepInChapterIdx ? 'active' : ''}" data-sidx="${sIdx}" title="${escapeHtml(st.caption)}">
        <img src="${escapeHtml(assetUrl(st.image))}" alt="Шаг ${st.num}" />
        <span class="hf-thumb-num">#${st.num}</span>
      </button>
    `).join('');

    thumbs.querySelectorAll('.hf-thumb-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.currentStepInChapterIdx = parseInt(btn.dataset.sidx, 10);
        state.manualStepOverride = true;
        updateHandsFreeStepOnly();
      });
    });

    $('hfPrevStageBtn').disabled = state.currentChapterIdx === 0;
    $('hfNextStageBtn').disabled = state.currentChapterIdx >= g.chapters.length - 1;

    const audio = $('hfStageAudio');
    if (!ch.synthesizedTts && ch.audioUrl) {
      const relAudio = assetUrl(ch.audioUrl);
      if (audio.getAttribute('data-cur') !== relAudio) {
        audio.setAttribute('data-cur', relAudio);
        audio.src = relAudio;
      }
    } else {
      audio.removeAttribute('src');
      audio.setAttribute('data-cur', '');
    }

    highlightChapterRow(state.currentChapterIdx);

    if (autoPlay) {
      playCurrentHandsFreeStage(true);
    } else {
      updateHfPlayButtonLabel();
    }
  }

  function playCurrentHandsFreeStage(restart = false) {
    const g = state.currentGuide;
    if (!g) return;
    const ch = g.chapters[state.currentChapterIdx];
    if (!ch) return;

    if (ch.synthesizedTts && window.ManualBookEngine) {
      if (state.hfTtsTimer) clearInterval(state.hfTtsTimer);
      state.hfSpeakingTts = true;
      updateHfPlayButtonLabel();

      const startedAt = Date.now();
      const durMs = Math.max(4000, (ch.duration || 16) * 1000);
      state.hfTtsTimer = setInterval(() => {
        if (!state.hfSpeakingTts || state.manualStepOverride) return;
        const ratio = Math.min(0.999, (Date.now() - startedAt) / durMs);
        const targetStep = Math.floor(ratio * ch.steps.length);
        if (targetStep !== state.currentStepInChapterIdx) {
          state.currentStepInChapterIdx = targetStep;
          updateHandsFreeStepOnly();
        }
      }, 300);

      const rate = parseFloat($('videoSpeedSelect').value || '1');
      window.ManualBookEngine.SpeechEngine.speak(ch.voiceScript, {
        rate,
        onEnd: () => {
          state.hfSpeakingTts = false;
          if (state.hfTtsTimer) clearInterval(state.hfTtsTimer);
          updateHfPlayButtonLabel();
          if (!$('hfAutoPauseToggle').checked) {
            goNextStage(true);
          }
        }
      });
    } else {
      const audio = $('hfStageAudio');
      if (restart) audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }

  function pauseCurrentHandsFreeStage() {
    const g = state.currentGuide;
    const ch = g && g.chapters[state.currentChapterIdx];
    if (ch && ch.synthesizedTts && window.ManualBookEngine) {
      window.ManualBookEngine.SpeechEngine.stop();
      state.hfSpeakingTts = false;
      if (state.hfTtsTimer) clearInterval(state.hfTtsTimer);
      updateHfPlayButtonLabel();
    } else {
      $('hfStageAudio').pause();
    }
  }

  function updateHandsFreeStepOnly() {
    const g = state.currentGuide;
    if (!g) return;
    const ch = g.chapters[state.currentChapterIdx];
    if (!ch) return;
    const step = ch.steps[state.currentStepInChapterIdx] || ch.steps[0];
    $('hfCurrentPhoto').src = assetUrl(step.image);
    $('hfStepCounterBadge').textContent = `Операция ${step.num} (фото ${state.currentStepInChapterIdx + 1}/${ch.steps.length})`;
    $('hfStepCaption').textContent = step.caption;
    $('hfStepTool').textContent = step.tool;
    document.querySelectorAll('#hfStepThumbs .hf-thumb-btn').forEach((b, i) => {
      b.classList.toggle('active', i === state.currentStepInChapterIdx);
    });
  }

  function updateHfPlayButtonLabel() {
    const audio = $('hfStageAudio');
    const btn = $('hfPlayPauseBtn');
    const isPlaying = state.hfSpeakingTts || (audio && !audio.paused && audio.src);
    btn.textContent = isPlaying ? '⏸ Пауза озвучки' : '🔊 Озвучить этап';
  }

  function renderSidePassport(guide) {
    $('guidePassportGrid').innerHTML = `
      <div class="passport-cell"><span>Место работы</span><strong>${escapeHtml(guide.workplace)}</strong></div>
      <div class="passport-cell"><span>Норматив времени</span><strong>${escapeHtml(guide.workTime)}</strong></div>
      <div class="passport-cell"><span>Сложность / Исполнители</span><strong>${guide.difficulty}/5 • ${guide.workers} чел.</strong></div>
      <div class="passport-cell"><span>Регламент</span><strong>${escapeHtml(guide.interval)}</strong></div>
    `;

    $('openSourcePdfBtn').onclick = () => {
      openPdfPageInViewer(guide.pdfPages[0]);
    };

    $('guideTorquesList').innerHTML = guide.torques.map((t) => `
      <div class="torque-mini-item">
        <span>${escapeHtml(t.part)}</span>
        <span class="torque-val-pill">${escapeHtml(t.value)}</span>
      </div>
    `).join('');

    const prefix = `${state.activeBookId}:${guide.slug}`;
    const allItems = [
      ...guide.tools.map((t) => ({ id: `${prefix}:tool:${t}`, label: t })),
      ...guide.consumables.map((c) => ({ id: `${prefix}:cons:${c}`, label: c }))
    ];

    const renderChecklistRows = () => {
      let done = 0;
      $('guideChecklist').innerHTML = allItems.map((it) => {
        const isChecked = !!state.checkedItems[it.id];
        if (isChecked) done++;
        return `
          <label class="check-row ${isChecked ? 'checked' : ''}">
            <input type="checkbox" data-cid="${escapeHtml(it.id)}" ${isChecked ? 'checked' : ''} />
            <span>${escapeHtml(it.label)}</span>
          </label>
        `;
      }).join('');
      $('checklistProgress').textContent = `${done}/${allItems.length}`;

      $('guideChecklist').querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener('change', () => {
          state.checkedItems[cb.dataset.cid] = cb.checked;
          try {
            localStorage.setItem('mvpro_checklist', JSON.stringify(state.checkedItems));
          } catch (_) {}
          renderChecklistRows();
        });
      });
    };
    renderChecklistRows();
  }

  /* =========================================================================
   * Catalog Tab (Upload Card + User Uploaded Books + Built-in & B2B Fleet)
   * ========================================================================= */
  function renderCatalog() {
    const combined = [
      ...state.uploadedBooks.map((ub) => ({
        ...ub,
        isUserBook: true
      })),
      ...state.baseCatalog
    ];

    const items = combined.filter((it) =>
      state.catalogFilter === 'all' ? true : it.category === state.catalogFilter
    );

    const uploadCardHtml = `
      <div class="cat-card upload-catalog-card" id="catalogDropCard">
        <div style="font-size:2.3rem;margin-bottom:8px;">📥</div>
        <h3 style="font-size:1.1rem;margin-bottom:6px;">+ Добавить новую книгу по ремонту (PDF)</h3>
        <p style="font-size:0.85rem;color:#94a3b8;max-width:290px;margin-bottom:14px;">
          Нажмите или перетащите сюда <strong>.pdf</strong>-мануал по любому автомобилю или спецтехнике для автоматического создания видеогидов с озвучкой.
        </p>
        <span class="btn-primary">Выбрать PDF-файл</span>
      </div>
    `;

    const cardsHtml = items.map((it) => {
      const isCurrentlySelected = it.id === state.activeBookId;
      const isReadyBook = it.status === 'active';
      const coverHtml = it.coverUrl
        ? `<img class="cat-cover" src="${escapeHtml(assetUrl(it.coverUrl))}" alt="${escapeHtml(it.model)}" />`
        : `<div class="cat-placeholder-cover"><span>${escapeHtml(it.brand)}</span><small style="color:#94a3b8;font-weight:600;margin-top:6px;">PDF B2B</small></div>`;
      const topicsHtml = it.sampleTopics
        ? `<div class="cat-topics"><strong>Востребованные видеоузлы для бригад:</strong><ul>${it.sampleTopics.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></div>`
        : '';

      let actionButtons = '';
      if (isReadyBook) {
        actionButtons = `
          <div style="display:flex;gap:8px;">
            <button class="btn-primary" style="flex:1;" data-activate-book="${escapeHtml(it.id)}">
              ${isCurrentlySelected ? '▶ Открыть видеогиды (Активна)' : '▶ Выбрать книгу и открыть гиды'}
            </button>
            ${it.isUserBook ? `<button class="btn-ghost-sm" data-delete-book="${escapeHtml(it.id)}" title="Удалить книгу из памяти браузера">🗑</button>` : ''}
          </div>
        `;
      } else {
        actionButtons = `<button class="btn-secondary" style="width:100%;" data-sim-model="${escapeHtml(it.brand + ' ' + it.model)}">📥 Загрузить PDF для этой техники</button>`;
      }

      return `
        <div class="cat-card ${isCurrentlySelected ? 'active-manual' : ''}">
          <div>
            <div class="cat-card-top">
              ${coverHtml}
              <div>
                <span class="cat-status-badge ${isReadyBook ? 'active' : 'pipeline'}">${escapeHtml(it.statusLabel)}</span>
                <div style="font-size:0.75rem;color:#94a3b8;">${escapeHtml(it.categoryLabel)}</div>
                <h3 style="font-size:1.06rem;margin:3px 0 6px;">${escapeHtml(it.brand)} — ${escapeHtml(it.model)}</h3>
                <div style="font-size:0.8rem;color:#cbd5e1;">${escapeHtml(it.engines)}</div>
              </div>
            </div>
            <p style="font-size:0.85rem;color:#94a3b8;margin-top:12px;">${escapeHtml(it.description)}</p>
            ${topicsHtml}
          </div>
          <div>
            <div class="cat-stats-row" style="margin-bottom:12px;">
              <span>${it.pagesCount} стр.</span>
              <span>${it.operationsCount} опер.</span>
              <span>${it.diagramsCount} схем</span>
              <span>${it.dtcCount} кодов</span>
            </div>
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('');

    $('catalogGrid').innerHTML = uploadCardHtml + cardsHtml;

    const dropCard = $('catalogDropCard');
    if (dropCard) {
      dropCard.addEventListener('click', () => openUploadModal());
      dropCard.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropCard.classList.add('dragover');
      });
      dropCard.addEventListener('dragleave', () => dropCard.classList.remove('dragover'));
      dropCard.addEventListener('drop', (e) => {
        e.preventDefault();
        dropCard.classList.remove('dragover');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) {
          openUploadModal();
          handleFileChosen(f);
        }
      });
    }

    $('catalogGrid').querySelectorAll('[data-activate-book]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await activateBook(btn.dataset.activateBook);
        switchTab('player');
      });
    });

    $('catalogGrid').querySelectorAll('[data-delete-book]').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const delId = btn.dataset.deleteBook;
        if (!confirm('Удалить эту загруженную книгу из библиотеки браузера?')) return;
        await window.ManualBookEngine.BookStorage.deleteBook(delId);
        state.loadedPdfDocs.delete(delId);
        state.uploadedBooks = state.uploadedBooks.filter((b) => b.id !== delId);
        if (state.activeBookId === delId) {
          await activateBook('ford-fiesta-fusion');
        } else {
          renderActiveBookSelect();
          renderCatalog();
        }
      });
    });

    $('catalogGrid').querySelectorAll('[data-sim-model]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openUploadModal(btn.dataset.simModel);
      });
    });
  }

  /* =========================================================================
   * Book TOC + Wiring Diagrams + High-DPI PDF Viewer (Ford + Uploaded PDFs)
   * ========================================================================= */
  function renderBookSidebar() {
    if (!state.manual) return;
    const filter = ($('bookSidebarFilter').value || '').trim().toLowerCase();

    $('bsTabToc').textContent = `Оглавление (${state.manual.sections.length} разд.)`;
    $('bsTabDiagrams').textContent = `Схемы (${state.manual.wiringDiagrams.length})`;

    const tocHtml = state.manual.sections.map((sec) => {
      const filteredItems = filter
        ? sec.items.filter((i) => i.title.toLowerCase().includes(filter) || sec.title.toLowerCase().includes(filter))
        : sec.items;
      if (filter && filteredItems.length === 0 && !sec.title.toLowerCase().includes(filter)) {
        return '';
      }
      return `
        <div class="toc-sec-block">
          <div class="toc-sec-title" data-pdfp="${sec.pdfPage}">
            <span>${escapeHtml(sec.title)}</span>
            <span>с.${sec.bookPage}</span>
          </div>
          ${filteredItems.map((it) => `
            <div class="toc-sub-item" data-pdfp="${it.pdfPage}">
              <span>${escapeHtml(it.title)}</span>
              <span style="font-family:var(--font-mono);font-size:0.75rem;">${it.bookPage}</span>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');
    $('bookTocContainer').innerHTML = tocHtml || '<div style="padding:12px;color:#94a3b8;">Ничего не найдено</div>';

    $('bookTocContainer').querySelectorAll('[data-pdfp]').forEach((el) => {
      el.addEventListener('click', () => loadPdfPage(parseInt(el.dataset.pdfp, 10)));
    });

    const diags = state.manual.wiringDiagrams.filter((d) =>
      !filter || (`${d.code} ${d.title} ${d.components}`).toLowerCase().includes(filter)
    );
    $('bookDiagramsContainer').innerHTML = diags.length ? diags.map((d) => `
      <div class="diagram-item" data-pdfp="${d.pdfPage}">
        <div style="display:flex;justify-content:space-between;">
          <strong>${escapeHtml(d.code)}. ${escapeHtml(d.title)}</strong>
          <span style="font-family:var(--font-mono);font-size:0.75rem;color:#f59e0b;">стр. ${d.bookPage}</span>
        </div>
        <div style="font-size:0.76rem;color:#94a3b8;margin-top:3px;">${escapeHtml(d.components.slice(0, 140))}${d.components.length > 140 ? '…' : ''}</div>
      </div>
    `).join('') : '<div style="padding:12px;color:#94a3b8;">В этой книге отдельных листов со словом «Схема» не выделено — используйте Оглавление или Поиск.</div>';

    $('bookDiagramsContainer').querySelectorAll('[data-pdfp]').forEach((el) => {
      el.addEventListener('click', () => loadPdfPage(parseInt(el.dataset.pdfp, 10)));
    });
  }

  async function loadPdfPage(pdfPage) {
    const p = Math.min(state.totalPdfPages, Math.max(1, pdfPage || 1));
    state.currentPdfPage = p;
    $('pdfPageInput').value = p;
    $('bookPageNumberHint').textContent = state.activeBookId === 'ford-fiesta-fusion'
      ? (p > 1 ? `(Стр. книги: ${p - 1})` : '(Обложка)')
      : `(Стр. ${p} из ${state.totalPdfPages})`;

    const spinner = $('pdfLoadingSpinner');
    const img = $('pdfRenderedImage');
    const iframe = $('staticPdfIframe');
    spinner.classList.remove('hidden');
    if (iframe) iframe.classList.add('hidden');
    img.classList.remove('hidden');

    if (state.activeBookId !== 'ford-fiesta-fusion') {
      // Render directly from IndexedDB PDF via PDF.js!
      try {
        const pdfDoc = await ensureUploadedPdfDoc(state.activeBookId);
        if (pdfDoc) {
          const scale = state.pdfZoom >= 140 ? 1.85 : 1.4;
          const dataUrl = await window.ManualBookEngine.renderPageToDataUrl(pdfDoc, p, {
            scale,
            maxWidth: 1500,
            quality: 0.88
          });
          img.onload = () => spinner.classList.add('hidden');
          img.src = dataUrl;
        } else {
          spinner.classList.add('hidden');
        }
      } catch (_) {
        spinner.classList.add('hidden');
      }
      applyPdfZoom();
      if (state.showExtractedText) fetchPageText(p);
      return;
    }

    const dpi = state.pdfZoom >= 140 ? 200 : 150;
    img.onload = () => spinner.classList.add('hidden');
    img.onerror = async () => {
      if (hasLiveBackend) {
        spinner.classList.add('hidden');
        return;
      }
      if (window.ManualBookEngine) {
        const pdfDoc = await ensureBuiltInFordPdfDoc();
        if (pdfDoc) {
          img.onerror = null;
          const dataUrl = await window.ManualBookEngine.renderPageToDataUrl(pdfDoc, p, {
            scale: state.pdfZoom >= 140 ? 1.85 : 1.4,
            maxWidth: 1500,
            quality: 0.88
          });
          img.src = dataUrl;
          return;
        }
      }
      spinner.classList.add('hidden');
      img.classList.add('hidden');
      if (iframe) {
        iframe.classList.remove('hidden');
        iframe.src = `../Ford_Fiesta_Fusion_TR_Carinfo.com.ua_compressed.pdf#page=${p}`;
      }
    };
    img.src = hasLiveBackend ? `./api/page/${p}/image?dpi=${dpi}` : `./media/pages/p_${p}.jpg`;
    applyPdfZoom();

    if (state.showExtractedText) {
      fetchPageText(p);
    }
  }

  function applyPdfZoom() {
    $('pdfZoomLabel').textContent = `${state.pdfZoom}%`;
    const img = $('pdfRenderedImage');
    if (state.pdfZoom === 100) {
      img.style.maxWidth = '100%';
      img.style.width = 'auto';
    } else {
      img.style.maxWidth = 'none';
      img.style.width = `${state.pdfZoom}%`;
    }
  }

  async function fetchPageText(p) {
    try {
      if (state.activeBookId !== 'ford-fiesta-fusion') {
        const entry = state.activePagesText && state.activePagesText[p - 1];
        if (entry && entry.text) {
          $('pageExtractedTextContent').textContent = entry.text;
          return;
        }
        const pdfDoc = await ensureUploadedPdfDoc(state.activeBookId);
        if (pdfDoc) {
          const page = await pdfDoc.getPage(p);
          const tc = await page.getTextContent();
          const str = (tc.items || []).map((i) => i.str).join(' ').trim();
          $('pageExtractedTextContent').textContent = str || '(На этой странице только скан/изображение без текстового слоя)';
          return;
        }
      }

      if (!hasLiveBackend) {
        if (!fordStaticPagesText) {
          fordStaticPagesText = await fetch('./data/pages_text.json').then((r) => r.json());
        }
        const entry = fordStaticPagesText[p - 1];
        $('pageExtractedTextContent').textContent = (entry && entry.text) || '(На этой странице только изображение без текстового слоя)';
        return;
      }
      const res = await fetch(`./api/page/${p}/text`);
      const data = await res.json();
      $('pageExtractedTextContent').textContent = data.text || '(На этой странице только изображение без текстового слоя)';
    } catch (_) {
      $('pageExtractedTextContent').textContent = 'Не удалось загрузить текст страницы.';
    }
  }

  /* OBD-II DTC Table */
  function renderDtcTable() {
    if (!state.manual) return;
    const rawQ = ($('dtcSearchInput').value || '').trim();
    const normCodeQ = rawQ.toUpperCase()
      .replace(/Р/g, 'P')
      .replace(/В/g, 'B')
      .replace(/С/g, 'C')
      .replace(/О/g, '0');
    const qLower = rawQ.toLowerCase();

    const filtered = (state.manual.dtcCodes || []).filter((d) => {
      if (state.dtcCategory !== 'ALL' && d.category !== state.dtcCategory) return false;
      if (!rawQ) return true;
      return d.code.toUpperCase().includes(normCodeQ) || d.description.toLowerCase().includes(qLower);
    });

    $('dtcTableBody').innerHTML = filtered.map((d) => `
      <tr>
        <td><span class="dtc-code-pill">${escapeHtml(d.code)}</span></td>
        <td style="color:#94a3b8;font-size:0.82rem;">${escapeHtml(d.categoryName)}</td>
        <td>${escapeHtml(d.description)}</td>
        <td>
          <button class="btn-ghost-sm" data-dtcpdf="${d.pdfPage}">Стр. ${d.bookPage}</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:24px;">Коды ошибок по фильтру не найдены (используйте глобальный поиск / в шапке для поиска по тексту страниц)</td></tr>`;

    $('dtcTableBody').querySelectorAll('[data-dtcpdf]').forEach((btn) => {
      btn.addEventListener('click', () => openPdfPageInViewer(btn.dataset.dtcpdf));
    });
  }

  /* Specs, Maintenance, Fluids, Lamps */
  function renderSpecsTab() {
    if (!state.manual) return;
    renderMaintenanceGrid();
    renderTorquesTable();

    $('fluidsTableBody').innerHTML = (state.manual.fluids || []).map((f) => `
      <tr>
        <td><strong>${escapeHtml(f.node)}</strong></td>
        <td><span class="torque-val-pill">${escapeHtml(f.volume)}</span></td>
        <td style="color:#cbd5e1;">${escapeHtml(f.spec)}</td>
      </tr>
    `).join('');

    $('lampsTableBody').innerHTML = (state.manual.lamps || []).map((l) => `
      <tr>
        <td>${escapeHtml(l.light)}</td>
        <td><span class="dtc-code-pill">${escapeHtml(l.type)}</span></td>
        <td style="font-family:var(--font-mono);">${escapeHtml(l.watts)}</td>
      </tr>
    `).join('');
  }

  function renderMaintenanceGrid() {
    if (!state.manual) return;
    const kmKey = state.selectedMileage;
    $('maintenanceCardsGrid').innerHTML = (state.manual.maintenance || []).map((m) => {
      const action = m[kmKey] || 'Проверка';
      const isReplace = action.toLowerCase().includes('замена');
      const targetPdfP = state.activeBookId === 'ford-fiesta-fusion' ? m.page + 1 : m.page;
      return `
        <div class="maint-card ${isReplace ? 'replace' : 'inspect'}">
          <div>
            <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px;">${escapeHtml(m.item)}</div>
            <button class="btn-ghost-sm" style="padding:2px 7px;font-size:0.74rem;" data-maint-page="${targetPdfP}">Стр. ${m.page}</button>
          </div>
          <span class="maint-badge ${isReplace ? 'replace' : 'inspect'}">${escapeHtml(action)}</span>
        </div>
      `;
    }).join('');

    $('maintenanceCardsGrid').querySelectorAll('[data-maint-page]').forEach((btn) => {
      btn.addEventListener('click', () => openPdfPageInViewer(btn.dataset.maintPage));
    });
  }

  function renderTorquesTable() {
    if (!state.manual) return;
    const q = ($('torqueFilterInput').value || '').trim().toLowerCase();
    const rows = (state.manual.torques || []).filter((t) =>
      !q || (`${t.group} ${t.part} ${t.nm}`).toLowerCase().includes(q)
    );
    $('torquesTableBody').innerHTML = rows.map((t) => `
      <tr>
        <td style="color:#94a3b8;white-space:nowrap;">${escapeHtml(t.group)}</td>
        <td>${escapeHtml(t.part)}</td>
        <td><span class="torque-val-pill">${escapeHtml(t.nm)}</span></td>
      </tr>
    `).join('');
  }

  /* Global Instant Search (Searches Active Book — Ford OR Uploaded PDF) */
  let searchTimer = null;
  function setupGlobalSearch() {
    const input = $('globalSearchInput');
    const dropdown = $('searchDropdown');

    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if (q.length < 2) {
        dropdown.classList.add('hidden');
        return;
      }
      searchTimer = setTimeout(async () => {
        try {
          if (state.activeBookId === 'ford-fiesta-fusion' && hasLiveBackend) {
            const res = await fetch(`./api/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
              const data = await res.json();
              renderSearchResults(data);
              return;
            }
          }

          let pagesPool = state.activePagesText;
          if (state.activeBookId === 'ford-fiesta-fusion' && !pagesPool) {
            try {
              fordStaticPagesText = await fetch('./data/pages_text.json').then((r) => r.json());
              pagesPool = fordStaticPagesText;
            } catch (_) {
              pagesPool = [];
            }
          }

          const ql = q.toLowerCase();
          const cyrNorm = q.toUpperCase().replace(/Р/g, 'P').replace(/В/g, 'B').replace(/С/g, 'C').replace(/О/g, '0');
          const tocHits = [];
          (state.manual?.sections || []).forEach((s) => {
            s.items.forEach((it) => {
              if (it.title.toLowerCase().includes(ql)) {
                tocHits.push({ section: s.title, title: it.title, bookPage: it.bookPage, pdfPage: it.pdfPage });
              }
            });
          });
          const pageHits = [];
          for (const pg of (pagesPool || [])) {
            if (!pg.text) continue;
            const idx = pg.text.toLowerCase().indexOf(ql);
            if (idx !== -1) {
              const s = Math.max(0, idx - 80);
              const e = Math.min(pg.text.length, idx + 150);
              pageHits.push({
                pdfPage: pg.pdfPage,
                bookPage: pg.bookPage,
                snippet: (s > 0 ? '…' : '') + pg.text.slice(s, e) + (e < pg.text.length ? '…' : '')
              });
              if (pageHits.length >= 25) break;
            }
          }
          renderSearchResults({
            query: q,
            guides: state.guides.filter((g) => (`${g.title} ${g.section}`).toLowerCase().includes(ql)),
            toc: tocHits.slice(0, 20),
            dtc: (state.manual?.dtcCodes || []).filter((d) => d.code.toUpperCase().includes(cyrNorm) || d.description.toLowerCase().includes(ql)).slice(0, 20),
            diagrams: (state.manual?.wiringDiagrams || []).filter((w) => (`${w.code} ${w.title} ${w.components}`).toLowerCase().includes(ql)).slice(0, 15),
            pages: pageHits
          });
        } catch (_) {}
      }, 160);
    });

    $('closeSearchBtn').addEventListener('click', () => {
      dropdown.classList.add('hidden');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
        $('lightboxModal').classList.add('hidden');
        $('pipelineModal').classList.add('hidden');
      }
    });
  }

  function renderSearchResults(data) {
    const dropdown = $('searchDropdown');
    const body = $('searchResultsBody');
    const total = data.guides.length + data.toc.length + data.dtc.length + data.diagrams.length + data.pages.length;

    $('searchStatusText').textContent = `Найдено совпадений по «${data.query}»: ${total}`;
    dropdown.classList.remove('hidden');

    if (total === 0) {
      body.innerHTML = `<div style="color:#94a3b8;padding:12px;">По запросу ничего не найдено в активной книге.</div>`;
      return;
    }

    const parts = [];

    if (data.guides.length) {
      parts.push(`
        <div class="search-group">
          <h4>🎬 Озвученные видеогиды (${data.guides.length})</h4>
          ${data.guides.map((g) => `
            <div class="search-hit-item" data-hit-guide="${escapeHtml(g.slug)}">
              <div><strong>${escapeHtml(g.title)}</strong><div class="search-hit-snippet">Видео с закадровым голосом • Стр. ${escapeHtml(g.bookPages)}</div></div>
              <span class="torque-val-pill">▶ Смотреть</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    if (data.dtc.length) {
      parts.push(`
        <div class="search-group">
          <h4>⚡ Коды неисправностей OBD-II (${data.dtc.length})</h4>
          ${data.dtc.map((d) => `
            <div class="search-hit-item" data-hit-pdf="${d.pdfPage}">
              <div><span class="dtc-code-pill">${escapeHtml(d.code)}</span> <strong>${escapeHtml(d.description)}</strong></div>
              <span class="btn-ghost-sm">Стр. ${d.bookPage}</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    if (data.diagrams.length) {
      parts.push(`
        <div class="search-group">
          <h4>🔌 Схемы (${data.diagrams.length})</h4>
          ${data.diagrams.map((w) => `
            <div class="search-hit-item" data-hit-pdf="${w.pdfPage}">
              <div><strong>${escapeHtml(w.code)}. ${escapeHtml(w.title)}</strong><div class="search-hit-snippet">${escapeHtml(w.components.slice(0, 150))}…</div></div>
              <span class="btn-ghost-sm">Стр. ${w.bookPage}</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    if (data.toc.length) {
      parts.push(`
        <div class="search-group">
          <h4>📑 Подразделы руководства (${data.toc.length})</h4>
          ${data.toc.slice(0, 8).map((t) => `
            <div class="search-hit-item" data-hit-pdf="${t.pdfPage}">
              <div><strong>${escapeHtml(t.title)}</strong><div class="search-hit-snippet">${escapeHtml(t.section)}</div></div>
              <span class="btn-ghost-sm">Стр. ${t.bookPage}</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    if (data.pages.length) {
      parts.push(`
        <div class="search-group">
          <h4>📄 Совпадения по тексту страниц (${data.pages.length})</h4>
          ${data.pages.slice(0, 12).map((p) => `
            <div class="search-hit-item" data-hit-pdf="${p.pdfPage}">
              <div><strong>Страница PDF ${p.pdfPage}</strong><div class="search-hit-snippet">${escapeHtml(p.snippet)}</div></div>
              <span class="btn-ghost-sm">Открыть PDF</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    body.innerHTML = parts.join('');

    body.querySelectorAll('[data-hit-guide]').forEach((el) => {
      el.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        switchTab('player');
        const g = state.guides.find((item) => item.slug === el.dataset.hitGuide);
        if (g) selectGuide(g);
      });
    });

    body.querySelectorAll('[data-hit-pdf]').forEach((el) => {
      el.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        openPdfPageInViewer(el.dataset.hitPdf);
      });
    });
  }

  /* Voice Commands (Web Speech API) */
  function toggleVoiceControl() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = $('voiceControlToggleBtn');
    if (!SpeechRecognition) {
      alert('Ваш браузер не поддерживает Web Speech API (откройте в Chrome/Edge для голосового управления или используйте клавиши Пробел / Стрелки).');
      return;
    }

    if (state.voiceListening && state.speechRec) {
      state.voiceListening = false;
      state.speechRec.stop();
      btn.classList.remove('listening');
      btn.textContent = '🎤 Голосовые команды: ВЫКЛ';
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'ru-RU';
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (ev) => {
      const transcript = ev.results[ev.results.length - 1][0].transcript.toLowerCase();
      if (transcript.includes('дальше') || transcript.includes('следующ')) {
        goNextStage(true);
      } else if (transcript.includes('назад') || transcript.includes('предыдущ')) {
        goPrevStage(true);
      } else if (transcript.includes('повтор')) {
        playCurrentHandsFreeStage(true);
      } else if (transcript.includes('пауз') || transcript.includes('стоп')) {
        pauseCurrentHandsFreeStage();
      } else if (transcript.includes('пуск') || transcript.includes('играй')) {
        playCurrentHandsFreeStage(false);
      }
    };

    rec.onend = () => {
      if (state.voiceListening) {
        try { rec.start(); } catch (_) {}
      }
    };

    state.speechRec = rec;
    state.voiceListening = true;
    rec.start();
    btn.classList.add('listening');
    btn.textContent = '🎤 Слушаю: «дальше / повтори / пауза»';
  }

  function goPrevStage(autoPlay = false) {
    if (!state.currentGuide || state.currentChapterIdx <= 0) return;
    stopAllPlayback();
    state.currentChapterIdx--;
    state.currentStepInChapterIdx = 0;
    state.manualStepOverride = false;
    renderHandsFreeStage(autoPlay);
  }

  function goNextStage(autoPlay = false) {
    if (!state.currentGuide || state.currentChapterIdx >= state.currentGuide.chapters.length - 1) return;
    stopAllPlayback();
    state.currentChapterIdx++;
    state.currentStepInChapterIdx = 0;
    state.manualStepOverride = false;
    renderHandsFreeStage(autoPlay);
  }

  /* =========================================================================
   * Real PDF Upload Modal & Processing Workflow
   * ========================================================================= */
  function openUploadModal(prefillModel) {
    $('pipelineModal').classList.remove('hidden');
    $('uploadProgressWrap').classList.add('hidden');
    $('demoPipelineLog').classList.add('hidden');
    if (prefillModel && typeof prefillModel === 'string') {
      const parts = prefillModel.split(' ');
      $('uploadBrandInput').value = parts[0] || '';
      $('uploadModelInput').value = parts.slice(1).join(' ') || prefillModel;
    }
  }

  function handleFileChosen(file) {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      alert('Пожалуйста, выберите файл в формате .pdf');
      return;
    }
    state.pendingPdfFile = file;
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    $('selectedFileLabel').textContent = `✅ Выбран файл: ${file.name} (${mb} МБ)`;
    $('uploadDropzone').classList.add('has-file');
    $('startProcessPdfBtn').disabled = false;

    if (window.ManualBookEngine) {
      const guessed = window.ManualBookEngine.guessBookNameFromFilename(file.name);
      const words = guessed.split(' ');
      if (!$('uploadBrandInput').value.trim()) {
        $('uploadBrandInput').value = words[0] || 'Авто';
      }
      if (!$('uploadModelInput').value.trim()) {
        $('uploadModelInput').value = words.slice(1).join(' ') || guessed;
      }
    }
  }

  async function runRealPdfUpload() {
    const file = state.pendingPdfFile;
    if (!file || !window.ManualBookEngine) return;

    const btn = $('startProcessPdfBtn');
    const progWrap = $('uploadProgressWrap');
    const progFill = $('uploadProgressFill');
    const progText = $('uploadProgressStageText');
    const progPct = $('uploadProgressPct');

    btn.disabled = true;
    progWrap.classList.remove('hidden');
    $('demoPipelineLog').classList.add('hidden');

    try {
      const userMeta = {
        category: $('uploadCategorySelect').value || 'cars',
        brand: $('uploadBrandInput').value.trim(),
        model: $('uploadModelInput').value.trim(),
        engines: $('uploadEnginesInput').value.trim()
      };

      const { bookRecord, pdfDoc } = await window.ManualBookEngine.processUploadedPdf(
        file,
        userMeta,
        (pct, stageMsg) => {
          progFill.style.width = `${pct}%`;
          progPct.textContent = `${pct}%`;
          progText.textContent = stageMsg;
        }
      );

      state.loadedPdfDocs.set(bookRecord.id, pdfDoc);
      state.uploadedBooks = [bookRecord, ...state.uploadedBooks.filter((b) => b.id !== bookRecord.id)];

      // Optional non-blocking backup upload if backend server is running
      if (hasLiveBackend) {
        fetch(`./api/books/upload?name=${encodeURIComponent(file.name)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: file
        }).catch(() => {});
      }

      // Reset modal state & activate the newly uploaded book immediately!
      state.pendingPdfFile = null;
      $('pdfUploadFileInput').value = '';
      $('selectedFileLabel').textContent = 'Перетащите PDF-файл сюда или нажмите кнопку ниже';
      $('uploadDropzone').classList.remove('has-file');
      $('uploadBrandInput').value = '';
      $('uploadModelInput').value = '';
      $('uploadEnginesInput').value = '';
      $('pipelineModal').classList.add('hidden');

      await activateBook(bookRecord.id);
      switchTab('player');
    } catch (err) {
      console.error('Ошибка обработки PDF:', err);
      progText.textContent = `Ошибка чтения PDF: ${err && err.message ? err.message : 'поврежденный или защищенный паролем файл'}`;
      btn.disabled = false;
    }
  }

  function runPipelineLog(title) {
    const log = $('demoPipelineLog');
    log.classList.remove('hidden');
    log.innerHTML = '';
    const steps = [
      `[1/4] Загрузка документа «${title}» — выделение текстового слоя, таблиц и координат иллюстраций…`,
      `[2/4] Технический разбор узлов: привязка моментов затяжки (Н·м), давлений МПа и предупреждений безопасности к шагам…`,
      `[3/4] Генерация дикторского сценария без аббревиатур и синтез русской голосовой дорожки…`,
      `[4/4] Сборка HD-видеокарточек с телеметрией и плеера «Свободные руки» — выберите любой реальный .pdf выше, чтобы загрузить свою книгу!`
    ];
    steps.forEach((line, i) => {
      setTimeout(() => {
        const div = document.createElement('div');
        div.textContent = line;
        log.appendChild(div);
      }, i * 380);
    });
  }

  function populateVoiceSelector() {
    const sel = $('ttsVoiceSelect');
    if (!sel || !window.ManualBookEngine) return;
    const fill = () => {
      const voices = window.ManualBookEngine.SpeechEngine.getRussianVoices();
      if (!voices.length) {
        sel.innerHTML = `<option value="">Автоматический русский голос</option>`;
        return;
      }
      sel.innerHTML = voices.map((v) =>
        `<option value="${escapeHtml(v.voiceURI)}">🎙 ${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`
      ).join('');
    };
    fill();
    if (window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', fill);
    }
    sel.addEventListener('change', () => {
      window.ManualBookEngine.SpeechEngine.preferredVoiceURI = sel.value;
    });
  }

  /* =========================================================================
   * AI Book-to-Short-Video Agent & Live 60 FPS Hands-Free Action Loop
   * ========================================================================= */
  async function ensureBuiltInFordPdfDoc() {
    if (state.builtInPdfDoc) return state.builtInPdfDoc;
    if (!window.pdfjsLib) return null;
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.js';
    }
    try {
      const task = window.pdfjsLib.getDocument({
        url: '../Ford_Fiesta_Fusion_TR_Carinfo.com.ua_compressed.pdf',
        cMapUrl: './vendor/pdfjs/cmaps/',
        cMapPacked: true
      });
      state.builtInPdfDoc = await task.promise;
      return state.builtInPdfDoc;
    } catch (_) {
      return null;
    }
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = url;
    });
  }

  function sliceImageIntoThreeZones(img) {
    if (!img || !img.width || !img.height) return [];
    const zones = [
      { x: 0.03, y: 0.06, w: 0.94, h: 0.42 },
      { x: 0.03, y: 0.30, w: 0.94, h: 0.44 },
      { x: 0.03, y: 0.52, w: 0.94, h: 0.43 }
    ];
    return zones.map((z) => {
      const c = document.createElement('canvas');
      const sw = Math.max(16, Math.round(img.width * z.w));
      const sh = Math.max(16, Math.round(img.height * z.h));
      c.width = sw;
      c.height = sh;
      c.getContext('2d').drawImage(
        img,
        Math.round(img.width * z.x),
        Math.round(img.height * z.y),
        sw,
        sh,
        0,
        0,
        sw,
        sh
      );
      return c;
    });
  }

  async function loadCropsForPdfPage(pdfPage) {
    const p = Math.min(state.totalPdfPages, Math.max(1, parseInt(pdfPage, 10) || 1));

    // 1. User-uploaded PDF book from IndexedDB
    if (state.activeBookId !== 'ford-fiesta-fusion' && window.ManualBookEngine) {
      const pdfDoc = await ensureUploadedPdfDoc(state.activeBookId);
      if (pdfDoc) {
        const fullDataUrl = await window.ManualBookEngine.renderPageToDataUrl(pdfDoc, p, { scale: 1.5, maxWidth: 1100, quality: 0.88 });
        const im = await loadImageFromUrl(fullDataUrl);
        if (im) return sliceImageIntoThreeZones(im);
      }
    }

    // 2. Live Express backend page render
    if (hasLiveBackend && state.activeBookId === 'ford-fiesta-fusion') {
      const im = await loadImageFromUrl(`./api/page/${p}/image?dpi=150`);
      if (im) return sliceImageIntoThreeZones(im);
    }

    // 3. Static GitHub Pages: render directly from ../Ford_Fiesta_Fusion_TR_Carinfo.com.ua_compressed.pdf via PDF.js!
    if (window.ManualBookEngine && state.activeBookId === 'ford-fiesta-fusion') {
      const pdfDoc = await ensureBuiltInFordPdfDoc();
      if (pdfDoc) {
        const fullDataUrl = await window.ManualBookEngine.renderPageToDataUrl(pdfDoc, p, { scale: 1.5, maxWidth: 1100, quality: 0.88 });
        const im = await loadImageFromUrl(fullDataUrl);
        if (im) return sliceImageIntoThreeZones(im);
      }
    }

    // 4. Fallback studio colorful poster
    const fallbackIm = await loadImageFromUrl('./media/posters/oil-hero.jpg');
    return fallbackIm ? [fallbackIm] : [];
  }

  async function refreshAgentWorkspace() {
    if (!window.BookVideoAgent) return;
    const bookName = state.activeBookId === 'ford-fiesta-fusion'
      ? 'Ford Fiesta / Fusion'
      : ((state.uploadedBooks.find((b) => b.id === state.activeBookId) || {}).fullTitle || 'Загруженная книга');

    state.agentProcedures = window.BookVideoAgent.scanBookForProcedures(
      state.manual,
      state.activePagesText,
      bookName
    );

    $('agentOpsCountBadge').textContent = `${state.agentProcedures.length} опер.`;
    $('agentTotalFoundCount').textContent = String(state.agentProcedures.length);
    renderAgentProceduresSidebar();

    if (state.agentProcedures.length > 0) {
      await runAgentForProcedure(state.agentProcedures[0], false);
    }
  }

  function renderAgentProceduresSidebar() {
    const q = ($('agentProcSearchInput').value || '').trim().toLowerCase();
    const filtered = state.agentProcedures.filter((p) => {
      if (state.agentCategory !== 'all') {
        if (state.agentCategory === 'transmission') {
          if (p.category !== 'transmission' && p.category !== 'body_maint') return false;
        } else if (p.category !== state.agentCategory) {
          return false;
        }
      }
      if (!q) return true;
      return (`${p.title} ${p.sectionTitle}`).toLowerCase().includes(q);
    });

    $('agentProceduresList').innerHTML = filtered.slice(0, 80).map((p) => {
      const isAct = p.id === state.activeAgentProcId;
      return `
        <div class="agent-op-card ${isAct ? 'active' : ''}" data-aproc="${escapeHtml(p.id)}">
          <div class="aop-top">
            <div class="aop-title">${escapeHtml(p.title)}</div>
            <span class="torque-val-pill">~${p.estDurationSec} с</span>
          </div>
          <div class="aop-meta">Стр. ${p.bookPage} • ${p.stepsText.length} шагов • ${escapeHtml(p.sectionTitle.slice(0, 38))}</div>
          <div class="aop-badges">
            ${p.actionsPreview.map((a) => `
              <span class="aop-chip" style="border-color:${escapeHtml(a.accent)}55;color:${escapeHtml(a.accent)};">
                ${escapeHtml(a.icon)} ${escapeHtml(a.specVal)}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }).join('') || '<div style="padding:14px;color:#94a3b8;font-size:0.85rem;">Операции по фильтру не найдены</div>';

    $('agentProceduresList').querySelectorAll('.agent-op-card').forEach((card) => {
      card.addEventListener('click', () => {
        const proc = state.agentProcedures.find((p) => p.id === card.dataset.aproc);
        if (proc) runAgentForProcedure(proc, true);
      });
    });
  }

  async function runAgentForProcedure(proc, autoPlay = true) {
    if (!window.BookVideoAgent || !shortAgentPlayer || !proc) return;
    stopAllPlayback();

    state.activeAgentProcId = proc.id;
    renderAgentProceduresSidebar();

    const pill = $('agentPhaseIndicator');
    const msgEl = $('agentStatusMessage');
    pill.classList.add('working');

    const shortVideo = await window.BookVideoAgent.generateAnimatedShortFromProcedure(
      proc,
      loadCropsForPdfPage,
      (phaseIdx, text) => {
        pill.textContent = `⚙️ Фаза ${phaseIdx}/5`;
        msgEl.textContent = text;
      }
    );

    pill.classList.remove('working');
    pill.textContent = '✅ Оживлено в цвете';

    state.currentShortVideo = shortVideo;
    shortAgentPlayer.loadShort(shortVideo);
    $('agentScrubber').max = String(shortVideo.totalDuration || 30);
    $('agentScrubber').value = '0';
    $('agentTimeLabel').textContent = `0:00 / ${fmtTime(shortVideo.totalDuration)}`;
    renderAgentStepsTimeline(shortVideo);

    if (autoPlay) {
      shortAgentPlayer.play();
    }
  }

  function renderAgentStepsTimeline(shortVideo) {
    $('agentStepsCountPill').textContent = `${shortVideo.steps.length} действий`;
    $('agentStepsTimeline').innerHTML = shortVideo.steps.map((st, idx) => `
      <div class="agent-step-row ${idx === 0 ? 'active' : ''}" data-astep="${idx}">
        <div class="asr-head">
          <span style="color:${escapeHtml(st.action.accent)};">${escapeHtml(st.action.icon)} Шаг ${st.num}: ${escapeHtml(st.action.badge)}</span>
          <span class="torque-val-pill">${escapeHtml(st.action.specVal)}</span>
        </div>
        <div class="asr-caption">${escapeHtml(st.caption)}</div>
      </div>
    `).join('');

    $('agentStepsTimeline').querySelectorAll('.agent-step-row').forEach((row) => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.astep, 10);
        const st = shortVideo.steps[idx];
        if (st && shortAgentPlayer) {
          shortAgentPlayer.seek(st.startTime + 0.05);
          shortAgentPlayer.play();
        }
      });
    });
  }

  function highlightAgentStepRow(stepIdx) {
    document.querySelectorAll('#agentStepsTimeline .agent-step-row').forEach((el, i) => {
      el.classList.toggle('active', i === stepIdx);
    });
  }

  async function animateArbitraryBookPage(pdfPage) {
    const p = Math.min(state.totalPdfPages, Math.max(1, parseInt(pdfPage, 10) || 1));
    switchTab('agent');

    // Find closest procedure on this page or synthesize directly from page text!
    const exact = state.agentProcedures.find((pr) => Math.abs(pr.pdfPage - p) <= 1);
    if (exact) {
      await runAgentForProcedure(exact, true);
      return;
    }

    const pgObj = (state.activePagesText && state.activePagesText[p - 1]) || { text: '' };
    const sentences = (pgObj.text || '')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 20 && s.length <= 180)
      .slice(0, 5);
    const stepsText = sentences.length >= 2 ? sentences : [
      `Изучите расположение узлов и крепежа на странице ${p} руководства.`,
      `Выполните демонтаж и установку с соблюдением моментов затяжки и мер безопасности.`
    ];
    const adHocProc = {
      id: `adhoc-p-${p}`,
      title: `Операция со страницы ${p}`,
      sectionTitle: `Страница PDF ${p}`,
      category: 'engine',
      pdfPage: p,
      bookPage: state.activeBookId === 'ford-fiesta-fusion' ? Math.max(1, p - 1) : p,
      stepsText,
      actionsPreview: [],
      hasTorque: false,
      estDurationSec: stepsText.length * 8,
      rawContext: pgObj.text || ''
    };
    await runAgentForProcedure(adHocProc, true);
  }

  function startHandsFreeActionLoop() {
    if (hfAnimRaf) return;
    const canvas = $('hfLiveActionCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const tick = (nowMs) => {
      if (
        state.activeTab === 'player' &&
        state.playerMode === 'steps' &&
        state.currentGuide &&
        window.BookVideoAgent
      ) {
        const ch = state.currentGuide.chapters[state.currentChapterIdx];
        const st = ch && (ch.steps[state.currentStepInChapterIdx] || ch.steps[0]);
        if (st) {
          const act = window.BookVideoAgent.classifyMechanicalAction(st.caption, st.tool, ch.keyMetric);
          ctx.fillStyle = '#080d1a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const tSec = nowMs / 1000;
          const prog = (tSec * 0.25) % 1;
          window.BookVideoAgent.drawAnimatedMechanismBox(
            ctx,
            { x: 4, y: 4, w: canvas.width - 8, h: canvas.height - 8 },
            act,
            tSec,
            prog
          );
        }
      }
      hfAnimRaf = requestAnimationFrame(tick);
    };
    hfAnimRaf = requestAnimationFrame(tick);
  }

  /* Bind Events & Init */
  async function init() {
    // Initialize ShortAnimatedVideoPlayer for AI Book-to-Video Agent tab
    if (window.BookVideoAgent) {
      shortAgentPlayer = new window.BookVideoAgent.ShortAnimatedVideoPlayer($('agentShortCanvas'), {
        onTimeUpdate: (cur, total) => {
          $('agentScrubber').value = String(cur);
          $('agentTimeLabel').textContent = `${fmtTime(cur)} / ${fmtTime(total)}`;
        },
        onStateChange: (isPlaying) => {
          $('agentPlayBtn').textContent = isPlaying ? '⏸ Пауза' : '▶ Пуск анимации с голосом';
        },
        onStepChange: (sIdx) => {
          highlightAgentStepRow(sIdx);
        }
      });
    }

    $('agentPlayBtn').addEventListener('click', () => {
      if (shortAgentPlayer) shortAgentPlayer.toggle();
    });
    $('agentShortCanvas').addEventListener('click', () => {
      if (shortAgentPlayer) shortAgentPlayer.toggle();
    });
    $('agentScrubber').addEventListener('input', (e) => {
      if (shortAgentPlayer) shortAgentPlayer.seek(parseFloat(e.target.value || '0'));
    });
    $('agentAspect916Btn').addEventListener('click', () => {
      $('agentAspect916Btn').classList.add('active');
      $('agentAspect169Btn').classList.remove('active');
      $('agentCanvasContainer').parentElement.classList.remove('wide-16-9');
      if (shortAgentPlayer) shortAgentPlayer.setAspect('9:16');
    });
    $('agentAspect169Btn').addEventListener('click', () => {
      $('agentAspect169Btn').classList.add('active');
      $('agentAspect916Btn').classList.remove('active');
      $('agentCanvasContainer').parentElement.classList.add('wide-16-9');
      if (shortAgentPlayer) shortAgentPlayer.setAspect('16:9');
    });
    $('agentColorizeToggle').addEventListener('change', (e) => {
      if (shortAgentPlayer) shortAgentPlayer.setColorize(e.target.checked);
    });
    $('agentSpeedSelect').addEventListener('change', (e) => {
      if (shortAgentPlayer) shortAgentPlayer.setRate(parseFloat(e.target.value || '1'));
    });
    $('agentOpenPdfPageBtn').addEventListener('click', () => {
      if (state.currentShortVideo) {
        openPdfPageInViewer(state.currentShortVideo.pdfPage);
      }
    });
    $('agentExportWebmBtn').addEventListener('click', () => {
      if (!shortAgentPlayer) return;
      const btn = $('agentExportWebmBtn');
      shortAgentPlayer.exportWebm((rec) => {
        btn.textContent = rec ? '⏺ Запись ролика…' : '⏺ Скачать ролик (.webm)';
        btn.disabled = rec;
      });
    });
    $('agentAutoNextBtn').addEventListener('click', () => {
      if (!state.agentProcedures.length) return;
      const curIdx = state.agentProcedures.findIndex((p) => p.id === state.activeAgentProcId);
      const nextProc = state.agentProcedures[(curIdx + 1) % state.agentProcedures.length];
      if (nextProc) runAgentForProcedure(nextProc, true);
    });
    $('agentUploadBookBtn').addEventListener('click', () => openUploadModal());
    $('agentProcSearchInput').addEventListener('input', renderAgentProceduresSidebar);
    document.querySelectorAll('#agentCatPills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.agentCategory = btn.dataset.acat;
        document.querySelectorAll('#agentCatPills .pill').forEach((p) => p.classList.toggle('active', p === btn));
        renderAgentProceduresSidebar();
      });
    });
    $('animateCurrentPageBtn').addEventListener('click', () => {
      animateArbitraryBookPage(state.currentPdfPage);
    });
    startHandsFreeActionLoop();
    // Initialize CanvasCinemaPlayer for user-uploaded books
    if (window.ManualBookEngine) {
      cinemaPlayer = new window.ManualBookEngine.CanvasCinemaPlayer($('synthVideoCanvas'), {
        onTimeUpdate: (cur, total) => {
          $('synthScrubber').value = String(cur);
          $('synthTimeLabel').textContent = `${fmtTime(cur)} / ${fmtTime(total)}`;
        },
        onStateChange: (isPlaying) => {
          $('synthPlayBtn').textContent = isPlaying ? '⏸ Пауза' : '▶ Пуск с озвучкой';
        },
        onChapterChange: (chIdx) => {
          if (chIdx !== state.currentChapterIdx) {
            highlightChapterRow(chIdx);
          }
        }
      });
      populateVoiceSelector();
    }

    $('synthPlayBtn').addEventListener('click', () => {
      if (cinemaPlayer) cinemaPlayer.toggle();
    });
    $('synthVideoCanvas').addEventListener('click', () => {
      if (cinemaPlayer) cinemaPlayer.toggle();
    });
    $('synthScrubber').addEventListener('input', (e) => {
      if (cinemaPlayer) cinemaPlayer.seek(parseFloat(e.target.value || '0'));
    });
    $('exportWebmBtn').addEventListener('click', () => {
      if (!cinemaPlayer) return;
      const btn = $('exportWebmBtn');
      cinemaPlayer.exportWebm((recording) => {
        btn.textContent = recording ? '⏺ Идет запись WebM…' : '⏺ Экспорт видео (.webm)';
        btn.disabled = recording;
      });
    });

    // Topbar controls
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    $('brandHome').addEventListener('click', () => switchTab('player'));
    $('activeBookSelect').addEventListener('change', (e) => activateBook(e.target.value));
    $('topUploadBookBtn').addEventListener('click', () => openUploadModal());

    // Mode switch
    $('modeVideoBtn').addEventListener('click', () => setPlayerMode('video'));
    $('modeStepBtn').addEventListener('click', () => setPlayerMode('steps'));

    // Video speed & chapter sync
    const videoEl = $('mainVideoPlayer');
    $('videoSpeedSelect').addEventListener('change', (e) => {
      const r = parseFloat(e.target.value || '1');
      videoEl.playbackRate = r;
      if (cinemaPlayer) cinemaPlayer.setRate(r);
    });

    videoEl.addEventListener('timeupdate', () => {
      const g = state.currentGuide;
      if (!g || g.isSynthesizedVideo || state.playerMode !== 'video') return;
      const t = videoEl.currentTime;
      const idx = g.chapters.findIndex((c) => t >= c.startTime && t < c.endTime);
      if (idx !== -1 && idx !== state.currentChapterIdx) {
        highlightChapterRow(idx);
      }
    });

    // Hands-Free Audio Controls
    const hfAudio = $('hfStageAudio');
    $('hfPlayPauseBtn').addEventListener('click', () => {
      const g = state.currentGuide;
      const ch = g && g.chapters[state.currentChapterIdx];
      if (ch && ch.synthesizedTts) {
        if (state.hfSpeakingTts) pauseCurrentHandsFreeStage();
        else {
          state.manualStepOverride = false;
          playCurrentHandsFreeStage(false);
        }
      } else if (hfAudio.paused) {
        state.manualStepOverride = false;
        hfAudio.play().catch(() => {});
      } else {
        hfAudio.pause();
      }
    });

    $('hfRepeatBtn').addEventListener('click', () => {
      state.manualStepOverride = false;
      state.currentStepInChapterIdx = 0;
      updateHandsFreeStepOnly();
      playCurrentHandsFreeStage(true);
    });

    $('hfPrevStageBtn').addEventListener('click', () => goPrevStage(true));
    $('hfNextStageBtn').addEventListener('click', () => goNextStage(true));
    $('voiceControlToggleBtn').addEventListener('click', toggleVoiceControl);

    hfAudio.addEventListener('play', updateHfPlayButtonLabel);
    hfAudio.addEventListener('pause', updateHfPlayButtonLabel);
    hfAudio.addEventListener('timeupdate', () => {
      if (state.manualStepOverride) return;
      const g = state.currentGuide;
      if (!g) return;
      const ch = g.chapters[state.currentChapterIdx];
      if (!ch || ch.synthesizedTts || !hfAudio.duration) return;
      const ratio = Math.min(0.999, hfAudio.currentTime / hfAudio.duration);
      const targetStep = Math.floor(ratio * ch.steps.length);
      if (targetStep !== state.currentStepInChapterIdx) {
        state.currentStepInChapterIdx = targetStep;
        updateHandsFreeStepOnly();
      }
    });

    hfAudio.addEventListener('ended', () => {
      updateHfPlayButtonLabel();
      if (!$('hfAutoPauseToggle').checked) {
        goNextStage(true);
      }
    });

    // Lightbox zoom
    const openLightbox = () => {
      $('lightboxImg').src = $('hfCurrentPhoto').src;
      $('lightboxTitle').textContent = $('hfStepCaption').textContent;
      $('lightboxModal').classList.remove('hidden');
    };
    $('hfZoomBtn').addEventListener('click', openLightbox);
    $('hfCurrentPhoto').addEventListener('click', openLightbox);
    $('closeLightboxBtn').addEventListener('click', () => $('lightboxModal').classList.add('hidden'));

    // Hotkeys in Hands-Free mode
    document.addEventListener('keydown', (e) => {
      if (state.activeTab !== 'player' || state.playerMode !== 'steps') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        $('hfPlayPauseBtn').click();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        goNextStage(true);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        goPrevStage(true);
      } else if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'к') {
        e.preventDefault();
        $('hfRepeatBtn').click();
      }
    });

    // Upload Modal Events (Click + Drag & Drop)
    $('openPipelineModalBtn').addEventListener('click', () => openUploadModal());
    $('simulateUploadBtn').addEventListener('click', () => openUploadModal());
    $('closePipelineModalBtn').addEventListener('click', () => $('pipelineModal').classList.add('hidden'));

    const fileInput = $('pdfUploadFileInput');
    const dropzone = $('uploadDropzone');
    $('choosePdfFileBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        handleFileChosen(fileInput.files[0]);
      }
    });
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileChosen(e.dataTransfer.files[0]);
      }
    });
    $('startProcessPdfBtn').addEventListener('click', runRealPdfUpload);

    document.querySelectorAll('.demo-run-btn').forEach((btn) => {
      btn.addEventListener('click', () => runPipelineLog(btn.dataset.preset));
    });

    // Catalog filters
    document.querySelectorAll('#catalogFilterPills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.catalogFilter = btn.dataset.cat;
        document.querySelectorAll('#catalogFilterPills .pill').forEach((p) => p.classList.toggle('active', p === btn));
        renderCatalog();
      });
    });

    // Book viewer controls
    $('bsTabToc').addEventListener('click', () => {
      state.bookSidebarMode = 'toc';
      $('bsTabToc').classList.add('active');
      $('bsTabDiagrams').classList.remove('active');
      $('bookTocContainer').classList.remove('hidden');
      $('bookDiagramsContainer').classList.add('hidden');
    });
    $('bsTabDiagrams').addEventListener('click', () => {
      state.bookSidebarMode = 'diagrams';
      $('bsTabDiagrams').classList.add('active');
      $('bsTabToc').classList.remove('active');
      $('bookDiagramsContainer').classList.remove('hidden');
      $('bookTocContainer').classList.add('hidden');
    });
    $('bookSidebarFilter').addEventListener('input', renderBookSidebar);

    $('pdfPrevPageBtn').addEventListener('click', () => loadPdfPage(state.currentPdfPage - 1));
    $('pdfNextPageBtn').addEventListener('click', () => loadPdfPage(state.currentPdfPage + 1));
    $('pdfPageInput').addEventListener('change', (e) => loadPdfPage(parseInt(e.target.value, 10)));
    $('zoomOutPdfBtn').addEventListener('click', () => {
      state.pdfZoom = Math.max(70, state.pdfZoom - 25);
      applyPdfZoom();
    });
    $('zoomInPdfBtn').addEventListener('click', () => {
      state.pdfZoom = Math.min(200, state.pdfZoom + 25);
      loadPdfPage(state.currentPdfPage);
    });
    $('togglePageTextBtn').addEventListener('click', () => {
      state.showExtractedText = !state.showExtractedText;
      $('pageExtractedTextBox').classList.toggle('hidden', !state.showExtractedText);
      if (state.showExtractedText) fetchPageText(state.currentPdfPage);
    });

    // DTC & Specs controls
    $('dtcSearchInput').addEventListener('input', renderDtcTable);
    document.querySelectorAll('#dtcCategoryPills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.dtcCategory = btn.dataset.dtcCat;
        document.querySelectorAll('#dtcCategoryPills .pill').forEach((p) => p.classList.toggle('active', p === btn));
        renderDtcTable();
      });
    });

    document.querySelectorAll('#mileageSelector .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedMileage = btn.dataset.km;
        document.querySelectorAll('#mileageSelector .pill').forEach((p) => p.classList.toggle('active', p === btn));
        renderMaintenanceGrid();
      });
    });
    $('torqueFilterInput').addEventListener('input', renderTorquesTable);

    setupGlobalSearch();

    // Load previously uploaded books from IndexedDB + built-in Ford datasets
    const uploadedPromise = window.ManualBookEngine
      ? window.ManualBookEngine.BookStorage.listBooks()
      : Promise.resolve([]);

    let guidesData, catalogData, manualData;
    try {
      const gRes = await fetch('./api/guides');
      if (!gRes.ok) throw new Error('static');
      [guidesData, catalogData, manualData] = await Promise.all([
        gRes.json(),
        fetch('./api/catalog').then((r) => r.json()),
        fetch('./api/manual').then((r) => r.json())
      ]);
      hasLiveBackend = true;
    } catch (_) {
      hasLiveBackend = false;
      const [rawGuides, catJson, manJson] = await Promise.all([
        fetch('./data/guides.json').then((r) => r.json()),
        fetch('./data/catalog.json').then((r) => r.json()),
        fetch('./data/manual_index.json').then((r) => r.json())
      ]);
      guidesData = { guides: rawGuides };
      catalogData = catJson;
      manualData = manJson;
    }

    state.uploadedBooks = await uploadedPromise;
    state.builtInFordBook = {
      guides: guidesData.guides || [],
      manual: manualData
    };
    state.baseCatalog = catalogData.items || [];

    await activateBook('ford-fiesta-fusion');
  }

  init().catch((err) => console.error('Init error:', err));
})();
