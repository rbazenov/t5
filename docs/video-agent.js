(function () {
  'use strict';

  /* =========================================================================
   * 1. Subsystem & Entity NLU Analyzer (Анализ ТОЛЬКО текста — 0% картинок книги)
   * ========================================================================= */
  const SUBSYSTEMS = {
    engine_lubrication: {
      id: 'engine_lubrication',
      name: 'Двигатель • Система смазки',
      poster: './media/posters/oil-hero.jpg',
      altPoster: './media/posters/oil-filter-stage.jpg',
      primaryColor: '#f59e0b',
      fluidColor: '#fbbf24'
    },
    disc_brakes: {
      id: 'disc_brakes',
      name: 'Тормозная система • Суппорт и диск',
      poster: './media/posters/brakes-hero.jpg',
      altPoster: './media/posters/brakes-torque-stage.jpg',
      primaryColor: '#38bdf8',
      fluidColor: '#fde047'
    },
    timing_drive: {
      id: 'timing_drive',
      name: 'Газораспределение • Привод ГРМ',
      poster: './media/posters/belt-hero.jpg',
      altPoster: './media/posters/belt-crank-stage.jpg',
      primaryColor: '#10b981',
      fluidColor: '#34d399'
    },
    ignition_head: {
      id: 'ignition_head',
      name: 'ГБЦ и Система зажигания',
      poster: './media/posters/spark-hero.jpg',
      altPoster: './media/posters/spark-gap-stage.jpg',
      primaryColor: '#60a5fa',
      fluidColor: '#93c5fd'
    },
    cooling_system: {
      id: 'cooling_system',
      name: 'Система охлаждения • Радиатор и термостат',
      poster: './media/posters/cooling-hero.jpg',
      altPoster: './media/posters/cooling-hero.jpg',
      primaryColor: '#34d399',
      fluidColor: '#10b981'
    },
    suspension_steering: {
      id: 'suspension_steering',
      name: 'Подвеска, ступица и рулевое управление',
      poster: './media/posters/suspension-hero.jpg',
      altPoster: './media/posters/suspension-hero.jpg',
      primaryColor: '#fbbf24',
      fluidColor: '#f59e0b'
    },
    electrical_battery: {
      id: 'electrical_battery',
      name: 'Электрооборудование • АКБ, генератор и жгуты',
      poster: './media/posters/electric-hero.jpg',
      altPoster: './media/posters/electric-hero.jpg',
      primaryColor: '#38bdf8',
      fluidColor: '#38bdf8'
    },
    fuel_intake: {
      id: 'fuel_intake',
      name: 'Система питания • Рампа, форсунки и фильтр',
      poster: './media/posters/fuel-hero.jpg',
      altPoster: './media/posters/fuel-hero.jpg',
      primaryColor: '#fb923c',
      fluidColor: '#fdba74'
    },
    clutch_transmission: {
      id: 'clutch_transmission',
      name: 'Трансмиссия • Сцепление, маховик и КПП',
      poster: './media/posters/clutch-hero.jpg',
      altPoster: './media/posters/clutch-hero.jpg',
      primaryColor: '#a78bfa',
      fluidColor: '#f472b6'
    },
    hydraulics_heavy: {
      id: 'hydraulics_heavy',
      name: 'Гидросистема спецтехники • Цилиндры и РВД',
      poster: './media/posters/hydraulics-hero.jpg',
      altPoster: './media/posters/hydraulics-hero.jpg',
      primaryColor: '#f59e0b',
      fluidColor: '#fbbf24'
    }
  };

  function detectSubsystemFromText(text) {
    const s = String(text || '').toLowerCase();
    if (/гидроцилиндр|гидронасос|гидробак|рвд|экскаватор|стрел[аы]|ковш|золотник|\bмпа\b/.test(s)) {
      return SUBSYSTEMS.hydraulics_heavy;
    }
    if (/ремень\s*грм|цепь\s*грм|распредвал|шкив\s*колен|натяжн.*ролик|\bвмт\b|фаз[ыа]\s*грм/.test(s)) {
      return SUBSYSTEMS.timing_drive;
    }
    if (/тормоз|суппорт|колодк|барабан|ручник|стояночн|гтц|dot-?4/.test(s)) {
      return SUBSYSTEMS.disc_brakes;
    }
    if (/свеч[иауе]|катушк.*зажиган|высоковольтн|свечн.*колод/.test(s)) {
      return SUBSYSTEMS.ignition_head;
    }
    if (/радиатор|термостат|охлаждающ|антифриз|расширительн.*бач|водян.*насос|помп[ауы]/.test(s)) {
      return SUBSYSTEMS.cooling_system;
    }
    if (/топлив|бензонасос|форсунк|рамп[ауы]|дроссель|воздушн.*фильтр|впускн/.test(s)) {
      return SUBSYSTEMS.fuel_intake;
    }
    if (/амортизатор|стойк[ауи]|шаров.*опор|рычаг|рулев|ступиц|подшипник|шрус|стабилизатор|пружин.*подвеск/.test(s)) {
      return SUBSYSTEMS.suspension_steering;
    }
    if (/сцеплен|маховик|коробк.*передач|\bкпп\b|\bмкпп\b|\bакпп\b|выжимн|привод.*колес|кулис/.test(s)) {
      return SUBSYSTEMS.clutch_transmission;
    }
    if (/аккумулятор|\bакб\b|клемм[ауы]|генератор|стартер|предохранител|реле|лампу|фар[ауы]|фонар|колодк.*провод|датчик/.test(s)) {
      return SUBSYSTEMS.electrical_battery;
    }
    if (/масл|маслян.*фильтр|картер|поддон|щуп|гбц|клапан|прокладк|сальник|двигател/.test(s)) {
      return SUBSYSTEMS.engine_lubrication;
    }
    return SUBSYSTEMS.engine_lubrication;
  }

  const PART_PATTERNS = [
    [/сливн[а-я]+\s+пробк[а-я]+/i, 'Сливная пробка картера'],
    [/маслян[а-я]+\s+фильтр[а-я]*/i, 'Масляный фильтр'],
    [/воздушн[а-я]+\s+фильтр[а-я]*/i, 'Воздушный фильтр'],
    [/топливн[а-я]+\s+фильтр[а-я]*/i, 'Топливный фильтр'],
    [/фильтр[а-я]*\s+салона/i, 'Фильтр салона'],
    [/направляющ[а-я]+\s+пальц[а-я]+/i, 'Направляющие пальцы'],
    [/тормозн[а-я]+\s+колодк[а-я]+/i, 'Тормозные колодки'],
    [/тормозн[а-я]+\s+диск[а-я]*/i, 'Тормозной диск'],
    [/пружинн[а-я]+\s+фиксатор[а-я]*/i, 'Пружинный фиксатор'],
    [/порш[а-я]+\s+(?:рабочего\s+)?цилиндра|поршень/i, 'Поршень цилиндра'],
    [/суппорт[а-я]*/i, 'Тормозной суппорт'],
    [/ремен[а-я]+\s+(?:привода\s+)?грм/i, 'Ремень привода ГРМ'],
    [/натяжн[а-я]+\s+ролик[а-я]*/i, 'Натяжной ролик'],
    [/шкив[а-я]*\s+коленчатого\s+вала|шкив[а-я]*\s+кв/i, 'Шкив коленвала'],
    [/стопорн[а-я]+\s+планк[а-я]+/i, 'Стопорная планка валов'],
    [/свеч[а-я]+\s+зажигания/i, 'Свеча зажигания'],
    [/катушк[а-я]+\s+зажигания/i, 'Катушка зажигания'],
    [/клемм[а-я]+\s+«?минус»?|минусов[а-я]+\s+клемм[а-я]+/i, 'Клемма «минус» АКБ'],
    [/колодк[а-я]+\s+(?:жгута\s+)?провод[а-я]+|разъем[а-я]*/i, 'Электрический разъём'],
    [/термостат[а-я]*/i, 'Термостат'],
    [/радиатор[а-я]*/i, 'Радиатор охлаждения'],
    [/патруб[а-я]+|шланг[а-я]*/i, 'Магистральный шланг'],
    [/шаров[а-я]+\s+опор[а-я]+/i, 'Шаровая опора'],
    [/амортизаторн[а-я]+\s+стойк[а-я]+|амортизатор[а-я]*/i, 'Амортизаторная стойка'],
    [/генератор[а-я]*/i, 'Генератор'],
    [/стартер[а-я]*/i, 'Стартер'],
    [/маховик[а-я]*/i, 'Маховик ДВС'],
    [/крышк[а-я]+\s+головки\s+блока|гбц/i, 'Головка блока (ГБЦ)'],
    [/гидроцилиндр[а-я]*/i, 'Гидроцилиндр'],
    [/щуп[а-я]*/i, 'Контрольный щуп'],
    [/болт[а-я]*|гайк[а-я]+|винт[а-я]*/i, 'Резьбовой крепёж']
  ];

  const TOOL_PATTERNS = [
    [/динамометрическ[а-я]+\s+ключ[а-я]*/i, 'Динамометрический ключ'],
    [/шестигранник[а-я]*\s*(?:«?на\s*\d+»?)?/i, 'Ключ-шестигранник'],
    [/свечн[а-я]+\s+ключ[а-я]*\s*(?:«?на\s*16»?)?/i, 'Свечной ключ 16 мм'],
    [/головк[а-я]+\s*«?на\s*(\d+)»?/i, 'Торцовая головка'],
    [/ключ[а-я]*\s*«?на\s*(\d+)»?/i, 'Гаечный ключ'],
    [/torx\s*[eet]*\d+/i, 'Головка TORX'],
    [/съемник[а-я]*/i, 'Специальный съёмник'],
    [/отвертк[а-я]+/i, 'Слесарная отвёртка'],
    [/пассатиж[а-я]+|плоскогубц[а-я]+/i, 'Пассатижи'],
    [/сжат[а-я]+\s+воздух[а-я]*|компрессор|пневмо/i, 'Пневмопистолет'],
    [/кругл[а-я]+\s+щуп[а-я]*|щуп[а-я]*/i, 'Калиброванный щуп'],
    [/металлическ[а-я]+\s+щетк[а-я]+/i, 'Металлическая щётка']
  ];

  function extractTargetPart(text) {
    const s = String(text || '');
    for (const [re, label] of PART_PATTERNS) {
      if (re.test(s)) return label;
    }
    return 'Узел агрегата';
  }

  function extractTargetTool(text, fallback = '') {
    const s = `${text || ''} ${fallback || ''}`;
    for (const [re, label] of TOOL_PATTERNS) {
      const m = s.match(re);
      if (m) {
        if (m[1]) return `${label} ${m[1]} мм`;
        return m[0].length <= 26 ? m[0].charAt(0).toUpperCase() + m[0].slice(1) : label;
      }
    }
    return fallback ? String(fallback).slice(0, 28) : 'Слесарный инструмент';
  }

  const ACTION_META = {
    unscrew_ccw: {
      icon: '↺',
      badge: 'ОТВОРАЧИВАНИЕ КРЕПЕЖА',
      accent: '#38bdf8',
      accentRgb: [56, 189, 248],
      defaultVal: '↺ Против час.'
    },
    torque_cw: {
      icon: '↻',
      badge: 'ДИНАМОМЕТРИЧЕСКАЯ ЗАТЯЖКА',
      accent: '#f59e0b',
      accentRgb: [245, 158, 11],
      defaultVal: '↻ По моменту'
    },
    drain_fluid: {
      icon: '💧',
      badge: 'СЛИВ РАБОЧЕЙ ЖИДКОСТИ',
      accent: '#fbbf24',
      accentRgb: [251, 191, 36],
      defaultVal: 'Слив в тару'
    },
    fill_fluid: {
      icon: '🛢',
      badge: 'ЗАЛИВКА ДО НОРМЫ MIN–MAX',
      accent: '#10b981',
      accentRgb: [16, 185, 129],
      defaultVal: 'MIN ──▶ MAX'
    },
    lubricate: {
      icon: '✨',
      badge: 'НАНЕСЕНИЕ СМАЗКИ / ГЕРМЕТИКА',
      accent: '#a78bfa',
      accentRgb: [167, 139, 250],
      defaultVal: 'Плёнка 360°'
    },
    clean_air: {
      icon: '💨',
      badge: 'ОЧИСТКА И ПРОДУВКА УЗЛА',
      accent: '#22d3ee',
      accentRgb: [34, 211, 238],
      defaultVal: 'Чистая база'
    },
    pry_clip: {
      icon: '🔌',
      badge: 'РАСФИКСАЦИЯ СКОБЫ / РАЗЪЁМА',
      accent: '#fb923c',
      accentRgb: [251, 146, 60],
      defaultVal: 'Отщёлкнуть'
    },
    remove_part: {
      icon: '📤',
      badge: 'ДЕМОНТАЖ И ВЫВОД ДЕТАЛИ',
      accent: '#f97316',
      accentRgb: [249, 115, 22],
      defaultVal: 'Снятие узла'
    },
    press_install: {
      icon: '📥',
      badge: 'ПОСАДКА И МОНТАЖ НА МЕСТО',
      accent: '#10b981',
      accentRgb: [16, 185, 129],
      defaultVal: 'Посадка ✓'
    },
    belt_align: {
      icon: '⚙️',
      badge: 'СИНХРОНИЗАЦИЯ ФАЗ И МЕТОК',
      accent: '#34d399',
      accentRgb: [52, 211, 153],
      defaultVal: 'Метки ВМТ ✓'
    },
    measure_gap: {
      icon: '📏',
      badge: 'ИНСТРУМЕНТАЛЬНЫЙ ЗАМЕР',
      accent: '#38bdf8',
      accentRgb: [56, 189, 248],
      defaultVal: 'Контроль нормы'
    }
  };

  function classifyMechanicalAction(caption, tool = '', extraContext = '') {
    const raw = `${caption || ''} ${tool || ''}`.trim();
    const txt = raw.toLowerCase();
    const full = `${txt} ${extraContext || ''}`.toLowerCase();

    const nmMatch = raw.match(/(\d{1,3}(?:[.,]\d+)?(?:\s*[–-]\s*\d{1,3}(?:[.,]\d+)?)?)\s*(?:Н\s*[·*]\s*м|Нм|Nm)/i)
      || full.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:Н\s*[·*]\s*м|Нм|Nm)/i);
    const degMatch = raw.match(/\+\s*(\d{2,3})\s*°/);
    const mmMatch = raw.match(/(\d{1,2}(?:[.,]\d+)?)\s*мм/i);
    const literMatch = raw.match(/(\d{1,2}(?:[.,]\d+)?)\s*л\b/i);
    const mpaMatch = raw.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:МПа|бар)/i);

    let kind = 'measure_gap';
    if (/(?:слейте|слить|откачайте|вытека|снизьте\s+давлен)/i.test(txt)) {
      kind = 'drain_fluid';
    } else if (/(?:залейте|заполните|долейте|прокачайте)/i.test(txt)) {
      kind = 'fill_fluid';
    } else if (/(?:продуйте|сжатым\s+воздух|щетк|протрите|очистите|промойте)/i.test(txt)) {
      kind = 'clean_air';
    } else if (/(?:смажьте|нанесите.*герметик|нанесите.*фиксатор|смазк)/i.test(txt) && !/затяните/i.test(txt)) {
      kind = 'lubricate';
    } else if (/(?:вмт|метк[иу]|ремень\s+грм|распредвал|коленвал.*оборот|стопорн.*планк|зубчат)/i.test(txt)) {
      kind = 'belt_align';
    } else if (/(?:затяните|заверните|вверните|наверните|доверните|моментом)/i.test(txt) || (nmMatch && !/отверните|выверните|ослабьте/i.test(txt))) {
      kind = 'torque_cw';
    } else if (/(?:отверните|выверните|ослабьте|строньте|открутите|выкрутите)/i.test(txt)) {
      kind = 'unscrew_ccw';
    } else if (/(?:утопите|вдавите|запрессуйте|установите|вставьте|наденьте|подсоедините|соберите)/i.test(txt)) {
      kind = 'press_install';
    } else if (/(?:подденьте|отсоедините|колодку|разъем|фиксатор|скоб[уы]|стопорн|хомут)/i.test(txt)) {
      kind = 'pry_clip';
    } else if (/(?:снимите|извлеките|выньте|демонтируйте|выведите|разрежьте|выпрессуйте)/i.test(txt)) {
      kind = 'remove_part';
    }

    const meta = ACTION_META[kind] || ACTION_META.measure_gap;
    let specVal = meta.defaultVal;
    if (nmMatch && (kind === 'torque_cw' || kind === 'drain_fluid')) {
      specVal = `${nmMatch[1]} Н·м${degMatch ? ' +' + degMatch[1] + '°' : ''}`;
    } else if (mmMatch) {
      specVal = `${mmMatch[1]} мм`;
    } else if (literMatch) {
      specVal = `${literMatch[1]} л`;
    } else if (mpaMatch) {
      specVal = mpaMatch[0];
    } else if (/3\/4/.test(raw)) {
      specVal = '+3/4 об.';
    }

    return {
      kind,
      icon: meta.icon,
      badge: meta.badge,
      accent: meta.accent,
      accentRgb: meta.accentRgb,
      specVal,
      partName: extractTargetPart(raw),
      toolName: extractTargetTool(raw, tool)
    };
  }

  /* =========================================================================
   * 2. Preloaded Synthetic Studio 3D Cutaway Backdrops (ZERO book images!)
   * ========================================================================= */
  const studioImgCache = new Map();

  function getSyntheticStudioBackdrop(url) {
    if (!url || typeof Image === 'undefined') return null;
    if (studioImgCache.has(url)) {
      const entry = studioImgCache.get(url);
      return entry.loaded ? entry.img : null;
    }
    const rec = { img: new Image(), loaded: false };
    rec.img.onload = () => { rec.loaded = true; };
    rec.img.onerror = () => { rec.loaded = false; };
    rec.img.src = url;
    studioImgCache.set(url, rec);
    return null;
  }

  /* =========================================================================
   * 3. Full-Stage 2.5D Procedural Engineering Assembly & Action Synthesizer
   *    Draws 100% synthetic animated scenes from text — NEVER uses book scans!
   * ========================================================================= */
  function renderFullSyntheticScene(ctx, rect, stepInfo, tSec, stepProg, visualMode = '3d_hybrid') {
    const { x, y, w, h } = rect;
    const sub = stepInfo.subsystem || SUBSYSTEMS.engine_lubrication;
    const act = stepInfo.action;

    ctx.save();
    roundRect(ctx, x, y, w, h, 16, '#080e1c', act.accent, 2);

    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 14);
    else ctx.rect(x + 3, y + 3, w - 6, h - 6);
    ctx.clip();

    // Layer A: Synthetic Studio 3D Backdrop (in '3d_hybrid') OR Pure Animated CAD Blueprint Grid ('pure_cad')
    const bgImg = visualMode !== 'pure_cad' ? getSyntheticStudioBackdrop(sub.poster) : null;
    if (bgImg && bgImg.width > 0) {
      const zoom = 1.03 + 0.08 * stepProg;
      const baseScale = Math.max(w / bgImg.width, h / bgImg.height);
      const dw = bgImg.width * baseScale * zoom;
      const dh = bgImg.height * baseScale * zoom;
      const panX = Math.sin(stepProg * Math.PI - 0.5) * 20;
      ctx.drawImage(bgImg, x + (w - dw) / 2 + panX, y + (h - dh) / 2, dw, dh);

      // Rich translucent studio overlay so foreground procedural CAD assembly stands out with razor clarity
      const ov = ctx.createLinearGradient(x, y, x, y + h);
      ov.addColorStop(0, 'rgba(7, 12, 24, 0.52)');
      ov.addColorStop(0.55, 'rgba(9, 15, 29, 0.68)');
      ov.addColorStop(1, 'rgba(6, 10, 20, 0.88)');
      ctx.fillStyle = ov;
      ctx.fillRect(x, y, w, h);
    } else {
      const cadGrad = ctx.createRadialGradient(x + w * 0.5, y + h * 0.48, 20, x + w * 0.5, y + h * 0.5, w * 0.72);
      cadGrad.addColorStop(0, '#12223d');
      cadGrad.addColorStop(1, '#070c18');
      ctx.fillStyle = cadGrad;
      ctx.fillRect(x, y, w, h);
    }

    // Animated Engineering CAD Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
    ctx.lineWidth = 1;
    const gridStep = 34;
    const drift = (tSec * 12) % gridStep;
    for (let gx = x - gridStep + drift; gx < x + w; gx += gridStep) {
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
    }
    for (let gy = y; gy < y + h; gy += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
    }

    // Layer B: Top NLU Entity Chips extracted from text (Subsystem + Target Part + Active Tool)
    roundRect(ctx, x + 14, y + 12, Math.min(w - 28, 355), 30, 8, 'rgba(9, 14, 26, 0.86)', act.accent, 1.2);
    ctx.fillStyle = act.accent;
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.fillText(`🧠 СИНТЕЗ ИЗ ТЕКСТА: ${sub.name.slice(0, 32)}`, x + 24, y + 31);

    // Layer C: Central Procedural 2.5D Subsystem Rig + Live Kinematic Action
    const stageArea = { x: x + 16, y: y + 50, w: w - 32, h: h - 96 };
    drawSubsystemRigBackground(ctx, stageArea, sub.id, tSec, stepProg, act);
    drawAnimatedMechanismBox(ctx, {
      x: stageArea.x + stageArea.w * 0.06,
      y: stageArea.y + stageArea.h * 0.14,
      w: stageArea.w * 0.88,
      h: stageArea.h * 0.82,
      transparentBg: true
    }, act, tSec, stepProg);

    // Layer D: Bottom Entity Callout Strip (Target Part + Tool + Spec)
    const barY = y + h - 42;
    roundRect(ctx, x + 14, barY, w - 28, 30, 8, 'rgba(11, 18, 34, 0.9)', 'rgba(71, 85, 105, 0.8)', 1);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    const callout = `🔩 Узел: ${act.partName || 'Деталь'}   •   🔧 ${act.toolName || 'Инструмент'}`;
    ctx.fillText(callout.slice(0, 58), x + 24, barY + 19);

    ctx.restore();
  }

  /* Draws rich background 2.5D schematic architecture of the detected vehicle subsystem */
  function drawSubsystemRigBackground(ctx, area, subId, tSec, prog, act) {
    const cx = area.x + area.w * 0.5;
    const cy = area.y + area.h * 0.52;
    const s = Math.min(area.w / 480, area.h / 320);

    ctx.save();
    ctx.globalAlpha = 0.42;

    if (subId === 'disc_brakes') {
      // Ventilated brake rotor + hub studs + floating caliper silhouette
      ctx.beginPath();
      ctx.arc(cx, cy, 118 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.lineWidth = 4 * s;
      ctx.strokeStyle = '#64748b';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 52 * s, 0, Math.PI * 2);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2 * s;
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        const a = i * (Math.PI / 2) + 0.4;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 34 * s, cy + Math.sin(a) * 34 * s, 6 * s, 0, Math.PI * 2);
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
      }
      // Caliper arc on left
      ctx.beginPath();
      ctx.arc(cx, cy, 124 * s, Math.PI * 0.68, Math.PI * 1.32);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 22 * s;
      ctx.stroke();
    } else if (subId === 'cooling_system') {
      // Multi-fin aluminum radiator + animated electric fan blades
      const rx = cx - 105 * s, ry = cy - 82 * s, rw = 210 * s, rh = 164 * s;
      roundRect(ctx, rx, ry, rw, rh, 10 * s, '#0f172a', '#34d399', 2.5 * s);
      for (let fy = ry + 14 * s; fy < ry + rh - 10 * s; fy += 11 * s) {
        ctx.beginPath();
        ctx.moveTo(rx + 10 * s, fy);
        ctx.lineTo(rx + rw - 10 * s, fy);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2 * s;
        ctx.stroke();
      }
      // Rotating cooling fan
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tSec * 2.2);
      for (let b = 0; b < 5; b++) {
        ctx.rotate((Math.PI * 2) / 5);
        roundRect(ctx, -7 * s, 10 * s, 14 * s, 48 * s, 6 * s, '#38bdf8');
      }
      ctx.restore();
    } else if (subId === 'suspension_steering') {
      // MacPherson yellow coil spring + shock damper + lower wishbone
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 14 * s;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 110 * s);
      ctx.lineTo(cx, cy + 95 * s);
      ctx.stroke();

      // Coil spring zig-zag
      const comp = Math.sin(tSec * 2.4) * 5 * s;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 6 * s;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const sx = cx + (i % 2 === 0 ? -36 : 36) * s;
        const sy = cy - 80 * s + i * (22 * s + comp * 0.2);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    } else if (subId === 'electrical_battery') {
      // 12V Battery casing + RED (+) and BLUE (-) posts + voltage wave
      roundRect(ctx, cx - 105 * s, cy - 58 * s, 210 * s, 126 * s, 10 * s, '#1e293b', '#38bdf8', 2.5 * s);
      roundRect(ctx, cx - 76 * s, cy - 76 * s, 26 * s, 18 * s, 4 * s, '#ef4444');
      roundRect(ctx, cx + 50 * s, cy - 76 * s, 26 * s, 18 * s, 4 * s, '#3b82f6');
      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${Math.round(16 * s)}px monospace`;
      ctx.fillText('+  12V  −', cx - 44 * s, cy + 8 * s);
    } else if (subId === 'hydraulics_heavy') {
      // Hydraulic cylinder barrel + reciprocating chrome piston rod
      const ext = (0.5 + 0.5 * Math.sin(tSec * 2.0)) * 55 * s;
      roundRect(ctx, cx - 125 * s, cy - 34 * s, 150 * s, 68 * s, 8 * s, '#f59e0b', '#fef3c7', 2.5 * s);
      roundRect(ctx, cx + 20 * s, cy - 14 * s, 95 * s + ext, 28 * s, 5 * s, '#e2e8f0', '#94a3b8', 2 * s);
    } else {
      // Engine block / Cylinder head / Clutch concentric housing silhouette
      roundRect(ctx, cx - 118 * s, cy - 78 * s, 236 * s, 156 * s, 16 * s, '#1e293b', act.accent, 2 * s);
      for (let c = -1.5; c <= 1.5; c += 1) {
        ctx.beginPath();
        ctx.arc(cx + c * 52 * s, cy - 12 * s, 20 * s, 0, Math.PI * 2);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2.5 * s;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /* =========================================================================
   * 4. 60 FPS Kinematic Tool & Action Renderer (Shared by Shorts, HD & Hands-Free)
   * ========================================================================= */
  function drawAnimatedMechanismBox(ctx, box, action, tSec, stepProg) {
    const { x, y, w, h, transparentBg = false } = box;
    const [ar, ag, ab] = action.accentRgb || [56, 189, 248];
    const accent = action.accent || '#38bdf8';

    ctx.save();
    if (!transparentBg) {
      roundRect(ctx, x, y, w, h, 14, 'rgba(10, 16, 30, 0.92)', `rgba(${ar}, ${ag}, ${ab}, 0.85)`, 2);
      roundRect(ctx, x + 10, y + 9, w - 20, 26, 7, `rgba(${ar}, ${ag}, ${ab}, 0.16)`);
      ctx.fillStyle = accent;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.fillText(`${action.icon} ${action.badge}`, x + 18, y + 26);
    }

    const cx = x + w * 0.45;
    const cy = y + (transparentBg ? h * 0.50 : 36 + (h - 36) * 0.52);
    const scale = Math.min(w / 350, h / 195);

    switch (action.kind) {
      case 'unscrew_ccw': {
        const cyc = (tSec * 1.35) % 1;
        const wrenchDeg = cyc < 0.68
          ? -15 - 58 * Math.sin((cyc / 0.68) * Math.PI * 0.5)
          : -73 + 58 * ((cyc - 0.68) / 0.32);
        const boltRot = -tSec * 2.6;
        const liftOut = 6 * Math.sin(tSec * 2.2);

        drawOrbitalArrow(ctx, cx, cy, 56 * scale, -tSec * 2.4, 2.05, false, accent, 5 * scale);
        drawOrbitalArrow(ctx, cx, cy, 56 * scale, -tSec * 2.4 + Math.PI, 2.05, false, `rgba(${ar},${ag},${ab},0.55)`, 3.8 * scale);
        drawRatchetWrench(ctx, cx, cy + liftOut * 0.3, wrenchDeg, 114 * scale, scale, accent);
        drawHexFastener(ctx, cx, cy + liftOut * 0.3, 21 * scale, boltRot, '#e2e8f0', accent);
        drawSpecPill(ctx, x + w - 126 * scale, y + h - 38 * scale, action.specVal, accent, scale);
        break;
      }

      case 'torque_cw': {
        const cyc = (tSec * 0.68) % 1.18;
        const clamped = Math.min(1, cyc);
        const clicked = cyc >= 0.94;
        const liveCol = clicked ? '#10b981' : '#f59e0b';
        const wrenchDeg = -135 + 100 * clamped;

        drawOrbitalArrow(ctx, cx - 22 * scale, cy, 52 * scale, tSec * 2.2, 1.95, true, liveCol, 5 * scale);
        drawRatchetWrench(ctx, cx - 22 * scale, cy, wrenchDeg, 108 * scale, scale, liveCol);
        drawHexFastener(ctx, cx - 22 * scale, cy, 20 * scale, tSec * 1.9, '#fbbf24', liveCol);

        const gx = x + w - 70 * scale;
        const gy = cy;
        const gr = 40 * scale;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * 2.25);
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.75)';
        ctx.lineWidth = 8.5 * scale;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * clamped));
        ctx.strokeStyle = liveCol;
        ctx.lineWidth = 8.5 * scale;
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${Math.max(10, Math.round(12.5 * scale))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(action.specVal.slice(0, 10), gx, gy + 4 * scale);
        if (clicked) {
          const pulseR = (56 + (cyc - 0.94) * 95) * scale;
          ctx.beginPath();
          ctx.arc(cx - 22 * scale, cy, pulseR, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
          ctx.lineWidth = 3.5 * scale;
          ctx.stroke();
          ctx.fillStyle = '#34d399';
          ctx.font = `bold ${Math.max(10, Math.round(11.5 * scale))}px Inter, sans-serif`;
          ctx.fillText('ЩЕЛЧОК ✓', gx, gy + gr + 16 * scale);
        }
        ctx.textAlign = 'left';
        break;
      }

      case 'drain_fluid': {
        const sx = cx - 62 * scale;
        const sy = cy - 60 * scale;
        roundRect(ctx, sx, sy, 124 * scale, 36 * scale, 8 * scale, '#334155', '#cbd5e1', 2);

        const py = cy + 32 * scale;
        ctx.beginPath();
        ctx.moveTo(sx - 8 * scale, py);
        ctx.lineTo(sx + 132 * scale, py);
        ctx.lineTo(sx + 114 * scale, py + 36 * scale);
        ctx.lineTo(sx + 10 * scale, py + 36 * scale);
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.stroke();

        const oilH = (11 + 18 * (0.3 + 0.7 * stepProg)) * scale;
        ctx.fillStyle = 'rgba(217, 119, 6, 0.94)';
        ctx.fillRect(sx + 13 * scale, py + 33 * scale - oilH, 98 * scale, oilH);

        const streamX = sx + 62 * scale;
        const wob = Math.sin(tSec * 14) * 3.2 * scale;
        const grad = ctx.createLinearGradient(streamX, sy + 36 * scale, streamX, py + 24 * scale);
        grad.addColorStop(0, '#fde047');
        grad.addColorStop(1, '#d97706');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(streamX - 5.5 * scale, sy + 36 * scale);
        ctx.lineTo(streamX + 5.5 * scale, sy + 36 * scale);
        ctx.lineTo(streamX + 4 * scale + wob, py + 25 * scale);
        ctx.lineTo(streamX - 4 * scale + wob, py + 25 * scale);
        ctx.closePath();
        ctx.fill();

        for (let k = 0; k < 6; k++) {
          const dy = ((tSec * 115 + k * 18) % 58) * scale;
          ctx.beginPath();
          ctx.arc(streamX + ((k % 2 ? 1 : -1) * 5.5 * scale), sy + 40 * scale + dy, 3.2 * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#fef08a';
          ctx.fill();
        }
        drawSpecPill(ctx, x + w - 126 * scale, y + h - 38 * scale, action.specVal, '#fbbf24', scale);
        break;
      }

      case 'fill_fluid': {
        const kx = x + 30 * scale;
        const ky = cy - 48 * scale;
        ctx.save();
        ctx.translate(kx + 42 * scale, ky + 24 * scale);
        ctx.rotate(0.19 + 0.08 * Math.sin(tSec * 2.5));
        roundRect(ctx, -40 * scale, -22 * scale, 80 * scale, 48 * scale, 9 * scale, '#f59e0b', '#fef3c7', 2);
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.max(9, Math.round(11 * scale))}px monospace`;
        ctx.fillText('ЖИДКОСТЬ', -30 * scale, 5 * scale);
        ctx.restore();

        for (let k = 0; k < 9; k++) {
          const f = ((k / 9) + (tSec * 0.9)) % 1;
          const px = kx + 84 * scale + f * 64 * scale;
          const py = ky + 20 * scale + f * f * 86 * scale;
          ctx.beginPath();
          ctx.arc(px, py, (4.4 - f * 1.2) * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
        }

        const tx = x + w - 110 * scale;
        const ty = cy - 54 * scale;
        const tw = 72 * scale;
        const th = 110 * scale;
        roundRect(ctx, tx, ty, tw, th, 8 * scale, '#0f172a', '#cbd5e1', 2);
        const lvl = 0.25 + 0.58 * (0.5 + 0.5 * Math.sin(tSec * 1.8 - 1.1));
        const fh = (th - 10 * scale) * lvl;
        roundRect(ctx, tx + 4 * scale, ty + th - 5 * scale - fh, tw - 8 * scale, fh, 5 * scale, 'rgba(16, 185, 129, 0.88)');

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx - 6 * scale, ty + 24 * scale);
        ctx.lineTo(tx + tw + 6 * scale, ty + 24 * scale);
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.font = `bold ${Math.max(9, Math.round(10 * scale))}px monospace`;
        ctx.fillText('MAX', tx - 32 * scale, ty + 27 * scale);

        ctx.strokeStyle = '#f87171';
        ctx.beginPath();
        ctx.moveTo(tx - 6 * scale, ty + th - 22 * scale);
        ctx.lineTo(tx + tw + 6 * scale, ty + th - 22 * scale);
        ctx.stroke();
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('MIN', tx - 30 * scale, ty + th - 19 * scale);
        break;
      }

      case 'belt_align': {
        const c1x = cx - 46 * scale, c1y = cy - 28 * scale;
        const c2x = cx + 46 * scale, c2y = cy - 28 * scale;
        const ckx = cx, cky = cy + 46 * scale;
        const rot = tSec * 1.3;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(c1x, c1y - 27 * scale);
        ctx.lineTo(c2x, c2y - 27 * scale);
        ctx.lineTo(c2x + 25 * scale, c2y + 4 * scale);
        ctx.lineTo(ckx + 21 * scale, cky + 19 * scale);
        ctx.lineTo(ckx - 21 * scale, cky + 19 * scale);
        ctx.lineTo(c1x - 25 * scale, c1y + 4 * scale);
        ctx.closePath();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 5.5 * scale;
        ctx.setLineDash([8 * scale, 5 * scale]);
        ctx.lineDashOffset = -tSec * 44 * scale;
        ctx.stroke();
        ctx.restore();

        drawToothedSprocket(ctx, c1x, c1y, 25 * scale, rot, '#e2e8f0');
        drawToothedSprocket(ctx, c2x, c2y, 25 * scale, rot, '#e2e8f0');
        drawToothedSprocket(ctx, ckx, cky, 20 * scale, rot * 2, '#94a3b8');

        const glowAlpha = 0.55 + 0.45 * Math.sin(tSec * 6);
        ctx.strokeStyle = `rgba(16, 185, 129, ${glowAlpha.toFixed(2)})`;
        ctx.lineWidth = 5 * scale;
        ctx.beginPath();
        ctx.moveTo(c1x - 34 * scale, c1y);
        ctx.lineTo(c2x + 34 * scale, c2y);
        ctx.stroke();
        drawSpecPill(ctx, x + w - 126 * scale, y + h - 38 * scale, action.specVal, '#34d399', scale);
        break;
      }

      case 'press_install': {
        const hx = cx - 74 * scale;
        const hy = cy - 42 * scale;
        roundRect(ctx, hx, hy, 98 * scale, 84 * scale, 8 * scale, '#334155', '#cbd5e1', 2.5);
        const slide = (1 - (0.5 + 0.5 * Math.sin(tSec * 2.6 - 1.1))) * 46 * scale;
        roundRect(ctx, hx + 54 * scale + slide, hy + 13 * scale, 58 * scale, 58 * scale, 7 * scale, '#e2e8f0', '#10b981', 2.5);

        for (let k = 0; k < 3; k++) {
          const ax = hx + 132 * scale + slide + k * 14 * scale;
          ctx.beginPath();
          ctx.moveTo(ax + 11 * scale, cy - 13 * scale);
          ctx.lineTo(ax, cy);
          ctx.lineTo(ax + 11 * scale, cy + 13 * scale);
          ctx.strokeStyle = `rgba(16, 185, 129, ${0.95 - k * 0.25})`;
          ctx.lineWidth = 4.5 * scale;
          ctx.stroke();
        }
        drawSpecPill(ctx, x + w - 126 * scale, y + h - 38 * scale, action.specVal, '#10b981', scale);
        break;
      }

      case 'pry_clip':
      case 'remove_part': {
        const mx = cx - 50 * scale;
        const my = cy + 6 * scale;
        ctx.save();
        ctx.setLineDash([6 * scale, 4 * scale]);
        roundRect(ctx, mx, my, 100 * scale, 38 * scale, 8 * scale, 'rgba(30,41,59,0.65)', '#94a3b8', 2);
        ctx.restore();

        const lift = (0.5 + 0.5 * Math.sin(tSec * 2.8 - 1.0)) * 40 * scale;
        roundRect(ctx, mx + lift * 0.25, my - 6 * scale - lift, 100 * scale, 38 * scale, 8 * scale, 'rgba(249, 115, 22, 0.92)', '#fed7aa', 2);

        if (action.kind === 'pry_clip') {
          ctx.save();
          ctx.translate(mx + 8 * scale, my + 4 * scale);
          ctx.rotate(-0.35 - 0.28 * Math.sin(tSec * 2.8));
          roundRect(ctx, -64 * scale, -4 * scale, 74 * scale, 7.5 * scale, 3 * scale, '#f1f5f9', '#fb923c', 1.5);
          ctx.restore();
        }

        const vx = x + w - 70 * scale;
        for (let k = 0; k < 3; k++) {
          const vy = cy + 30 * scale - k * 21 * scale - ((tSec * 36) % 18) * scale;
          ctx.beginPath();
          ctx.moveTo(vx - 14 * scale, vy + 9 * scale);
          ctx.lineTo(vx, vy);
          ctx.lineTo(vx + 14 * scale, vy + 9 * scale);
          ctx.strokeStyle = `rgba(251, 146, 60, ${0.95 - k * 0.25})`;
          ctx.lineWidth = 4.5 * scale;
          ctx.stroke();
        }
        drawSpecPill(ctx, x + w - 126 * scale, y + h - 38 * scale, action.specVal, '#fb923c', scale);
        break;
      }

      case 'clean_air':
      case 'lubricate': {
        const surfY = cy + 34 * scale;
        roundRect(ctx, x + 32 * scale, surfY, w - 140 * scale, 22 * scale, 6 * scale, '#475569', '#cbd5e1', 1.5);
        const sweep = x + 54 * scale + (w - 188 * scale) * (0.5 + 0.5 * Math.sin(tSec * 3.2));
        const col = action.kind === 'lubricate' ? '#a78bfa' : '#22d3ee';

        ctx.beginPath();
        ctx.moveTo(sweep - 9 * scale, cy - 38 * scale);
        ctx.lineTo(sweep + 9 * scale, cy - 38 * scale);
        ctx.lineTo(sweep + 28 * scale, surfY);
        ctx.lineTo(sweep - 28 * scale, surfY);
        ctx.closePath();
        ctx.fillStyle = action.kind === 'lubricate' ? 'rgba(167, 139, 250, 0.34)' : 'rgba(34, 211, 238, 0.32)';
        ctx.fill();

        roundRect(ctx, sweep - 15 * scale, cy - 55 * scale, 30 * scale, 21 * scale, 5 * scale, '#f1f5f9', col, 2);
        for (let k = 0; k < 8; k++) {
          const ang = k * 0.8 + tSec * 8;
          const px = sweep + Math.cos(ang) * 28 * scale;
          const py = surfY - 4 * scale - Math.abs(Math.sin(ang)) * 24 * scale;
          ctx.beginPath();
          ctx.arc(px, py, 3 * scale, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();
        }
        drawSpecPill(ctx, x + w - 126 * scale, y + h - 38 * scale, action.specVal, col, scale);
        break;
      }

      default: {
        const sx = cx - 22 * scale;
        const sy = cy - 32 * scale;
        roundRect(ctx, sx - 19 * scale, sy, 38 * scale, 40 * scale, 5 * scale, '#f8fafc', '#64748b', 2);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(sx - 5 * scale, sy + 40 * scale, 10 * scale, 15 * scale);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 5 * scale;
        ctx.beginPath();
        ctx.moveTo(sx - 21 * scale, sy + 38 * scale);
        ctx.lineTo(sx - 21 * scale, sy + 70 * scale);
        ctx.lineTo(sx + 11 * scale, sy + 70 * scale);
        ctx.stroke();

        const slide = Math.sin(tSec * 3.4) * 20 * scale;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4.5 * scale;
        ctx.beginPath();
        ctx.moveTo(sx - 6 * scale + slide, sy + 61 * scale);
        ctx.lineTo(sx + 80 * scale + slide, sy + 61 * scale);
        ctx.stroke();

        if (Math.floor(tSec * 6) % 2 === 0) {
          ctx.beginPath();
          ctx.arc(sx, sy + 61 * scale, 6 * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#7dd3fc';
          ctx.fill();
        }
        drawSpecPill(ctx, x + w - 126 * scale, y + h - 38 * scale, action.specVal, '#38bdf8', scale);
        break;
      }
    }

    ctx.restore();
  }

  function drawHexFastener(ctx, cx, cy, r, rot, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = rot + i * (Math.PI / 3);
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#475569';
    ctx.fill();
  }

  function drawRatchetWrench(ctx, cx, cy, deg, len, scale, gripColor) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((deg * Math.PI) / 180);
    roundRect(ctx, 18 * scale, -7.5 * scale, len - 18 * scale, 15 * scale, 5 * scale, '#e2e8f0', '#475569', 1.5);
    roundRect(ctx, len - 42 * scale, -8.5 * scale, 38 * scale, 17 * scale, 5 * scale, gripColor);
    ctx.beginPath();
    ctx.arc(0, 0, 25 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();
    ctx.restore();
  }

  function drawOrbitalArrow(ctx, cx, cy, r, startRad, spanRad, clockwise, color, width) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, startRad, startRad + spanRad);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();

    const tipAngle = clockwise ? startRad + spanRad : startRad;
    const tang = clockwise ? tipAngle + Math.PI / 2 : tipAngle - Math.PI / 2;
    const tx = cx + r * Math.cos(tipAngle);
    const ty = cy + r * Math.sin(tipAngle);
    const s = width * 2.2;
    ctx.beginPath();
    ctx.moveTo(tx + s * Math.cos(tang), ty + s * Math.sin(tang));
    ctx.lineTo(tx + s * Math.cos(tang + 2.35), ty + s * Math.sin(tang + 2.35));
    ctx.lineTo(tx + s * Math.cos(tang - 2.35), ty + s * Math.sin(tang - 2.35));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawToothedSprocket(ctx, cx, cy, r, rot, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    const teeth = 12;
    for (let i = 0; i < teeth * 2; i++) {
      const rr = i % 2 === 0 ? r : r - 3.5;
      const a = (i * Math.PI) / teeth;
      const px = rr * Math.cos(a), py = rr * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -(r - 7), 3.8, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.restore();
  }

  function drawSpecPill(ctx, x, y, text, accent, scale) {
    roundRect(ctx, x, y, 114 * scale, 27 * scale, 7 * scale, 'rgba(9, 14, 26, 0.94)', accent, 1.5);
    ctx.fillStyle = accent;
    ctx.font = `bold ${Math.max(10, Math.round(11.5 * scale))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(String(text || '').slice(0, 14), x + 57 * scale, y + 18 * scale);
    ctx.textAlign = 'left';
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth = 1.5) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /* =========================================================================
   * 5. Text Corpus Scanner & Custom Raw Text Parser (0% Book Images!)
   * ========================================================================= */
  const ACTION_START_RE = /^(?:ЗАМЕНА|СНЯТИЕ\s+И\s+УСТАНОВКА|СНЯТИЕ|РАЗБОРКА|РЕМОНТ|ПРОВЕРКА\s+И\s+РЕГУЛИРОВКА|ПРОВЕРКА|РЕГУЛИРОВКА|ПРОКАЧКА|ОЧИСТКА|ОБСЛУЖИВАНИЕ|СМАЗКА|ДИАГНОСТИКА)/i;

  function scanBookForProcedures(manualIndex, pagesText, bookTitle = '') {
    const results = [];
    const seenKeys = new Set();

    const sections = (manualIndex && manualIndex.sections) || [];
    for (const sec of sections) {
      const cat = categorizeSection(sec.title);
      for (const item of (sec.items || [])) {
        if (!ACTION_START_RE.test(item.title) && item.title.length < 14) continue;
        const p = item.pdfPage || item.bookPage || 1;
        const key = `${p}:${item.title.slice(0, 24)}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const pObj = (pagesText && pagesText[p - 1]) || { text: '' };
        const pNext = (pagesText && pagesText[p]) || { text: '' };
        const combined = `${pObj.text || ''} ${pNext.text || ''}`;

        const steps = extractCleanStepsFromPageText(combined, item.title);
        if (steps.length < 2) continue;

        const sub = detectSubsystemFromText(`${item.title} ${sec.title} ${combined.slice(0, 500)}`);
        const actions = steps.slice(0, 6).map((s) => classifyMechanicalAction(s, '', combined));

        results.push({
          id: `proc-p${p}-${results.length}`,
          title: item.title,
          sectionTitle: sec.title,
          subsystem: sub,
          category: cat,
          pdfPage: p,
          bookPage: item.bookPage || p,
          stepsText: steps.slice(0, 6),
          actionsPreview: dedupeBadges(actions),
          hasTorque: /(\d+)\s*(?:Н\s*[·*]\s*м|Нм|Nm)/i.test(combined),
          estDurationSec: Math.min(68, Math.max(26, steps.slice(0, 6).length * 8)),
          bookTitle,
          rawContext: combined.slice(0, 2600)
        });
      }
    }

    if (results.length < 8 && Array.isArray(pagesText)) {
      for (const pg of pagesText) {
        if (!pg || !pg.text || pg.text.length < 120) continue;
        const steps = extractCleanStepsFromPageText(pg.text, '');
        if (steps.length >= 3 && !results.some((r) => Math.abs(r.pdfPage - pg.pdfPage) <= 1)) {
          const headingMatch = pg.text.match(/(?:ЗАМЕНА|СНЯТИЕ\s+И\s+УСТАНОВКА|РЕГУЛИРОВКА|ПРОВЕРКА|ПРОКАЧКА)\s+[А-ЯЁA-Z0-9 ,()-]{4,65}/);
          const title = headingMatch
            ? formatSentenceCase(headingMatch[0])
            : `Операция по тексту стр. ${pg.bookPage || pg.pdfPage}`;
          const sub = detectSubsystemFromText(`${title} ${pg.text.slice(0, 500)}`);
          const actions = steps.slice(0, 6).map((s) => classifyMechanicalAction(s, '', pg.text));
          results.push({
            id: `proc-scan-${pg.pdfPage}`,
            title,
            sectionTitle: sub.name,
            subsystem: sub,
            category: categorizeSection(title),
            pdfPage: pg.pdfPage,
            bookPage: pg.bookPage || pg.pdfPage,
            stepsText: steps.slice(0, 6),
            actionsPreview: dedupeBadges(actions),
            hasTorque: /(\d+)\s*(?:Н\s*[·*]\s*м|Нм|Nm)/i.test(pg.text),
            estDurationSec: Math.min(65, Math.max(26, steps.slice(0, 6).length * 8)),
            bookTitle,
            rawContext: pg.text.slice(0, 2600)
          });
        }
        if (results.length >= 90) break;
      }
    }

    results.sort((a, b) => {
      const scoreA = (ACTION_START_RE.test(a.title) ? 10 : 0) + (a.hasTorque ? 5 : 0) + a.stepsText.length;
      const scoreB = (ACTION_START_RE.test(b.title) ? 10 : 0) + (b.hasTorque ? 5 : 0) + b.stepsText.length;
      return scoreB - scoreA || a.pdfPage - b.pdfPage;
    });

    return results.slice(0, 120);
  }

  /* Parses ANY custom user-supplied text block into a structured Procedure */
  function analyzeRawTextToProcedure(customTitle, rawText) {
    const cleaned = String(rawText || '').replace(/\r/g, '\n').trim();
    const lines = cleaned.split(/\n+/).map((l) => l.trim()).filter(Boolean);

    let title = String(customTitle || '').trim();
    if (!title) {
      if (lines[0] && lines[0].length <= 85 && !/^\d+[.)]/.test(lines[0])) {
        title = lines.shift();
      } else {
        title = 'Операция по вашему тексту';
      }
    }

    const body = lines.join(' ');
    let steps = [];
    // First try numbered lines / sentences
    for (const ln of lines) {
      const m = ln.match(/^(?:\d{1,2}[.)]|[-•▪])\s*(.+)$/);
      if (m && m[1].length >= 8) {
        steps.push(m[1].trim());
      }
    }
    if (steps.length < 2) {
      steps = extractCleanStepsFromPageText(body, '');
    }
    if (steps.length === 0 && cleaned.length >= 10) {
      steps = [cleaned.slice(0, 180)];
    }

    const sub = detectSubsystemFromText(`${title} ${cleaned}`);
    const actions = steps.slice(0, 8).map((s) => classifyMechanicalAction(s, '', cleaned));

    // Preload backdrop immediately
    getSyntheticStudioBackdrop(sub.poster);

    return {
      id: `custom-${Date.now()}`,
      title,
      sectionTitle: sub.name,
      subsystem: sub,
      category: 'custom',
      pdfPage: 1,
      bookPage: 'Текст',
      stepsText: steps.slice(0, 8),
      actionsPreview: dedupeBadges(actions),
      hasTorque: /(\d+)\s*(?:Н\s*[·*]\s*м|Нм|Nm)/i.test(cleaned),
      estDurationSec: Math.max(20, steps.slice(0, 8).length * 8),
      bookTitle: 'Пользовательский текст',
      rawContext: cleaned
    };
  }

  function categorizeSection(secTitle) {
    const s = String(secTitle || '').toLowerCase();
    if (/двигател|систем.*питани|охлажден|выпуск|смазк|грм/.test(s)) return 'engine';
    if (/тормоз|подвеск|рулев|колес|ходова/.test(s)) return 'chassis';
    if (/электр|зажиган|генератор|стартер|освещ/.test(s)) return 'electric';
    if (/трансмисс|сцеплен|коробк|привод/.test(s)) return 'transmission';
    return 'body_maint';
  }

  function dedupeBadges(actions) {
    const out = [];
    const seen = new Set();
    for (const a of actions) {
      if (!seen.has(a.kind)) {
        seen.add(a.kind);
        out.push({ icon: a.icon, badge: a.badge, accent: a.accent, specVal: a.specVal });
      }
      if (out.length >= 4) break;
    }
    return out;
  }

  function extractCleanStepsFromPageText(text, procTitle) {
    if (!text) return [];
    let slice = text;
    if (procTitle && procTitle.length > 6) {
      const idx = text.toLowerCase().indexOf(procTitle.slice(0, 16).toLowerCase());
      if (idx > 0) slice = text.slice(idx);
    }

    const numbered = [];
    const re = /(?:^|\s)(\d{1,2})\.\s+([А-ЯЁA-Z][^.!?]{8,195}[.!?]?)/g;
    let m;
    while ((m = re.exec(slice)) !== null && numbered.length < 8) {
      const stepStr = m[2]
        .replace(/\(см\.\s*рис[^)]*\)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (stepStr.length >= 10 && !numbered.includes(stepStr)) {
        numbered.push(/[.!?]$/.test(stepStr) ? stepStr : `${stepStr}.`);
      }
    }
    if (numbered.length >= 2) return numbered;

    const sentences = slice
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.replace(/\(см\.\s*рис[^)]*\)/gi, '').replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 18 && s.length <= 185 && !/^\d+\s+Ford/i.test(s));
    return sentences.slice(0, 6);
  }

  function formatSentenceCase(str) {
    const s = String(str || '').trim();
    if (!s) return 'Операция ремонта';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  /* Pure Text -> Animated Video Generator (ZERO book image loading!) */
  async function generateAnimatedShortFromProcedure(proc, onStageLog) {
    const log = (phaseIdx, msg) => {
      if (onStageLog) onStageLog(phaseIdx, msg);
    };

    const ctxText = proc.rawContext || proc.stepsText.join(' ');
    const sub = proc.subsystem || detectSubsystemFromText(`${proc.title} ${ctxText}`);
    getSyntheticStudioBackdrop(sub.poster);

    log(1, `Фаза 1/4 (NLU): Разбор текста «${proc.title}» — система: ${sub.name}, шагов: ${proc.stepsText.length}…`);
    await sleep(110);

    const toolMatch = ctxText.match(/(?:Вам потребуются|Инструмент)\s*[:–-]?\s*([^.!?\n]{5,140})/i);
    const warnMatch = ctxText.match(/(?:ПРЕДУПРЕЖДЕНИЕ|ВНИМАНИЕ)\s*[!:–-]?\s*([^.!?\n]{12,165}[.!?]?)/i);
    const nmList = [...ctxText.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*(?:Н\s*[·*]\s*м|Нм|Nm)/gi)].map((x) => `${x[1]} Н·м`);

    log(2, `Фаза 2/4 (Синтез сцены): Построение 3D/2.5D модели узла «${sub.name}» без использования картинок книги…`);
    await sleep(110);

    let cursor = 0;
    const animatedSteps = proc.stepsText.map((stepTxt, idx) => {
      const stepSub = detectSubsystemFromText(`${stepTxt} ${proc.title}`);
      getSyntheticStudioBackdrop(stepSub.poster);
      const act = classifyMechanicalAction(stepTxt, toolMatch ? toolMatch[1] : '', ctxText);
      const conciseNarration = buildConciseShortLine(stepTxt, idx, proc.title, act);
      const dur = Math.max(5.5, Math.min(12.5, +(conciseNarration.length / 13.5).toFixed(1)));
      const stObj = {
        num: idx + 1,
        caption: stepTxt,
        spokenLine: conciseNarration,
        subsystem: stepSub,
        tool: act.toolName,
        part: act.partName,
        action: act,
        startTime: cursor,
        endTime: +(cursor + dur).toFixed(2),
        duration: dur
      };
      cursor = stObj.endTime;
      return stObj;
    });

    log(3, `Фаза 3/4 (Кинематика и диктор): Привязка инструментов, векторов вращения и караоке-субтитров (${Math.round(cursor)} с)…`);
    await sleep(100);

    const shortVideo = {
      id: proc.id,
      title: proc.title,
      sectionTitle: sub.name,
      subsystem: sub,
      bookTitle: proc.bookTitle || 'Текстовый синтез',
      bookPage: proc.bookPage,
      pdfPage: proc.pdfPage,
      totalDuration: cursor,
      keyTorque: nmList[0] || (animatedSteps[0] && animatedSteps[0].action.specVal) || 'Контроль по ТК',
      warning: warnMatch ? warnMatch[1] : 'Соблюдайте технику безопасности и чистоту резьбовых соединений.',
      toolsSummary: toolMatch ? toolMatch[1] : animatedSteps.map((s) => s.tool).filter(Boolean).slice(0, 3).join(', '),
      steps: animatedSteps
    };

    log(4, `Фаза 4/4: Готово! Сгенерировано чистое анимированное видео (${Math.round(cursor)} сек) без картинок из книги.`);
    return shortVideo;
  }

  function buildConciseShortLine(stepTxt, idx, procTitle, act) {
    const clean = stepTxt
      .replace(/\(см\.\s*[^)]+\)/gi, '')
      .replace(/рис\.\s*\d+[.,]\d+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (idx === 0) {
      return `${procTitle}. Шаг первый: ${clean}`;
    }
    if (act.kind === 'torque_cw' && !/момент/i.test(clean) && act.specVal.includes('Н·м')) {
      return `Шаг ${idx + 1}: ${clean} Затяните моментом ${act.specVal}.`;
    }
    return `Шаг ${idx + 1}: ${clean}`;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* =========================================================================
   * 6. Interactive Pure-Synthetic Short Video Player (9:16 Shorts & 16:9 HD)
   * ========================================================================= */
  class ShortAnimatedVideoPlayer {
    constructor(canvasEl, callbacks = {}) {
      this.canvas = canvasEl;
      this.ctx = canvasEl ? canvasEl.getContext('2d') : null;
      this.videoData = null;
      this.aspect = '9:16';
      this.visualMode = '3d_hybrid'; // '3d_hybrid' | 'pure_cad'
      this.playing = false;
      this.rate = 1.0;
      this.currentTime = 0;
      this.activeStepIdx = -1;
      this.rafId = null;
      this.lastTick = 0;
      this.onTimeUpdate = callbacks.onTimeUpdate || null;
      this.onStateChange = callbacks.onStateChange || null;
      this.onStepChange = callbacks.onStepChange || null;
    }

    setAspect(mode) {
      this.aspect = mode === '16:9' ? '16:9' : '9:16';
      if (this.canvas) {
        if (this.aspect === '9:16') {
          this.canvas.width = 720;
          this.canvas.height = 1280;
        } else {
          this.canvas.width = 1280;
          this.canvas.height = 720;
        }
      }
      this.renderFrame();
    }

    setVisualMode(mode) {
      this.visualMode = mode === 'pure_cad' ? 'pure_cad' : '3d_hybrid';
      this.renderFrame();
    }

    setRate(r) {
      this.rate = Math.min(1.6, Math.max(0.8, r || 1.0));
      if (this.playing) this.speakStepAtCurrentTime(true);
    }

    loadShort(videoData) {
      this.pause();
      this.videoData = videoData;
      this.currentTime = 0;
      this.activeStepIdx = -1;
      this.setAspect(this.aspect);
      // Re-render shortly once studio backdrop finishes async image decode
      setTimeout(() => this.renderFrame(), 180);
      if (this.onTimeUpdate) this.onTimeUpdate(0, this.getTotalDuration());
    }

    getTotalDuration() {
      return (this.videoData && this.videoData.totalDuration) || 30;
    }

    getStepIndexAt(t) {
      if (!this.videoData || !this.videoData.steps.length) return 0;
      const idx = this.videoData.steps.findIndex((s) => t >= s.startTime && t < s.endTime);
      return idx === -1 ? this.videoData.steps.length - 1 : idx;
    }

    play() {
      if (!this.videoData || this.playing) return;
      if (this.currentTime >= this.getTotalDuration() - 0.25) {
        this.currentTime = 0;
        this.activeStepIdx = -1;
      }
      this.playing = true;
      this.lastTick = performance.now();
      this.speakStepAtCurrentTime(true);
      this.loop();
      if (this.onStateChange) this.onStateChange(true);
    }

    pause() {
      this.playing = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (window.ManualBookEngine) {
        window.ManualBookEngine.SpeechEngine.stop();
      }
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
      const sIdx = this.getStepIndexAt(this.currentTime);
      if (this.onStepChange) this.onStepChange(sIdx);
      if (this.playing) this.speakStepAtCurrentTime(true);
    }

    speakStepAtCurrentTime(force = false) {
      if (!this.videoData) return;
      const sIdx = this.getStepIndexAt(this.currentTime);
      if (!force && sIdx === this.activeStepIdx) return;
      this.activeStepIdx = sIdx;
      const st = this.videoData.steps[sIdx];
      if (this.onStepChange) this.onStepChange(sIdx);
      if (st && this.playing && window.ManualBookEngine) {
        window.ManualBookEngine.SpeechEngine.speak(st.spokenLine, { rate: this.rate });
      }
    }

    loop() {
      if (!this.playing) return;
      const now = performance.now();
      const dt = Math.min(0.08, (now - this.lastTick) / 1000) * this.rate;
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

      this.speakStepAtCurrentTime(false);
      this.renderFrame();
      if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, total);
      this.rafId = requestAnimationFrame(() => this.loop());
    }

    renderFrame() {
      if (!this.ctx || !this.videoData) return;
      const ctx = this.ctx;
      const W = this.canvas.width;
      const H = this.canvas.height;
      const v = this.videoData;
      const sIdx = this.getStepIndexAt(this.currentTime);
      const st = v.steps[sIdx] || v.steps[0];
      if (!st) return;

      const stepSpan = Math.max(0.5, st.endTime - st.startTime);
      const stepProg = Math.min(1, Math.max(0, (this.currentTime - st.startTime) / stepSpan));
      const tSec = this.currentTime;

      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#070b15');
      bgGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      if (this.aspect === '9:16') {
        this.renderVerticalShortsFrame(ctx, W, H, v, st, sIdx, stepProg, tSec);
      } else {
        this.renderHorizontalHdFrame(ctx, W, H, v, st, sIdx, stepProg, tSec);
      }
    }

    renderVerticalShortsFrame(ctx, W, H, v, st, sIdx, stepProg, tSec) {
      const n = v.steps.length;
      const gap = 8;
      const segW = (W - 56 - gap * (n - 1)) / Math.max(1, n);
      for (let i = 0; i < n; i++) {
        const sx = 28 + i * (segW + gap);
        roundRect(ctx, sx, 22, segW, 8, 4, 'rgba(51, 65, 85, 0.85)');
        const fillRatio = i < sIdx ? 1 : (i === sIdx ? stepProg : 0);
        if (fillRatio > 0) {
          roundRect(ctx, sx, 22, Math.max(6, segW * fillRatio), 8, 4, st.action.accent);
        }
      }

      roundRect(ctx, 28, 46, 260, 34, 8, st.action.accent);
      ctx.fillStyle = '#090e1a';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillText(`ШАГ ${sIdx + 1} ИЗ ${n} • ИИ-СИНТЕЗ СЦЕНЫ`, 42, 68);

      roundRect(ctx, W - 210, 46, 182, 34, 8, 'rgba(30, 41, 59, 0.9)', st.action.accent, 1.5);
      ctx.fillStyle = st.action.accent;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(v.keyTorque.slice(0, 14), W - 119, 68);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 25px Inter, system-ui, sans-serif';
      drawWrapped(ctx, v.title, 28, 114, W - 56, 31, 2);

      // Full-Stage Synthetic 3D/CAD Animated Scene (ZERO book scans!)
      renderFullSyntheticScene(ctx, { x: 28, y: 168, w: W - 56, h: 774 }, st, tSec, stepProg, this.visualMode);

      // Bottom Live Karaoke Subtitles
      this.drawKaraokeSubtitles(ctx, { x: 28, y: 960, w: W - 56, h: 286 }, st, stepProg, v.warning);
    }

    renderHorizontalHdFrame(ctx, W, H, v, st, sIdx, stepProg, tSec) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, W, 68);
      roundRect(ctx, 24, 16, 246, 36, 8, st.action.accent);
      ctx.fillStyle = '#090e1a';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillText(`ШАГ ${sIdx + 1} / ${v.steps.length} • ЧИСТЫЙ СИНТЕЗ`, 38, 39);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px Inter, system-ui, sans-serif';
      ctx.fillText(v.title.slice(0, 52), 286, 41);

      // Full-Width Synthetic Scene Stage (1232 x 464)
      renderFullSyntheticScene(ctx, { x: 24, y: 84, w: W - 48, h: 464 }, st, tSec, stepProg, this.visualMode);

      // Bottom Karaoke Subtitles
      this.drawKaraokeSubtitles(ctx, { x: 24, y: 562, w: W - 48, h: 140 }, st, stepProg, v.warning);
    }

    drawKaraokeSubtitles(ctx, rect, st, stepProg, warningText) {
      const { x, y, w, h } = rect;
      roundRect(ctx, x, y, w, h, 16, 'rgba(15, 23, 42, 0.94)', 'rgba(51, 65, 85, 0.9)', 1.5);

      const words = String(st.spokenLine || st.caption || '').split(/\s+/).filter(Boolean);
      const activeWordIdx = Math.min(words.length - 1, Math.floor(stepProg * words.length));

      const fontSize = h > 180 ? 23 : 19;
      const lineH = Math.round(fontSize * 1.38);
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;

      const maxW = w - 40;
      const lines = [];
      let curLine = [];
      let curW = 0;
      words.forEach((word, wIdx) => {
        const ww = ctx.measureText(word + ' ').width;
        if (curW + ww > maxW && curLine.length > 0) {
          lines.push(curLine);
          curLine = [{ word, wIdx, ww }];
          curW = ww;
        } else {
          curLine.push({ word, wIdx, ww });
          curW += ww;
        }
      });
      if (curLine.length) lines.push(curLine);

      const maxLines = h > 180 ? 5 : 3;
      let ty = y + (h > 180 ? 38 : 32);
      lines.slice(0, maxLines).forEach((ln) => {
        let tx = x + 20;
        ln.forEach((tok) => {
          if (tok.wIdx < activeWordIdx) {
            ctx.fillStyle = '#f8fafc';
          } else if (tok.wIdx === activeWordIdx) {
            roundRect(ctx, tx - 4, ty - fontSize + 2, tok.ww + 2, fontSize + 6, 5, st.action.accent);
            ctx.fillStyle = '#090e1a';
          } else {
            ctx.fillStyle = '#94a3b8';
          }
          ctx.fillText(tok.word, tx, ty);
          tx += tok.ww;
        });
        ty += lineH;
      });

      if (h > 180 && warningText) {
        roundRect(ctx, x + 16, y + h - 46, w - 32, 32, 8, 'rgba(127, 29, 29, 0.45)', 'rgba(239, 68, 68, 0.6)', 1);
        ctx.fillStyle = '#fecaca';
        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        ctx.fillText(`⚠️ ${warningText.slice(0, 68)}${warningText.length > 68 ? '…' : ''}`, x + 26, y + h - 25);
      }
    }

    exportWebm(onStatus) {
      if (!this.canvas || !this.canvas.captureStream || typeof MediaRecorder === 'undefined') {
        alert('Экспорт WebM не поддерживается в этом браузере.');
        return;
      }
      const stream = this.canvas.captureStream(30);
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
        const safeName = (this.videoData ? this.videoData.title : 'agent-video')
          .replace(/[^a-zA-Z0-9\u0400-\u04FF]+/g, '_')
          .slice(0, 42);
        a.download = `${safeName}_${this.aspect.replace(':', 'x')}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        if (onStatus) onStatus(false);
      };
      if (onStatus) onStatus(true);
      this.currentTime = 0;
      this.activeStepIdx = -1;
      rec.start();
      this.play();
      const timer = setInterval(() => {
        if (!this.playing) {
          clearInterval(timer);
          if (rec.state !== 'inactive') rec.stop();
        }
      }, 250);
    }
  }

  function drawWrapped(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = String(text || '').split(/\s+/);
    let line = '';
    let count = 0;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y + count * lineH);
        count++;
        line = w;
        if (count >= maxLines) return;
      } else {
        line = test;
      }
    }
    if (line && count < maxLines) {
      ctx.fillText(line, x, y + count * lineH);
    }
  }

  window.BookVideoAgent = {
    detectSubsystemFromText,
    classifyMechanicalAction,
    renderFullSyntheticScene,
    drawAnimatedMechanismBox,
    scanBookForProcedures,
    analyzeRawTextToProcedure,
    generateAnimatedShortFromProcedure,
    ShortAnimatedVideoPlayer
  };
})();
