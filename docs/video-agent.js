(function () {
  'use strict';

  /* =========================================================================
   * 1. Semantic Mechanical Action Classifier (Оживление каждого действия)
   * ========================================================================= */
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
      badge: 'ЗАТЯЖКА ПО МОМЕНТУ',
      accent: '#f59e0b',
      accentRgb: [245, 158, 11],
      defaultVal: '↻ По моменту'
    },
    drain_fluid: {
      icon: '💧',
      badge: 'СЛИВ РАБОЧЕЙ ЖИДКОСТИ',
      accent: '#fbbf24',
      accentRgb: [251, 191, 36],
      defaultVal: 'Слив в ёмкость'
    },
    fill_fluid: {
      icon: '🛢',
      badge: 'ЗАЛИВКА ПО УРОВНЮ',
      accent: '#10b981',
      accentRgb: [16, 185, 129],
      defaultVal: 'MIN ──▶ MAX'
    },
    lubricate: {
      icon: '✨',
      badge: 'СМАЗКА / ФИКСАТОР РЕЗЬБЫ',
      accent: '#a78bfa',
      accentRgb: [167, 139, 250],
      defaultVal: 'Слой 360°'
    },
    clean_air: {
      icon: '💨',
      badge: 'ОЧИСТКА И ПРОДУВКА УЗЛА',
      accent: '#22d3ee',
      accentRgb: [34, 211, 238],
      defaultVal: 'Очистка чисто'
    },
    pry_clip: {
      icon: '🪛',
      badge: 'СНЯТИЕ ФИКСАТОРА / РАЗЪЁМА',
      accent: '#fb923c',
      accentRgb: [251, 146, 60],
      defaultVal: 'Отщёлкнуть'
    },
    remove_part: {
      icon: '📤',
      badge: 'ДЕМОНТАЖ И СНЯТИЕ ДЕТАЛИ',
      accent: '#f97316',
      accentRgb: [249, 115, 22],
      defaultVal: 'Вывод детали'
    },
    press_install: {
      icon: '📥',
      badge: 'УСТАНОВКА И ПОСАДКА УЗЛА',
      accent: '#10b981',
      accentRgb: [16, 185, 129],
      defaultVal: 'Посадка в паз'
    },
    belt_align: {
      icon: '⚙️',
      badge: 'ПРИВОД ГРМ И МЕТКИ ВМТ',
      accent: '#34d399',
      accentRgb: [52, 211, 153],
      defaultVal: 'Метки ВМТ ✓'
    },
    measure_gap: {
      icon: '📏',
      badge: 'КОНТРОЛЬНЫЙ ЗАМЕР И ОСМОТР',
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

    let kind = 'measure_gap';
    if (/(?:слейте|слить|откачайте|вытека)/i.test(txt)) {
      kind = 'drain_fluid';
    } else if (/(?:залейте|заполните|долейте|прокачайте\s+гидро)/i.test(txt)) {
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
    } else if (/(?:подденьте|отсоедините|колодку|разъем|фиксатор|скоб[уы]|стопорн)/i.test(txt)) {
      kind = 'pry_clip';
    } else if (/(?:снимите|извлеките|выньте|демонтируйте|выведите|разрежьте)/i.test(txt)) {
      kind = 'remove_part';
    } else if (/(?:щуп|зазор|измерьте|проверьте|осмотрите|толщин|уровен)/i.test(txt)) {
      kind = 'measure_gap';
    }

    const meta = ACTION_META[kind] || ACTION_META.measure_gap;
    let specVal = meta.defaultVal;
    if (nmMatch && (kind === 'torque_cw' || kind === 'drain_fluid')) {
      specVal = `${nmMatch[1]} Н·м${degMatch ? ' +' + degMatch[1] + '°' : ''}`;
    } else if (mmMatch) {
      specVal = `${mmMatch[1]} мм`;
    } else if (literMatch) {
      specVal = `${literMatch[1]} л`;
    } else if (/3\/4/.test(raw)) {
      specVal = '+3/4 оборота';
    }

    return {
      kind,
      icon: meta.icon,
      badge: meta.badge,
      accent: meta.accent,
      accentRgb: meta.accentRgb,
      specVal
    };
  }

  /* =========================================================================
   * 2. Vivid Image Colorizer (Превращает ч/б и тусклые кадры книги в цветные)
   * ========================================================================= */
  const colorizedCache = new Map();

  function colorizeBookCanvas(sourceImg, cacheKey = '', enableColorize = true) {
    if (!sourceImg) return null;
    const key = `${cacheKey}:${enableColorize ? 'vivid' : 'raw'}`;
    if (cacheKey && colorizedCache.has(key)) {
      return colorizedCache.get(key);
    }

    const srcW = sourceImg.naturalWidth || sourceImg.width || 640;
    const srcH = sourceImg.naturalHeight || sourceImg.height || 480;
    const scale = Math.min(1, 760 / Math.max(1, srcW));
    const w = Math.max(16, Math.round(srcW * scale));
    const h = Math.max(16, Math.round(srcH * scale));

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(sourceImg, 0, 0, w, h);

    if (!enableColorize) {
      if (cacheKey) colorizedCache.set(key, c);
      return c;
    }

    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const nPix = w * h;

      // Measure average saturation & luminance range
      let satSum = 0;
      let lumMin = 255;
      let lumMax = 0;
      for (let i = 0; i < d.length; i += 16) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        satSum += (mx - mn);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < lumMin) lumMin = lum;
        if (lum > lumMax) lumMax = lum;
      }
      const avgSat = satSum / Math.max(1, nPix / 4);
      const span = Math.max(35, lumMax - lumMin);
      const isLowSat = avgSat < 28;

      // Apply zone-aware workshop colorization for B&W/grey images OR rich vibrance boost for color photos
      const invW = 2 / w, invH = 2 / h;
      for (let y = 0; y < h; y++) {
        const ny = y * invH - 1;
        const rowOff = y * w * 4;
        for (let x = 0; x < w; x++) {
          const idx = rowOff + x * 4;
          const r = d[idx], g = d[idx + 1], b = d[idx + 2];
          let lum = (0.299 * r + 0.587 * g + 0.114 * b - lumMin) / span;
          lum = lum < 0 ? 0 : (lum > 1 ? 1 : lum);
          // Smooth S-curve contrast
          const sc = lum * lum * (3 - 2 * lum);

          const nx = x * invW - 1;
          const dist2 = nx * nx + ny * ny;
          const spotlight = Math.exp(-dist2 * 1.45); // Warm center focus on active node

          if (isLowSat) {
            // Convert greyscale / B&W line art into rich multi-tone color technical illustration!
            // Dark contours -> deep cobalt steel; Midtones -> metallic cyan-slate; Active focus -> warm amber/brass
            const shadowR = 14, shadowG = 26, shadowB = 48;
            const midR = 72 + 125 * spotlight;
            const midG = 112 + 68 * spotlight;
            const midB = 158 - 42 * spotlight;
            const hiR = 236 + 18 * spotlight;
            const hiG = 238 + 6 * spotlight;
            const hiB = 242 - 36 * spotlight;

            let nr, ng, nb;
            if (sc < 0.5) {
              const t = sc * 2;
              nr = shadowR + (midR - shadowR) * t;
              ng = shadowG + (midG - shadowG) * t;
              nb = shadowB + (midB - shadowB) * t;
            } else {
              const t = (sc - 0.5) * 2;
              nr = midR + (hiR - midR) * t;
              ng = midG + (hiG - midG) * t;
              nb = midB + (hiB - midB) * t;
            }
            d[idx] = Math.min(255, Math.max(0, (nr * 0.78 + r * 0.22) | 0));
            d[idx + 1] = Math.min(255, Math.max(0, (ng * 0.78 + g * 0.22) | 0));
            d[idx + 2] = Math.min(255, Math.max(0, (nb * 0.78 + b * 0.22) | 0));
          } else {
            // Boost color saturation + contrast + subtle center warm illumination
            const baseLum = sc * 255;
            const boost = 1.52;
            const warm = 14 * spotlight;
            d[idx] = Math.min(255, Math.max(0, (baseLum + (r - (0.299 * r + 0.587 * g + 0.114 * b)) * boost + warm) | 0));
            d[idx + 1] = Math.min(255, Math.max(0, (baseLum + (g - (0.299 * r + 0.587 * g + 0.114 * b)) * boost + warm * 0.4) | 0));
            d[idx + 2] = Math.min(255, Math.max(0, (baseLum + (b - (0.299 * r + 0.587 * g + 0.114 * b)) * boost) | 0));
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (_) {
      // Cross-origin fallback: CSS filter equivalent via canvas draw
    }

    if (cacheKey) {
      if (colorizedCache.size > 120) colorizedCache.clear();
      colorizedCache.set(key, c);
    }
    return c;
  }

  /* =========================================================================
   * 3. 60 FPS Procedural Colorful Mechanical Action Animator (2D Vector Engine)
   *    Draws vivid animated tools, bolts, fluids, belts, gauges on ANY canvas!
   * ========================================================================= */
  function drawAnimatedMechanismBox(ctx, box, action, tSec, stepProg) {
    const { x, y, w, h, transparentBg = false } = box;
    const [ar, ag, ab] = action.accentRgb || [56, 189, 248];
    const accent = action.accent || '#38bdf8';

    ctx.save();
    if (!transparentBg) {
      roundRect(ctx, x, y, w, h, 14, 'rgba(10, 16, 30, 0.90)', `rgba(${ar}, ${ag}, ${ab}, 0.85)`, 2);
      // Top header strip inside animation box
      roundRect(ctx, x + 10, y + 9, w - 20, 26, 7, `rgba(${ar}, ${ag}, ${ab}, 0.16)`);
      ctx.fillStyle = accent;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.fillText(`${action.icon} ОЖИВЛЁННОЕ ДЕЙСТВИЕ: ${action.badge}`, x + 18, y + 26);
    }

    const cx = x + w * 0.44;
    const cy = y + (transparentBg ? h * 0.52 : 36 + (h - 36) * 0.52);
    const scale = Math.min(w / 360, h / 200);

    switch (action.kind) {
      case 'unscrew_ccw': {
        // Oscillating chrome ratchet wrench + counter-clockwise spinning hex bolt + glowing cyan orbital arcs
        const cyc = (tSec * 1.35) % 1;
        const wrenchDeg = cyc < 0.68
          ? -15 - 58 * Math.sin((cyc / 0.68) * Math.PI * 0.5)
          : -73 + 58 * ((cyc - 0.68) / 0.32);
        const boltRot = -tSec * 2.6;
        const liftOut = 6 * Math.sin(tSec * 2.2);

        drawOrbitalArrow(ctx, cx, cy, 52 * scale, -tSec * 2.4, 2.0, false, accent, 4.5 * scale);
        drawOrbitalArrow(ctx, cx, cy, 52 * scale, -tSec * 2.4 + Math.PI, 2.0, false, `rgba(${ar},${ag},${ab},0.55)`, 3.5 * scale);
        drawRatchetWrench(ctx, cx, cy + liftOut * 0.3, wrenchDeg, 108 * scale, scale, accent);
        drawHexFastener(ctx, cx, cy + liftOut * 0.3, 19 * scale, boltRot, '#e2e8f0', accent);
        drawSpecPill(ctx, x + w - 122 * scale, y + h - 38 * scale, action.specVal, accent, scale);
        break;
      }

      case 'torque_cw': {
        // Sweeping torque wrench CW + rising circular Nm gauge + emerald CLICK shockwave
        const cyc = (tSec * 0.68) % 1.18;
        const clamped = Math.min(1, cyc);
        const clicked = cyc >= 0.94;
        const liveCol = clicked ? '#10b981' : '#f59e0b';
        const wrenchDeg = -135 + 100 * clamped;

        drawOrbitalArrow(ctx, cx - 18 * scale, cy, 48 * scale, tSec * 2.2, 1.9, true, liveCol, 4.5 * scale);
        drawRatchetWrench(ctx, cx - 18 * scale, cy, wrenchDeg, 102 * scale, scale, liveCol);
        drawHexFastener(ctx, cx - 18 * scale, cy, 18 * scale, tSec * 1.9, '#fbbf24', liveCol);

        // Live Circular Torque Dial on right
        const gx = x + w - 68 * scale;
        const gy = cy;
        const gr = 38 * scale;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * 2.25);
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.7)';
        ctx.lineWidth = 8 * scale;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * clamped));
        ctx.strokeStyle = liveCol;
        ctx.lineWidth = 8 * scale;
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${Math.max(10, Math.round(12 * scale))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(action.specVal.slice(0, 10), gx, gy + 4 * scale);
        if (clicked) {
          const pulseR = (54 + (cyc - 0.94) * 90) * scale;
          ctx.beginPath();
          ctx.arc(cx - 18 * scale, cy, pulseR, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
          ctx.lineWidth = 3 * scale;
          ctx.stroke();
          ctx.fillStyle = '#34d399';
          ctx.font = `bold ${Math.max(10, Math.round(11 * scale))}px Inter, sans-serif`;
          ctx.fillText('ЩЕЛЧОК ✓', gx, gy + gr + 15 * scale);
        }
        ctx.textAlign = 'left';
        break;
      }

      case 'drain_fluid': {
        // Cutaway oil pan sump + unscrewed drain bolt + flowing golden amber stream & pan waves
        const sx = cx - 60 * scale;
        const sy = cy - 58 * scale;
        roundRect(ctx, sx, sy, 120 * scale, 34 * scale, 7 * scale, '#334155', '#94a3b8', 2);

        // Drain pan at bottom
        const py = cy + 32 * scale;
        ctx.beginPath();
        ctx.moveTo(sx - 8 * scale, py);
        ctx.lineTo(sx + 128 * scale, py);
        ctx.lineTo(sx + 112 * scale, py + 34 * scale);
        ctx.lineTo(sx + 8 * scale, py + 34 * scale);
        ctx.closePath();
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rising golden oil inside pan
        const oilH = (10 + 17 * (0.3 + 0.7 * stepProg)) * scale;
        ctx.fillStyle = 'rgba(217, 119, 6, 0.92)';
        ctx.fillRect(sx + 11 * scale, py + 31 * scale - oilH, 98 * scale, oilH);

        // Flowing turbulent golden stream + droplets
        const streamX = sx + 60 * scale;
        const wob = Math.sin(tSec * 14) * 3 * scale;
        const grad = ctx.createLinearGradient(streamX, sy + 34 * scale, streamX, py + 24 * scale);
        grad.addColorStop(0, '#fbbf24');
        grad.addColorStop(1, '#d97706');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(streamX - 5 * scale, sy + 34 * scale);
        ctx.lineTo(streamX + 5 * scale, sy + 34 * scale);
        ctx.lineTo(streamX + 3.5 * scale + wob, py + 24 * scale);
        ctx.lineTo(streamX - 3.5 * scale + wob, py + 24 * scale);
        ctx.closePath();
        ctx.fill();

        for (let k = 0; k < 6; k++) {
          const dy = ((tSec * 115 + k * 18) % 56) * scale;
          ctx.beginPath();
          ctx.arc(streamX + ((k % 2 ? 1 : -1) * 5 * scale), sy + 38 * scale + dy, 3 * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#fde68a';
          ctx.fill();
        }
        drawSpecPill(ctx, x + w - 122 * scale, y + h - 38 * scale, action.specVal, '#fbbf24', scale);
        break;
      }

      case 'fill_fluid': {
        // Tilted bright canister pouring glowing stream + rising transparent MIN->MAX reservoir
        const kx = x + 28 * scale;
        const ky = cy - 46 * scale;
        ctx.save();
        ctx.translate(kx + 40 * scale, ky + 24 * scale);
        ctx.rotate(0.18 + 0.08 * Math.sin(tSec * 2.5));
        roundRect(ctx, -40 * scale, -22 * scale, 78 * scale, 46 * scale, 9 * scale, '#f59e0b', '#fef3c7', 2);
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.max(9, Math.round(11 * scale))}px monospace`;
        ctx.fillText('МАСЛО', -24 * scale, 5 * scale);
        ctx.restore();

        // Parabolic glowing fluid droplets into tank
        for (let k = 0; k < 9; k++) {
          const f = ((k / 9) + (tSec * 0.9)) % 1;
          const px = kx + 82 * scale + f * 62 * scale;
          const py = ky + 20 * scale + f * f * 84 * scale;
          ctx.beginPath();
          ctx.arc(px, py, (4.2 - f * 1.2) * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
        }

        // Transparent level tank on right with MIN / MAX lines
        const tx = x + w - 108 * scale;
        const ty = cy - 52 * scale;
        const tw = 70 * scale;
        const th = 108 * scale;
        roundRect(ctx, tx, ty, tw, th, 8 * scale, '#0f172a', '#94a3b8', 2);
        const lvl = 0.25 + 0.58 * (0.5 + 0.5 * Math.sin(tSec * 1.8 - 1.1));
        const fh = (th - 10 * scale) * lvl;
        roundRect(ctx, tx + 4 * scale, ty + th - 5 * scale - fh, tw - 8 * scale, fh, 5 * scale, 'rgba(245, 158, 11, 0.9)');

        // MAX & MIN markers
        ctx.strokeStyle = '#10b981';
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
        // Dual rotating DOHC cam sprockets + bottom crank gear + moving belt + green TDC alignment laser
        const c1x = cx - 44 * scale, c1y = cy - 28 * scale;
        const c2x = cx + 44 * scale, c2y = cy - 28 * scale;
        const ckx = cx, cky = cy + 44 * scale;
        const rot = tSec * 1.3;

        // Animated dashed timing belt loop
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(c1x, c1y - 26 * scale);
        ctx.lineTo(c2x, c2y - 26 * scale);
        ctx.lineTo(c2x + 24 * scale, c2y + 4 * scale);
        ctx.lineTo(ckx + 20 * scale, cky + 18 * scale);
        ctx.lineTo(ckx - 20 * scale, cky + 18 * scale);
        ctx.lineTo(c1x - 24 * scale, c1y + 4 * scale);
        ctx.closePath();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 5 * scale;
        ctx.setLineDash([8 * scale, 5 * scale]);
        ctx.lineDashOffset = -tSec * 42 * scale;
        ctx.stroke();
        ctx.restore();

        drawToothedSprocket(ctx, c1x, c1y, 24 * scale, rot, '#cbd5e1');
        drawToothedSprocket(ctx, c2x, c2y, 24 * scale, rot, '#cbd5e1');
        drawToothedSprocket(ctx, ckx, cky, 19 * scale, rot * 2, '#94a3b8');

        // Glowing emerald TDC alignment bar across camshafts
        const glowAlpha = 0.55 + 0.45 * Math.sin(tSec * 6);
        ctx.strokeStyle = `rgba(16, 185, 129, ${glowAlpha.toFixed(2)})`;
        ctx.lineWidth = 4.5 * scale;
        ctx.beginPath();
        ctx.moveTo(c1x - 32 * scale, c1y);
        ctx.lineTo(c2x + 32 * scale, c2y);
        ctx.stroke();
        drawSpecPill(ctx, x + w - 122 * scale, y + h - 38 * scale, action.specVal, '#34d399', scale);
        break;
      }

      case 'press_install': {
        // Housing + piston/component sliding smoothly into seat under emerald compression chevrons
        const hx = cx - 72 * scale;
        const hy = cy - 40 * scale;
        roundRect(ctx, hx, hy, 96 * scale, 80 * scale, 8 * scale, '#334155', '#94a3b8', 2.5);
        const slide = (1 - (0.5 + 0.5 * Math.sin(tSec * 2.6 - 1.1))) * 44 * scale;
        roundRect(ctx, hx + 52 * scale + slide, hy + 12 * scale, 56 * scale, 56 * scale, 6 * scale, '#cbd5e1', '#10b981', 2.5);

        // Emerald compression chevrons pushing inward
        for (let k = 0; k < 3; k++) {
          const ax = hx + 128 * scale + slide + k * 14 * scale;
          ctx.beginPath();
          ctx.moveTo(ax + 10 * scale, cy - 12 * scale);
          ctx.lineTo(ax, cy);
          ctx.lineTo(ax + 10 * scale, cy + 12 * scale);
          ctx.strokeStyle = `rgba(16, 185, 129, ${0.95 - k * 0.25})`;
          ctx.lineWidth = 4 * scale;
          ctx.stroke();
        }
        drawSpecPill(ctx, x + w - 122 * scale, y + h - 38 * scale, action.specVal, '#10b981', scale);
        break;
      }

      case 'pry_clip':
      case 'remove_part': {
        // Mounting seat + part lifting/unclipping cleanly along glowing coral-orange chevron vectors
        const mx = cx - 48 * scale;
        const my = cy + 6 * scale;
        ctx.save();
        ctx.setLineDash([6 * scale, 4 * scale]);
        roundRect(ctx, mx, my, 96 * scale, 36 * scale, 8 * scale, 'rgba(30,41,59,0.5)', '#64748b', 2);
        ctx.restore();

        const lift = (0.5 + 0.5 * Math.sin(tSec * 2.8 - 1.0)) * 38 * scale;
        roundRect(ctx, mx + lift * 0.25, my - 6 * scale - lift, 96 * scale, 36 * scale, 8 * scale, 'rgba(249, 115, 22, 0.88)', '#fed7aa', 2);

        if (action.kind === 'pry_clip') {
          // Animated lever tilting under clip
          ctx.save();
          ctx.translate(mx + 8 * scale, my + 4 * scale);
          ctx.rotate(-0.35 - 0.28 * Math.sin(tSec * 2.8));
          roundRect(ctx, -62 * scale, -4 * scale, 72 * scale, 7 * scale, 3 * scale, '#e2e8f0', '#fb923c', 1.5);
          ctx.restore();
        }

        // Upward extraction chevrons
        const vx = x + w - 68 * scale;
        for (let k = 0; k < 3; k++) {
          const vy = cy + 28 * scale - k * 20 * scale - ((tSec * 36) % 18) * scale;
          ctx.beginPath();
          ctx.moveTo(vx - 14 * scale, vy + 9 * scale);
          ctx.lineTo(vx, vy);
          ctx.lineTo(vx + 14 * scale, vy + 9 * scale);
          ctx.strokeStyle = `rgba(251, 146, 60, ${0.95 - k * 0.25})`;
          ctx.lineWidth = 4 * scale;
          ctx.stroke();
        }
        drawSpecPill(ctx, x + w - 122 * scale, y + h - 38 * scale, action.specVal, '#fb923c', scale);
        break;
      }

      case 'clean_air':
      case 'lubricate': {
        // Sweeping nozzle / applicator across flange with vivid particle jet / shimmering grease film
        const surfY = cy + 32 * scale;
        roundRect(ctx, x + 32 * scale, surfY, w - 140 * scale, 20 * scale, 6 * scale, '#475569', '#94a3b8', 1.5);
        const sweep = x + 52 * scale + (w - 185 * scale) * (0.5 + 0.5 * Math.sin(tSec * 3.2));
        const col = action.kind === 'lubricate' ? '#a78bfa' : '#22d3ee';

        // Glowing spray cone
        ctx.beginPath();
        ctx.moveTo(sweep - 8 * scale, cy - 38 * scale);
        ctx.lineTo(sweep + 8 * scale, cy - 38 * scale);
        ctx.lineTo(sweep + 26 * scale, surfY);
        ctx.lineTo(sweep - 26 * scale, surfY);
        ctx.closePath();
        ctx.fillStyle = action.kind === 'lubricate' ? 'rgba(167, 139, 250, 0.28)' : 'rgba(34, 211, 238, 0.26)';
        ctx.fill();

        roundRect(ctx, sweep - 14 * scale, cy - 54 * scale, 28 * scale, 20 * scale, 5 * scale, '#e2e8f0', col, 2);
        for (let k = 0; k < 8; k++) {
          const ang = k * 0.8 + tSec * 8;
          const px = sweep + Math.cos(ang) * 26 * scale;
          const py = surfY - 4 * scale - Math.abs(Math.sin(ang)) * 22 * scale;
          ctx.beginPath();
          ctx.arc(px, py, 2.8 * scale, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();
        }
        drawSpecPill(ctx, x + w - 122 * scale, y + h - 38 * scale, action.specVal, col, scale);
        break;
      }

      default: {
        // measure_gap: Caliper / feeler gauge + laser scan line + digital readout
        const sx = cx - 22 * scale;
        const sy = cy - 30 * scale;
        roundRect(ctx, sx - 18 * scale, sy, 36 * scale, 38 * scale, 5 * scale, '#f1f5f9', '#64748b', 2);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(sx - 5 * scale, sy + 38 * scale, 10 * scale, 14 * scale);

        // L-shaped ground electrode / caliper jaw
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 5 * scale;
        ctx.beginPath();
        ctx.moveTo(sx - 20 * scale, sy + 36 * scale);
        ctx.lineTo(sx - 20 * scale, sy + 68 * scale);
        ctx.lineTo(sx + 10 * scale, sy + 68 * scale);
        ctx.stroke();

        // Sliding cyan feeler gauge + spark pulse
        const slide = Math.sin(tSec * 3.4) * 20 * scale;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4 * scale;
        ctx.beginPath();
        ctx.moveTo(sx - 6 * scale + slide, sy + 59 * scale);
        ctx.lineTo(sx + 78 * scale + slide, sy + 59 * scale);
        ctx.stroke();

        if (Math.floor(tSec * 6) % 2 === 0) {
          ctx.beginPath();
          ctx.arc(sx, sy + 59 * scale, 5.5 * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#7dd3fc';
          ctx.fill();
        }
        drawSpecPill(ctx, x + w - 122 * scale, y + h - 38 * scale, action.specVal, '#38bdf8', scale);
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
    ctx.fillStyle = '#64748b';
    ctx.fill();
  }

  function drawRatchetWrench(ctx, cx, cy, deg, len, scale, gripColor) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((deg * Math.PI) / 180);
    roundRect(ctx, 18 * scale, -7 * scale, len - 18 * scale, 14 * scale, 5 * scale, '#cbd5e1', '#475569', 1.5);
    roundRect(ctx, len - 40 * scale, -8 * scale, 36 * scale, 16 * scale, 5 * scale, gripColor);
    ctx.beginPath();
    ctx.arc(0, 0, 24 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
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

    // Timing mark dot at top
    ctx.beginPath();
    ctx.arc(0, -(r - 7), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.restore();
  }

  function drawSpecPill(ctx, x, y, text, accent, scale) {
    roundRect(ctx, x, y, 108 * scale, 26 * scale, 7 * scale, 'rgba(15, 23, 42, 0.92)', accent, 1.5);
    ctx.fillStyle = accent;
    ctx.font = `bold ${Math.max(10, Math.round(11 * scale))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(String(text || '').slice(0, 14), x + 54 * scale, y + 17 * scale);
    ctx.textAlign = 'left';
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth = 1.5) {
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
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /* =========================================================================
   * 4. Book-to-Short-Video Agent (Анализ всей книги → Короткие живые ролики)
   * ========================================================================= */
  const ACTION_START_RE = /^(?:ЗАМЕНА|СНЯТИЕ\s+И\s+УСТАНОВКА|СНЯТИЕ|РАЗБОРКА|РЕМОНТ|ПРОВЕРКА\s+И\s+РЕГУЛИРОВКА|ПРОВЕРКА|РЕГУЛИРОВКА|ПРОКАЧКА|ОЧИСТКА|ОБСЛУЖИВАНИЕ|СМАЗКА|ДИАГНОСТИКА)/i;

  function scanBookForProcedures(manualIndex, pagesText, bookTitle = '') {
    const results = [];
    const seenPages = new Set();

    // 1. Scan TOC subsections (449 items in Ford OR extracted TOC in uploaded PDFs)
    const sections = (manualIndex && manualIndex.sections) || [];
    for (const sec of sections) {
      const cat = categorizeSection(sec.title);
      for (const item of (sec.items || [])) {
        if (!ACTION_START_RE.test(item.title) && item.title.length < 14) continue;
        const p = item.pdfPage || item.bookPage || 1;
        const key = `${p}:${item.title.slice(0, 24)}`;
        if (seenPages.has(key)) continue;
        seenPages.add(key);

        const pObj = (pagesText && pagesText[p - 1]) || { text: '' };
        const pNext = (pagesText && pagesText[p]) || { text: '' };
        const combined = `${pObj.text || ''} ${pNext.text || ''}`;

        const steps = extractCleanStepsFromPageText(combined, item.title);
        if (steps.length < 2) continue;

        const actions = steps.slice(0, 6).map((s) => classifyMechanicalAction(s, '', combined));
        const hasTorque = /(\d+)\s*(?:Н\s*[·*]\s*м|Нм|Nm)/i.test(combined);

        results.push({
          id: `proc-p${p}-${results.length}`,
          title: item.title,
          sectionTitle: sec.title,
          category: cat,
          pdfPage: p,
          bookPage: item.bookPage || p,
          stepsText: steps.slice(0, 6),
          actionsPreview: dedupeBadges(actions),
          hasTorque,
          estDurationSec: Math.min(68, Math.max(28, steps.slice(0, 6).length * 9)),
          bookTitle,
          rawContext: combined.slice(0, 2600)
        });
      }
    }

    // 2. Fallback / supplement direct page scan if TOC was minimal (e.g. uploaded raw PDF)
    if (results.length < 8 && Array.isArray(pagesText)) {
      for (const pg of pagesText) {
        if (!pg || !pg.text || pg.text.length < 120) continue;
        const steps = extractCleanStepsFromPageText(pg.text, '');
        if (steps.length >= 3 && ! results.some((r) => Math.abs(r.pdfPage - pg.pdfPage) <= 1)) {
          const headingMatch = pg.text.match(/(?:ЗАМЕНА|СНЯТИЕ\s+И\s+УСТАНОВКА|РЕГУЛИРОВКА|ПРОВЕРКА|ПРОКАЧКА)\s+[А-ЯЁA-Z0-9 ,()-]{4,65}/);
          const title = headingMatch
            ? formatSentenceCase(headingMatch[0])
            : `Операция на стр. ${pg.bookPage || pg.pdfPage}`;
          const actions = steps.slice(0, 6).map((s) => classifyMechanicalAction(s, '', pg.text));
          results.push({
            id: `proc-scan-${pg.pdfPage}`,
            title,
            sectionTitle: `Страница ${pg.pdfPage}`,
            category: categorizeSection(title),
            pdfPage: pg.pdfPage,
            bookPage: pg.bookPage || pg.pdfPage,
            stepsText: steps.slice(0, 6),
            actionsPreview: dedupeBadges(actions),
            hasTorque: /(\d+)\s*(?:Н\s*[·*]\s*м|Нм|Nm)/i.test(pg.text),
            estDurationSec: Math.min(65, Math.max(28, steps.slice(0, 6).length * 9)),
            bookTitle,
            rawContext: pg.text.slice(0, 2600)
          });
        }
        if (results.length >= 90) break;
      }
    }

    // Sort best actionable operations first (having torque specs + rich varied steps)
    results.sort((a, b) => {
      const scoreA = (ACTION_START_RE.test(a.title) ? 10 : 0) + (a.hasTorque ? 5 : 0) + a.stepsText.length;
      const scoreB = (ACTION_START_RE.test(b.title) ? 10 : 0) + (b.hasTorque ? 5 : 0) + b.stepsText.length;
      return scoreB - scoreA || a.pdfPage - b.pdfPage;
    });

    return results.slice(0, 120);
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

    // Match numbered steps "1. ...", "2. ..."
    const numbered = [];
    const re = /(?:^|\s)(\d{1,2})\.\s+([А-ЯЁA-Z][^.!?]{10,190}[.!?])/g;
    let m;
    while ((m = re.exec(slice)) !== null && numbered.length < 8) {
      const stepStr = m[2].replace(/\s+/g, ' ').trim();
      if (!numbered.includes(stepStr)) {
        numbered.push(stepStr);
      }
    }
    if (numbered.length >= 2) return numbered;

    // Fallback: imperative repair sentences
    const sentences = slice
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 22 && s.length <= 185 && !/^\d+\s+Ford/i.test(s));
    return sentences.slice(0, 6);
  }

  function formatSentenceCase(str) {
    const s = String(str || '').trim();
    if (!s) return 'Операция ремонта';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  /* Builds a complete Short Animated Video object from ANY discovered procedure! */
  async function generateAnimatedShortFromProcedure(proc, pageImageLoader, onStageLog) {
    const log = (phaseIdx, msg) => {
      if (onStageLog) onStageLog(phaseIdx, msg);
    };

    log(1, `Фаза 1/5: Разбор техкарты «${proc.title}» (стр. ${proc.bookPage}) — выделено ${proc.stepsText.length} действий…`);
    await sleep(160);

    const ctxText = proc.rawContext || '';
    const toolMatch = ctxText.match(/(?:Вам потребуются|Инструмент)\s*[:–-]?\s*([^.!?\n]{5,140})/i);
    const warnMatch = ctxText.match(/(?:ПРЕДУПРЕЖДЕНИЕ|ВНИМАНИЕ)\s*[!:–-]?\s*([^.!?\n]{12,165}[.!?]?)/i);
    const nmList = [...ctxText.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*(?:Н\s*[·*]\s*м|Нм|Nm)/gi)].map((x) => `${x[1]} Н·м`);

    log(2, `Фаза 2/5: Извлечение иллюстраций со стр. ${proc.pdfPage} и ИИ-колоризация тусклых зон…`);
    const frameCrops = await pageImageLoader(proc.pdfPage);

    log(3, `Фаза 3/5: Построение цветной 60 FPS кинематики для каждого из ${proc.stepsText.length} шагов…`);
    await sleep(150);

    let cursor = 0;
    const animatedSteps = proc.stepsText.map((stepTxt, idx) => {
      const act = classifyMechanicalAction(stepTxt, toolMatch ? toolMatch[1] : '', ctxText);
      const conciseNarration = buildConciseShortLine(stepTxt, idx, proc.title, act);
      const dur = Math.max(5.5, Math.min(12.5, +(conciseNarration.length / 13.5).toFixed(1)));
      const stObj = {
        num: idx + 1,
        caption: stepTxt,
        spokenLine: conciseNarration,
        tool: toolMatch ? toolMatch[1].split(',')[0].trim() : act.badge,
        action: act,
        cropSource: frameCrops[idx % Math.max(1, frameCrops.length)] || null,
        startTime: cursor,
        endTime: +(cursor + dur).toFixed(2),
        duration: dur
      };
      cursor = stObj.endTime;
      return stObj;
    });

    log(4, `Фаза 4/5: Сборка сценария короткого ролика (${Math.round(cursor)} сек) с караоке-субтитрами…`);
    await sleep(130);

    const shortVideo = {
      id: proc.id,
      title: proc.title,
      sectionTitle: proc.sectionTitle,
      bookTitle: proc.bookTitle || 'Руководство по ремонту',
      bookPage: proc.bookPage,
      pdfPage: proc.pdfPage,
      totalDuration: cursor,
      keyTorque: nmList[0] || (animatedSteps[0] && animatedSteps[0].action.specVal) || 'По техкарте',
      warning: warnMatch ? warnMatch[1] : 'Работайте безопасно, очищайте крепеж перед разборкой.',
      toolsSummary: toolMatch ? toolMatch[1] : 'Слесарный набор ключей и головок',
      steps: animatedSteps
    };

    log(5, `Фаза 5/5: Готово! Цветной анимированный ролик (${Math.round(cursor)} сек) запущен с русской озвучкой.`);
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
      return `Шаг ${idx + 1}: ${clean} Соблюдайте момент ${act.specVal}.`;
    }
    return `Шаг ${idx + 1}: ${clean}`;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* =========================================================================
   * 5. Interactive Short-Form Animated Player (Supports 9:16 Shorts & 16:9 HD)
   * ========================================================================= */
  class ShortAnimatedVideoPlayer {
    constructor(canvasEl, callbacks = {}) {
      this.canvas = canvasEl;
      this.ctx = canvasEl ? canvasEl.getContext('2d') : null;
      this.videoData = null;
      this.aspect = '9:16'; // '9:16' | '16:9'
      this.colorizeEnabled = true;
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

    setColorize(enabled) {
      this.colorizeEnabled = !!enabled;
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

      // Deep dark studio gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#090e1a');
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
      // 1. Top Segmented Story Progress Bars (Instagram/YouTube Shorts style)
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

      // 2. Top Header Pill + Procedure Title
      roundRect(ctx, 28, 46, 236, 34, 8, st.action.accent);
      ctx.fillStyle = '#090e1a';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillText(`ШАГ ${sIdx + 1} ИЗ ${n} • СТР. ${v.bookPage}`, 42, 68);

      roundRect(ctx, W - 210, 46, 182, 34, 8, 'rgba(30, 41, 59, 0.9)', st.action.accent, 1.5);
      ctx.fillStyle = st.action.accent;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(v.keyTorque.slice(0, 14), W - 119, 68);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 26px Inter, system-ui, sans-serif';
      drawWrapped(ctx, v.title, 28, 114, W - 56, 32, 2);

      // 3. Upper Stage: Colorized & Animated Book Illustration (y: 168..668 -> 664 x 500)
      this.drawColorizedPhotoStage(ctx, { x: 28, y: 168, w: W - 56, h: 496 }, st, stepProg, tSec);

      // 4. Middle Stage: Dedicated 60 FPS Live Mechanical Action Scene (y: 682..956 -> 664 x 274)
      drawAnimatedMechanismBox(ctx, { x: 28, y: 682, w: W - 56, h: 274 }, st.action, tSec, stepProg);

      // 5. Bottom Stage: Live Karaoke Word-by-Word Highlighted Subtitles (y: 974..1236)
      this.drawKaraokeSubtitles(ctx, { x: 28, y: 974, w: W - 56, h: 262 }, st, stepProg, v.warning);
    }

    renderHorizontalHdFrame(ctx, W, H, v, st, sIdx, stepProg, tSec) {
      // Top Bar
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, W, 68);
      roundRect(ctx, 24, 16, 210, 36, 8, st.action.accent);
      ctx.fillStyle = '#090e1a';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillText(`ШАГ ${sIdx + 1} / ${v.steps.length} • СТР. ${v.bookPage}`, 38, 39);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px Inter, system-ui, sans-serif';
      ctx.fillText(v.title.slice(0, 52), 252, 41);

      // Left: Colorized Book Photo Stage with Animated Reticle
      this.drawColorizedPhotoStage(ctx, { x: 24, y: 86, w: 690, h: 460 }, st, stepProg, tSec);

      // Right: Live 60 FPS Animated Mechanism + Spec Card
      drawAnimatedMechanismBox(ctx, { x: 732, y: 86, w: 524, h: 460 }, st.action, tSec, stepProg);

      // Bottom: Karaoke Subtitles Strip
      this.drawKaraokeSubtitles(ctx, { x: 24, y: 562, w: W - 48, h: 138 }, st, stepProg, v.warning);
    }

    drawColorizedPhotoStage(ctx, rect, st, stepProg, tSec) {
      const { x, y, w, h } = rect;
      roundRect(ctx, x, y, w, h, 16, '#0f172a', st.action.accent, 2);

      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 13);
      else ctx.rect(x + 4, y + 4, w - 8, h - 8);
      ctx.clip();

      const colCanvas = st.cropSource
        ? colorizeBookCanvas(st.cropSource, `${st.num}_${st.caption.slice(0, 18)}`, this.colorizeEnabled)
        : null;

      if (colCanvas) {
        // Smooth camera pan + zoom into the active region
        const zoom = 1.03 + 0.09 * stepProg;
        const baseScale = Math.max(w / colCanvas.width, h / colCanvas.height);
        const dw = colCanvas.width * baseScale * zoom;
        const dh = colCanvas.height * baseScale * zoom;
        const panX = Math.sin(stepProg * Math.PI - 0.5) * 18;
        const dx = x + (w - dw) / 2 + panX;
        const dy = y + (h - dh) / 2;
        ctx.drawImage(colCanvas, dx, dy, dw, dh);

        // Soft radial vignette spotlight so focus pops in rich color
        const radGrad = ctx.createRadialGradient(x + w * 0.52, y + h * 0.48, w * 0.14, x + w * 0.5, y + h * 0.5, w * 0.68);
        radGrad.addColorStop(0, 'rgba(0,0,0,0)');
        radGrad.addColorStop(1, 'rgba(8, 13, 26, 0.58)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(x, y, w, h);
      } else {
        // Vibrant technical blueprint grid background if PDF page had no raster crop
        ctx.fillStyle = '#0c192c';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        for (let gx = x; gx < x + w; gx += 32) {
          ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
        }
        for (let gy = y; gy < y + h; gy += 32) {
          ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
        }
        drawAnimatedMechanismBox(ctx, { x: x + 20, y: y + 20, w: w - 40, h: h - 40, transparentBg: true }, st.action, tSec, stepProg);
      }

      // Animated AR Target Reticle over the photo stage
      const rx = x + w * (0.5 + 0.08 * Math.cos(tSec * 1.4));
      const ry = y + h * (0.48 + 0.06 * Math.sin(tSec * 1.4));
      const pulse = 0.5 + 0.5 * Math.sin(tSec * 5.2);
      ctx.beginPath();
      ctx.arc(rx, ry, 34 + 12 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = st.action.accent;
      ctx.globalAlpha = 0.45 * (1 - 0.4 * pulse);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;

      drawOrbitalArrow(ctx, rx, ry, 28, tSec * (st.action.kind === 'unscrew_ccw' ? -2.6 : 2.6), 1.7, st.action.kind !== 'unscrew_ccw', st.action.accent, 3.5);

      // Top-left Colorize Badge
      roundRect(ctx, x + 14, y + 14, 248, 28, 7, 'rgba(9, 14, 26, 0.82)', st.action.accent, 1);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.fillText(this.colorizeEnabled ? '🎨 ИИ-ЦВЕТ + ФОКУС УЗЛА: ВКЛ' : '📷 ОРИГИНАЛ СТРАНИЦЫ PDF', x + 24, y + 32);

      ctx.restore();
    }

    drawKaraokeSubtitles(ctx, rect, st, stepProg, warningText) {
      const { x, y, w, h } = rect;
      roundRect(ctx, x, y, w, h, 16, 'rgba(15, 23, 42, 0.94)', 'rgba(51, 65, 85, 0.9)', 1.5);

      const words = String(st.spokenLine || st.caption || '').split(/\s+/).filter(Boolean);
      const activeWordIdx = Math.min(words.length - 1, Math.floor(stepProg * words.length));

      const fontSize = h > 180 ? 23 : 19;
      const lineH = Math.round(fontSize * 1.38);
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;

      // Layout words across wrapped lines & highlight spoken words in bright amber/cyan!
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
        const safeName = (this.videoData ? this.videoData.title : 'short-video')
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
    classifyMechanicalAction,
    colorizeBookCanvas,
    drawAnimatedMechanismBox,
    scanBookForProcedures,
    generateAnimatedShortFromProcedure,
    ShortAnimatedVideoPlayer
  };
})();
