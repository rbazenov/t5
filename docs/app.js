(function () {
  'use strict';

  const state = {
    activeTab: 'player',
    guides: [],
    currentGuide: null,
    playerMode: 'video', // 'video' | 'steps'
    currentChapterIdx: 0,
    currentStepInChapterIdx: 0,
    manualStepOverride: false,
    checkedItems: {},
    catalog: [],
    catalogFilter: 'all',
    manual: null,
    bookSidebarMode: 'toc', // 'toc' | 'diagrams'
    currentPdfPage: 5,
    pdfZoom: 100,
    showExtractedText: false,
    dtcCategory: 'ALL',
    selectedMileage: 'km20',
    speechRec: null,
    voiceListening: false
  };

  try {
    state.checkedItems = JSON.parse(localStorage.getItem('mvpro_checklist') || '{}');
  } catch (_) {
    state.checkedItems = {};
  }

  const $ = (id) => document.getElementById(id);
  let hasLiveBackend = true;
  let staticPagesText = null;

  function assetUrl(u) {
    if (!u) return '';
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

  /* Navigation */
  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });
    if (tabId !== 'player') {
      const v = $('mainVideoPlayer');
      const a = $('hfStageAudio');
      if (v && !v.paused) v.pause();
      if (a && !a.paused) a.pause();
    }
  }

  function openPdfPageInViewer(pdfPage) {
    const p = Math.min(385, Math.max(1, parseInt(pdfPage, 10) || 1));
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
    const v = $('mainVideoPlayer');
    const a = $('hfStageAudio');
    if (v) v.pause();
    if (a) a.pause();

    state.currentGuide = guide;
    state.currentChapterIdx = 0;
    state.currentStepInChapterIdx = 0;
    state.manualStepOverride = false;

    renderGuideStrip();
    renderVideoPlayer(guide);
    renderHandsFreeStage();
    renderChaptersList();
    renderSidePassport(guide);
  }

  function setPlayerMode(mode) {
    state.playerMode = mode;
    $('modeVideoBtn').classList.toggle('active', mode === 'video');
    $('modeStepBtn').classList.toggle('active', mode === 'steps');
    $('videoModeContainer').classList.toggle('hidden', mode !== 'video');
    $('videoExtraControls').classList.toggle('hidden', mode !== 'video');
    $('stepsModeContainer').classList.toggle('hidden', mode !== 'steps');

    const v = $('mainVideoPlayer');
    const a = $('hfStageAudio');
    if (mode === 'video') {
      if (a && !a.paused) a.pause();
    } else {
      if (v && !v.paused) v.pause();
      renderHandsFreeStage();
    }
  }

  function renderVideoPlayer(guide) {
    const v = $('mainVideoPlayer');
    v.src = assetUrl(guide.videoUrl);
    v.poster = assetUrl(guide.posterUrl);
    v.playbackRate = parseFloat($('videoSpeedSelect').value || '1');

    const dl = $('downloadMp4Link');
    dl.href = assetUrl(guide.videoUrl);
    dl.setAttribute('download', `ford_${guide.slug}.mp4`);

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
          const v = $('mainVideoPlayer');
          const targetCh = g.chapters[idx];
          if (targetCh) {
            v.currentTime = targetCh.startTime + 0.05;
            v.play().catch(() => {});
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

  /* Hands-Free Step Mode */
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

    // Step thumbnails
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
    const relAudio = assetUrl(ch.audioUrl);
    if (!audio.getAttribute('data-cur') || audio.getAttribute('data-cur') !== relAudio) {
      audio.setAttribute('data-cur', relAudio);
      audio.src = relAudio;
    }
    updateHfPlayButtonLabel();
    highlightChapterRow(state.currentChapterIdx);

    if (autoPlay) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
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
    if (!audio || audio.paused) {
      btn.textContent = '🔊 Озвучить этап';
    } else {
      btn.textContent = '⏸ Пауза озвучки';
    }
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

    const allItems = [
      ...guide.tools.map((t) => ({ id: `${guide.slug}:tool:${t}`, label: t })),
      ...guide.consumables.map((c) => ({ id: `${guide.slug}:cons:${c}`, label: c }))
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

  /* Catalog Tab */
  function renderCatalog() {
    const items = state.catalog.filter((it) =>
      state.catalogFilter === 'all' ? true : it.category === state.catalogFilter
    );
    $('catalogGrid').innerHTML = items.map((it) => {
      const isActive = it.status === 'active';
      const coverHtml = it.coverUrl
        ? `<img class="cat-cover" src="${escapeHtml(assetUrl(it.coverUrl))}" alt="${escapeHtml(it.model)}" />`
        : `<div class="cat-placeholder-cover"><span>${escapeHtml(it.brand)}</span><small style="color:#94a3b8;font-weight:600;margin-top:6px;">PDF B2B</small></div>`;
      const topicsHtml = it.sampleTopics
        ? `<div class="cat-topics"><strong>Востребованные видеоузлы для бригад:</strong><ul>${it.sampleTopics.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></div>`
        : '';

      return `
        <div class="cat-card ${isActive ? 'active-manual' : ''}">
          <div>
            <div class="cat-card-top">
              ${coverHtml}
              <div>
                <span class="cat-status-badge ${isActive ? 'active' : 'pipeline'}">${escapeHtml(it.statusLabel)}</span>
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
            ${isActive
              ? `<button class="btn-primary" style="width:100%;" data-open-ford="1">▶ Открыть видеогиды и книгу Ford</button>`
              : `<button class="btn-secondary" style="width:100%;" data-sim-model="${escapeHtml(it.brand + ' ' + it.model)}">⚙ Показать генерацию видео из мануала</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    $('catalogGrid').querySelectorAll('[data-open-ford]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab('player'));
    });
    $('catalogGrid').querySelectorAll('[data-sim-model]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openPipelineDemo(btn.dataset.simModel);
      });
    });
  }

  /* Book TOC + Wiring Diagrams + High-DPI PDF Viewer */
  function renderBookSidebar() {
    if (!state.manual) return;
    const filter = ($('bookSidebarFilter').value || '').trim().toLowerCase();

    // TOC
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

    // Wiring diagrams
    const diags = state.manual.wiringDiagrams.filter((d) =>
      !filter || (`${d.code} ${d.title} ${d.components}`).toLowerCase().includes(filter)
    );
    $('bookDiagramsContainer').innerHTML = diags.map((d) => `
      <div class="diagram-item" data-pdfp="${d.pdfPage}">
        <div style="display:flex;justify-content:space-between;">
          <strong>${escapeHtml(d.code)}. ${escapeHtml(d.title)}</strong>
          <span style="font-family:var(--font-mono);font-size:0.75rem;color:#f59e0b;">стр. ${d.bookPage}</span>
        </div>
        <div style="font-size:0.76rem;color:#94a3b8;margin-top:3px;">${escapeHtml(d.components.slice(0, 140))}${d.components.length > 140 ? '…' : ''}</div>
      </div>
    `).join('');

    $('bookDiagramsContainer').querySelectorAll('[data-pdfp]').forEach((el) => {
      el.addEventListener('click', () => loadPdfPage(parseInt(el.dataset.pdfp, 10)));
    });
  }

  function loadPdfPage(pdfPage) {
    const p = Math.min(385, Math.max(1, pdfPage || 1));
    state.currentPdfPage = p;
    $('pdfPageInput').value = p;
    $('bookPageNumberHint').textContent = p > 1 ? `(Стр. книги: ${p - 1})` : '(Обложка)';

    const spinner = $('pdfLoadingSpinner');
    const img = $('pdfRenderedImage');
    spinner.classList.remove('hidden');

    const spinner = $('pdfLoadingSpinner');
    const img = $('pdfRenderedImage');
    const iframe = $('staticPdfIframe');
    spinner.classList.remove('hidden');
    if (iframe) iframe.classList.add('hidden');
    img.classList.remove('hidden');

    const dpi = state.pdfZoom >= 140 ? 200 : 150;
    img.onload = () => spinner.classList.add('hidden');
    img.onerror = () => {
      spinner.classList.add('hidden');
      if (hasLiveBackend) return;
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
      if (!hasLiveBackend) {
        if (!staticPagesText) {
          staticPagesText = await fetch('./data/pages_text.json').then((r) => r.json());
        }
        const entry = staticPagesText[p - 1];
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

    const filtered = state.manual.dtcCodes.filter((d) => {
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
    `).join('') || `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:24px;">Коды по запросу не найдены</td></tr>`;

    $('dtcTableBody').querySelectorAll('[data-dtcpdf]').forEach((btn) => {
      btn.addEventListener('click', () => openPdfPageInViewer(btn.dataset.dtcpdf));
    });
  }

  /* Specs, Maintenance, Fluids, Lamps */
  function renderSpecsTab() {
    if (!state.manual) return;

    renderMaintenanceGrid();
    renderTorquesTable();

    $('fluidsTableBody').innerHTML = state.manual.fluids.map((f) => `
      <tr>
        <td><strong>${escapeHtml(f.node)}</strong></td>
        <td><span class="torque-val-pill">${escapeHtml(f.volume)}</span></td>
        <td style="color:#cbd5e1;">${escapeHtml(f.spec)}</td>
      </tr>
    `).join('');

    $('lampsTableBody').innerHTML = state.manual.lamps.map((l) => `
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
    $('maintenanceCardsGrid').innerHTML = state.manual.maintenance.map((m) => {
      const action = m[kmKey] || 'Проверка';
      const isReplace = action.toLowerCase().includes('замена');
      return `
        <div class="maint-card ${isReplace ? 'replace' : 'inspect'}">
          <div>
            <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px;">${escapeHtml(m.item)}</div>
            <button class="btn-ghost-sm" style="padding:2px 7px;font-size:0.74rem;" data-maint-page="${m.page + 1}">Стр. ${m.page}</button>
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
    const rows = state.manual.torques.filter((t) =>
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

  /* Global Instant Search */
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
          if (hasLiveBackend) {
            const res = await fetch(`./api/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
              const data = await res.json();
              renderSearchResults(data);
              return;
            }
          }
          // Static fallback search across guides, TOC, DTC, wiring diagrams, and all 385 pages
          if (!staticPagesText) {
            try {
              staticPagesText = await fetch('./data/pages_text.json').then((r) => r.json());
            } catch (_) {
              staticPagesText = [];
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
          for (const pg of staticPagesText) {
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
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
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
      body.innerHTML = `<div style="color:#94a3b8;padding:12px;">По запросу ничего не найдено. Попробуйте другой узел (например: «термостат», «генератор», «сцепление», «P0300»).</div>`;
      return;
    }

    const parts = [];

    if (data.guides.length) {
      parts.push(`
        <div class="search-group">
          <h4>🎬 Готовые озвученные видеогиды (${data.guides.length})</h4>
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
          <h4>🔌 Цветные электросхемы (${data.diagrams.length})</h4>
          ${data.diagrams.map((w) => `
            <div class="search-hit-item" data-hit-pdf="${w.pdfPage}">
              <div><strong>${escapeHtml(w.code)}. ${escapeHtml(w.title)}</strong><div class="search-hit-snippet">${escapeHtml(w.components.slice(0, 150))}…</div></div>
              <span class="btn-ghost-sm">Схема с.${w.bookPage}</span>
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
          <h4>📄 Полнотекстовые совпадения по 385 страницам (${data.pages.length})</h4>
          ${data.pages.slice(0, 12).map((p) => `
            <div class="search-hit-item" data-hit-pdf="${p.pdfPage}">
              <div><strong>Страница книги ${p.bookPage} (PDF ${p.pdfPage})</strong><div class="search-hit-snippet">${escapeHtml(p.snippet)}</div></div>
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
      const audio = $('hfStageAudio');
      if (transcript.includes('дальше') || transcript.includes('следующ')) {
        goNextStage(true);
      } else if (transcript.includes('назад') || transcript.includes('предыдущ')) {
        goPrevStage(true);
      } else if (transcript.includes('повтор')) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else if (transcript.includes('пауз') || transcript.includes('стоп')) {
        audio.pause();
      } else if (transcript.includes('пуск') || transcript.includes('играй') || transcript.includes('дальше пой')) {
        audio.play().catch(() => {});
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
    state.currentChapterIdx--;
    state.currentStepInChapterIdx = 0;
    state.manualStepOverride = false;
    renderHandsFreeStage(autoPlay);
  }

  function goNextStage(autoPlay = false) {
    if (!state.currentGuide || state.currentChapterIdx >= state.currentGuide.chapters.length - 1) return;
    state.currentChapterIdx++;
    state.currentStepInChapterIdx = 0;
    state.manualStepOverride = false;
    renderHandsFreeStage(autoPlay);
  }

  /* B2B Pipeline Modal Simulation */
  function openPipelineDemo(presetName) {
    $('pipelineModal').classList.remove('hidden');
    if (presetName) runPipelineLog(presetName);
  }

  function runPipelineLog(title) {
    const log = $('demoPipelineLog');
    log.classList.remove('hidden');
    log.innerHTML = '';
    const steps = [
      `[1/4] Загрузка документа «${title}» — выделение текстового слоя, таблиц и координат иллюстраций…`,
      `[2/4] Технический разбор узлов: привязка моментов затяжки (Н·м), давлений МПа и предупреждений безопасности к шагам…`,
      `[3/4] Генерация дикторского сценария без аббревиатур и синтез русской голосовой дорожки…`,
      `[4/4] Сборка коротких HD MP4-видеокарточек с телеметрией и пошагового плеера «Свободные руки» — ГОТОВО! (Пример уже работает во вкладке «Видеогиды» на базе книги Ford Fiesta/Fusion)`
    ];
    steps.forEach((line, i) => {
      setTimeout(() => {
        const div = document.createElement('div');
        div.textContent = line;
        log.appendChild(div);
      }, i * 480);
    });
  }

  /* Bind Events & Init */
  async function init() {
    // Nav tabs
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    $('brandHome').addEventListener('click', () => switchTab('player'));
    $('openBookQuickBtn').addEventListener('click', () => switchTab('book'));

    // Mode switch
    $('modeVideoBtn').addEventListener('click', () => setPlayerMode('video'));
    $('modeStepBtn').addEventListener('click', () => setPlayerMode('steps'));

    // Video speed & chapter sync
    const videoEl = $('mainVideoPlayer');
    $('videoSpeedSelect').addEventListener('change', (e) => {
      videoEl.playbackRate = parseFloat(e.target.value || '1');
    });

    videoEl.addEventListener('timeupdate', () => {
      const g = state.currentGuide;
      if (!g || state.playerMode !== 'video') return;
      const t = videoEl.currentTime;
      const idx = g.chapters.findIndex((c) => t >= c.startTime && t < c.endTime);
      if (idx !== -1 && idx !== state.currentChapterIdx) {
        highlightChapterRow(idx);
      }
    });

    // Hands-Free Audio Controls
    const hfAudio = $('hfStageAudio');
    $('hfPlayPauseBtn').addEventListener('click', () => {
      if (hfAudio.paused) {
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
      hfAudio.currentTime = 0;
      hfAudio.play().catch(() => {});
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
      if (!ch || !hfAudio.duration) return;
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

    // Pipeline modal
    $('openPipelineModalBtn').addEventListener('click', () => openPipelineDemo());
    $('simulateUploadBtn').addEventListener('click', () => openPipelineDemo());
    $('closePipelineModalBtn').addEventListener('click', () => $('pipelineModal').classList.add('hidden'));
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

    // DTC controls
    $('dtcSearchInput').addEventListener('input', renderDtcTable);
    document.querySelectorAll('#dtcCategoryPills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.dtcCategory = btn.dataset.dtcCat;
        document.querySelectorAll('#dtcCategoryPills .pill').forEach((p) => p.classList.toggle('active', p === btn));
        renderDtcTable();
      });
    });

    // Specs controls
    document.querySelectorAll('#mileageSelector .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedMileage = btn.dataset.km;
        document.querySelectorAll('#mileageSelector .pill').forEach((p) => p.classList.toggle('active', p === btn));
        renderMaintenanceGrid();
      });
    });
    $('torqueFilterInput').addEventListener('input', renderTorquesTable);

    setupGlobalSearch();

    // Fetch backend datasets (with static ./data/*.json fallback for GitHub Pages)
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

    state.guides = guidesData.guides || [];
    state.catalog = catalogData.items || [];
    state.manual = manualData;

    if (state.manual && state.manual.dtcCodes) {
      $('dtcCountBadge').textContent = state.manual.dtcCodes.length;
    }

    if (state.guides.length > 0) {
      selectGuide(state.guides[0]);
    }
    renderCatalog();
    renderBookSidebar();
    renderDtcTable();
    renderSpecsTab();
  }

  init().catch((err) => console.error('Init error:', err));
})();
