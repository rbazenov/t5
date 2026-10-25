#!/usr/bin/env python3
"""
Renders 4 vibrant, full-color, action-animated 1280x720 H.264 MP4 repair videos:
- Studio full-color 3D cutaway scene per stage + color-enhanced original manual photo inset
- Real 24fps procedural mechanical animations for EVERY single step (42 steps):
  * Oscillating wrenches & spinning hex fasteners with glowing CW/CCW orbital rings
  * Live Torque Wrench sweep + circular Nm gauge (0 -> target Nm + green CLICK confirmation)
  * Flowing golden oil streams, droplets & rising MIN->MAX sump/filter level gauges
  * Animated brake piston compression, spring clip prying & pad extraction vectors
  * Rotating DOHC cam/crank sprockets, moving toothed timing belt & emerald TDC alignment bar
  * Compressed-air particle jet, brush cleaning & 1.3 mm feeler gauge laser measurement
- Synchronized studio Russian voiceover audio tracks (voice-00)
"""
import json
import math
import os
import shutil
import subprocess
import tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

OUT_DIR = "docs/media/videos"
os.makedirs(OUT_DIR, exist_ok=True)


def font(path, size):
    return ImageFont.truetype(path, size)


F_BADGE = font(FONT_BOLD, 13)
F_HEADER = font(FONT_BOLD, 21)
F_SUB = font(FONT_REG, 13)
F_STEP_NUM = font(FONT_MONO, 15)
F_CH_TITLE = font(FONT_BOLD, 15)
F_CAPTION = font(FONT_BOLD, 19)
F_LABEL = font(FONT_BOLD, 11)
F_VAL = font(FONT_REG, 14)
F_VAL_BOLD = font(FONT_BOLD, 14)
F_WARN = font(FONT_BOLD, 13)
F_ANIM_TITLE = font(FONT_BOLD, 13)
F_ANIM_BIG = font(FONT_MONO, 20)
F_ANIM_SM = font(FONT_BOLD, 12)

STAGE_POSTER_MAP = {
    "oil-ch-1": "docs/media/posters/oil-hero.jpg",
    "oil-ch-2": "docs/media/posters/oil-filter-stage.jpg",
    "oil-ch-3": "docs/media/posters/oil-hero.jpg",
    "oil-ch-4": "docs/media/posters/oil-dipstick-stage.jpg",
    "brakes-ch-1": "docs/media/posters/brakes-clip-stage.jpg",
    "brakes-ch-2": "docs/media/posters/brakes-hero.jpg",
    "brakes-ch-3": "docs/media/posters/brakes-torque-stage.jpg",
    "belt-ch-1": "docs/media/posters/belt-crank-stage.jpg",
    "belt-ch-2": "docs/media/posters/belt-hero.jpg",
    "plugs-ch-1": "docs/media/posters/spark-hero.jpg",
}

HERO_POSTER_BY_SLUG = {
    "oil-change": "/media/posters/oil-hero.jpg",
    "brake-pads": "/media/posters/brakes-hero.jpg",
    "timing-belt": "/media/posters/belt-hero.jpg",
    "spark-plugs": "/media/posters/spark-hero.jpg",
}


def classify_action(caption: str, tool: str):
    txt = f"{caption} {tool}".lower()
    import re
    nm_m = re.search(r"(\d+(?:[.,]\d+)?)\s*н[·*]?м", txt)
    deg_m = re.search(r"\+\s*(\d+)\s*°", txt)
    mm_m = re.search(r"(\d+[.,]\d+|\d+)\s*мм", txt)

    if "слейте" in txt:
        return ("drain_fluid", "СЛИВ МАСЛА • 28 Н·м", "28 Н·м")
    if "заполните" in txt or "залейте" in txt:
        return ("fill_fluid", "ЗАЛИВКА СВЕЖЕГО МАСЛА 5W-30", "3,8–4,35 л")
    if "щуп" in txt and ("проверьте" in txt or "зазор" in txt or "1,3" in txt):
        val = f"{mm_m.group(1)} мм" if mm_m else "1,3 мм"
        return ("measure_gap", f"КОНТРОЛЬ ЗАЗОРА • {val}", val)
    if "щуп" in txt or "min" in txt or "утечек" in txt:
        return ("dipstick_check", "КОНТРОЛЬ УРОВНЯ MIN–MAX", "НОРМА ✓")
    if "продуйте" in txt or "сжатым воздухом" in txt:
        return ("air_blow", "ПРОДУВКА КОЛОДЦЕВ СЖАТЫМ ВОЗДУХОМ", "6 бар")
    if "щетк" in txt or "протрите" in txt or "очист" in txt:
        return ("clean_surface", "ОЧИСТКА ПОСАДОЧНОЙ ПОВЕРХНОСТИ", "ЧИСТО ✓")
    if "смажьте" in txt and "фиксатор" not in txt and "28" not in txt:
        return ("lubricate", "СМАЗКА УПЛОТНИТЕЛЬНОГО КОЛЬЦА + ЗАТЯЖКА", "+3/4 об.")
    if nm_m or "затяните" in txt or "заверните" in txt:
        val = f"{nm_m.group(1)} Н·м" if nm_m else "+3/4 об."
        if deg_m:
            val += f" + {deg_m.group(1)}°"
        return ("torque_cw", f"ДИНАМОМЕТРИЧЕСКАЯ ЗАТЯЖКА • {val}", val)
    if "вмт" in txt or "планк" in txt or "ремень грм" in txt or "уложите ремень" in txt or "разрежьте" in txt:
        return ("belt_timing", "СИНХРОНИЗАЦИЯ ФАЗ И ПРИВОД ГРМ", "ВМТ LOCK ✓")
    if "поверните" in txt and "ролик" in txt or "штифт" in txt:
        return ("tensioner_pin", "ВЗВОД РОЛИКА И СТОПОРНЫЙ ШТИФТ", "ШТИФТ ✓")
    if "утопите поршень" in txt:
        return ("press_piston", "УТАПЛИВАНИЕ ПОРШНЯ И СНЯТИЕ СКОБЫ", "ПЛАВНО ▼")
    if "отверните" in txt or "выверните" in txt or "ослабьте" in txt or "строньте" in txt or "съемник" in txt:
        return ("unscrew_ccw", "ОТВОРАЧИВАНИЕ КРЕПЕЖА ↺", "↺ ПРОТИВ ЧАС.")
    if "подденьте" in txt or "снимите" in txt or "извлеките" in txt:
        return ("remove_part", "ДЕМОНТАЖ И ИЗВЛЕЧЕНИЕ УЗЛА", "СНЯТИЕ ▲")
    return ("inspect_node", "ТЕХНИЧЕСКИЙ ОСМОТР И СХЕМА УЗЛА", "КОНТРОЛЬ ✓")


def enhance_and_colorize_book_photo(img_path: str) -> Image.Image:
    """De-blocks compressed book JPEG, removes corner watermark, boosts color & contrast."""
    im = Image.open(img_path).convert("RGB")
    w, h = im.size
    arr = np.array(im, dtype=np.float32)

    # Clean bottom-right yellow watermark stamp if present
    wm_y0, wm_x0 = int(h * 0.81), int(w * 0.86)
    patch_src = arr[max(0, wm_y0 - (h - wm_y0)):wm_y0, wm_x0:w]
    if patch_src.shape[0] > 4 and patch_src.shape[1] > 4:
        resized_patch = np.array(
            Image.fromarray(patch_src.astype(np.uint8)).resize((w - wm_x0, h - wm_y0), Image.Resampling.BILINEAR),
            dtype=np.float32,
        )
        arr[wm_y0:h, wm_x0:w] = resized_patch

    # Check saturation; if washed out / near-grayscale, apply rich dual-tone workshop colorization
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    sat = (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)).mean()
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # Normalize contrast (percentile stretch)
    p_lo, p_hi = np.percentile(lum, 3), np.percentile(lum, 97)
    span = max(20.0, p_hi - p_lo)
    lum_norm = np.clip((lum - p_lo) / span, 0.0, 1.0)

    if sat < 26.0:
        # Colorize dull greyscale metal: cool steel-blue shadows + warm brass/amber highlights
        cy = np.linspace(-1, 1, h)[:, None]
        cx = np.linspace(-1, 1, w)[None, :]
        focus = np.exp(-(cx * cx + cy * cy) * 1.6)
        new_r = lum_norm * (215 + 38 * focus) + (1 - lum_norm) * 18
        new_g = lum_norm * (222 + 16 * focus) + (1 - lum_norm) * 28
        new_b = lum_norm * (235 - 32 * focus) + (1 - lum_norm) * 48
        arr = (0.42 * arr + 0.58 * np.stack([new_r, new_g, new_b], axis=-1))
    else:
        # Boost natural color vibrancy
        mean_c = lum[:, :, None]
        arr = mean_c + (arr - mean_c) * 1.48
        arr = (arr - p_lo) * (255.0 / span)

    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    # Smooth JPEG macroblocks then restore crisp edges
    out = out.filter(ImageFilter.GaussianBlur(radius=0.75))
    out = out.filter(ImageFilter.UnsharpMask(radius=1.6, percent=145, threshold=3))
    out = ImageEnhance.Color(out).enhance(1.25)
    return out


def wrap_text(draw, text, fnt, max_width):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        bbox = draw.textbbox((0, 0), test, font=fnt)
        if bbox[2] - bbox[0] <= max_width or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_hud_background(guide, chapter, step, total_steps, global_step_idx, action_label):
    W, H = 1280, 720
    img = Image.new("RGB", (W, H), (10, 14, 24))
    draw = ImageDraw.Draw(img)

    # Top bar
    draw.rectangle([0, 0, W, 74], fill=(16, 23, 38))
    draw.line([(0, 74), (W, 74)], fill=(38, 52, 78), width=2)

    draw.rounded_rectangle([28, 18, 252, 54], radius=8, fill=(245, 158, 11))
    draw.text((40, 27), "FORD FIESTA / FUSION", font=F_BADGE, fill=(11, 15, 25))

    draw.text((268, 15), guide["shortTitle"], font=F_HEADER, fill=(248, 250, 252))
    meta_str = f"Стр. {guide['bookPages']}  •  {guide['workplace']}  •  Норматив: {guide['workTime']}  •  ЖИВАЯ АНИМАЦИЯ"
    draw.text((268, 44), meta_str, font=F_SUB, fill=(148, 163, 184))

    diff_x = 1040
    draw.rounded_rectangle([diff_x, 18, 1252, 54], radius=8, fill=(22, 34, 55), outline=(56, 189, 248), width=1)
    draw.text((diff_x + 14, 27), f"СЛОЖНОСТЬ: {guide['difficulty']}/5", font=F_BADGE, fill=(56, 189, 248))

    # Left telemetry column
    draw.rounded_rectangle([28, 94, 468, 656], radius=14, fill=(16, 23, 38), outline=(38, 52, 78), width=2)

    ch_pill_text = f"ЭТАП {chapter['index']} ИЗ {len(guide['chapters'])}"
    draw.rounded_rectangle([48, 114, 184, 144], radius=6, fill=(30, 58, 138))
    draw.text((60, 121), ch_pill_text, font=F_BADGE, fill=(191, 219, 254))

    step_str = f"ШАГ {global_step_idx:02d} / {total_steps:02d}"
    draw.text((338, 120), step_str, font=F_STEP_NUM, fill=(245, 158, 11))

    ch_lines = wrap_text(draw, chapter["title"], F_CH_TITLE, 396)
    y = 156
    for ln in ch_lines[:2]:
        draw.text((48, y), ln, font=F_CH_TITLE, fill=(148, 163, 184))
        y += 21

    draw.line([(48, y + 6), (448, y + 6)], fill=(38, 52, 78), width=1)
    y += 18

    cap_lines = wrap_text(draw, step["caption"], F_CAPTION, 396)
    for ln in cap_lines[:5]:
        draw.text((48, y), ln, font=F_CAPTION, fill=(248, 250, 252))
        y += 25

    y = max(y + 10, 348)
    draw.rounded_rectangle([48, y, 448, y + 72], radius=10, fill=(13, 28, 48), outline=(56, 189, 248), width=1)
    draw.text((62, y + 8), f"ОЖИВЛЁННОЕ ДЕЙСТВИЕ • {action_label[:28]}", font=F_LABEL, fill=(56, 189, 248))
    tool_lines = wrap_text(draw, f"Инструмент: {step['tool']}", F_VAL_BOLD, 372)
    for ti, tln in enumerate(tool_lines[:2]):
        draw.text((62, y + 27 + ti * 19), tln, font=F_VAL_BOLD, fill=(226, 232, 240))
    y += 82

    draw.rounded_rectangle([48, y, 448, y + 72], radius=10, fill=(26, 22, 14), outline=(245, 158, 11), width=1)
    draw.text((62, y + 9), "ТЕХНИЧЕСКИЙ КОНТРОЛЬ / МОМЕНТ", font=F_LABEL, fill=(245, 158, 11))
    km_lines = wrap_text(draw, chapter["keyMetric"], F_VAL, 372)
    ky = y + 29
    for ln in km_lines[:2]:
        draw.text((62, ky), ln, font=F_VAL, fill=(241, 245, 249))
        ky += 18
    y += 84

    if y + 90 <= 646:
        draw.rounded_rectangle([48, y, 448, 640], radius=10, fill=(55, 16, 24), outline=(220, 38, 38), width=1)
        draw.text((62, y + 9), "ВАЖНОЕ ПРЕДУПРЕЖДЕНИЕ", font=F_LABEL, fill=(252, 165, 165))
        w_lines = wrap_text(draw, chapter["warning"], F_WARN, 372)
        wy = y + 28
        for ln in w_lines[:3]:
            draw.text((62, wy), ln, font=F_WARN, fill=(254, 226, 226))
            wy += 18

    # Right stage frame
    draw.rounded_rectangle([490, 94, 1252, 656], radius=14, fill=(16, 23, 38), outline=(38, 52, 78), width=2)

    # Bottom progress bar track
    draw.rounded_rectangle([28, 676, 1252, 692], radius=8, fill=(30, 41, 59))
    prog_ratio = global_step_idx / max(1, total_steps)
    prog_w = max(24, int(1224 * prog_ratio))
    draw.rounded_rectangle([28, 676, 28 + prog_w, 692], radius=8, fill=(245, 158, 11))

    return img


def draw_hex_bolt(draw, cx, cy, radius, angle_rad, body_col=(203, 213, 225), outline_col=(71, 85, 105)):
    pts = []
    for i in range(6):
        a = angle_rad + i * (math.pi / 3.0)
        pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    draw.polygon(pts, fill=body_col, outline=outline_col)
    draw.ellipse([cx - radius * 0.48, cy - radius * 0.48, cx + radius * 0.48, cy + radius * 0.48],
                 fill=(148, 163, 184), outline=(51, 65, 85), width=2)


def draw_wrench(draw, cx, cy, angle_deg, length=128, color=(226, 232, 240), accent=(56, 189, 248)):
    rad = math.radians(angle_deg)
    ux, uy = math.cos(rad), math.sin(rad)
    px, py = -uy, ux
    # Handle polygon from r=24 to r=length
    w1, w2 = 9, 13
    p1 = (cx + ux * 24 + px * w1, cy + uy * 24 + py * w1)
    p2 = (cx + ux * length + px * w2, cy + uy * length + py * w2)
    p3 = (cx + ux * length - px * w2, cy + uy * length - py * w2)
    p4 = (cx + ux * 24 - px * w1, cy + uy * 24 - py * w1)
    draw.polygon([p1, p2, p3, p4], fill=color, outline=(71, 85, 105))
    # Grip accent near end
    g1 = (cx + ux * (length - 42) + px * (w2 - 2), cy + uy * (length - 42) + py * (w2 - 2))
    g2 = (cx + ux * (length - 8) + px * (w2 - 2), cy + uy * (length - 8) + py * (w2 - 2))
    g3 = (cx + ux * (length - 8) - px * (w2 - 2), cy + uy * (length - 8) - py * (w2 - 2))
    g4 = (cx + ux * (length - 42) - px * (w2 - 2), cy + uy * (length - 42) - py * (w2 - 2))
    draw.polygon([g1, g2, g3, g4], fill=accent)
    # Ratchet head ring
    draw.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], fill=(203, 213, 225), outline=(51, 65, 85), width=3)


def draw_curved_arrow(draw, cx, cy, radius, start_deg, span_deg, clockwise, color, width=5):
    end_deg = start_deg + span_deg
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.arc(bbox, start=start_deg, end=end_deg, fill=color, width=width)
    tip_deg = end_deg if clockwise else start_deg
    tang_deg = (tip_deg + 90) if clockwise else (tip_deg - 90)
    tr = math.radians(tip_deg)
    tx, ty = cx + radius * math.cos(tr), cy + radius * math.sin(tr)
    ar = math.radians(tang_deg)
    s = 11
    p1 = (tx + s * math.cos(ar), ty + s * math.sin(ar))
    p2 = (tx + s * math.cos(ar + 2.4), ty + s * math.sin(ar + 2.4))
    p3 = (tx + s * math.cos(ar - 2.4), ty + s * math.sin(ar - 2.4))
    draw.polygon([p1, p2, p3], fill=color)


def draw_animated_action_overlay(stage_rgba: Image.Image, action_kind: str, action_label: str, action_val: str, t_sec: float, prog: float):
    """Draws a crisp 24fps animated mechanical widget + center hotspot pulse onto the 730x530 stage."""
    overlay = Image.new("RGBA", stage_rgba.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    W, H = stage_rgba.size  # 730 x 530

    # 1. Animated AR Reticle on Main Scene (upper-right area x~490, y~195)
    rx, ry = 505, 185
    pulse = 0.5 + 0.5 * math.sin(t_sec * 5.0)
    r_outer = int(42 + 10 * pulse)
    accent_rgba = (56, 189, 248, 185) if "unscrew" in action_kind or "measure" in action_kind or "air" in action_kind else (245, 158, 11, 195)
    if action_kind in ("press_piston", "belt_timing", "dipstick_check"):
        accent_rgba = (16, 185, 129, 195)
    d.ellipse([rx - r_outer, ry - r_outer, rx + r_outer, ry + r_outer], outline=(*accent_rgba[:3], int(110 * (1 - 0.4 * pulse))), width=3)
    spin_deg = int((t_sec * 120) % 360)
    d.arc([rx - 32, ry - 32, rx + 32, ry + 32], start=spin_deg, end=spin_deg + 110, fill=accent_rgba, width=4)
    d.arc([rx - 32, ry - 32, rx + 32, ry + 32], start=spin_deg + 180, end=spin_deg + 290, fill=accent_rgba, width=4)

    # 2. Dedicated Live Animated Mechanism Card at Bottom-Right (x: 336..716, y: 296..516 -> 380 x 220)
    bx0, by0, bx1, by1 = 330, 292, 716, 516
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=14, fill=(11, 17, 30, 232), outline=(*accent_rgba[:3], 220), width=2)
    d.rounded_rectangle([bx0 + 12, by0 + 10, bx1 - 12, by0 + 34], radius=6, fill=(22, 33, 54, 235))
    d.text((bx0 + 20, by0 + 14), f"⚡ {action_label[:34]}", font=F_ANIM_TITLE, fill=accent_rgba[:3] + (255,))

    cx, cy = (bx0 + bx1) // 2 - 28, by0 + 132

    if action_kind == "unscrew_ccw":
        # Oscillating wrench turning bolt CCW + glowing cyan CCW arcs
        cycle = (t_sec * 1.35) % 1.0
        w_angle = -20 - 52 * math.sin(cycle * math.pi) if cycle < 0.7 else -20
        bolt_rot = -t_sec * 2.4
        draw_curved_arrow(d, cx, cy, 58, int((-t_sec * 130) % 360), 115, False, (56, 189, 248, 245), 5)
        draw_curved_arrow(d, cx, cy, 58, int((-t_sec * 130 + 180) % 360), 115, False, (56, 189, 248, 170), 4)
        draw_wrench(d, cx, cy, w_angle, length=118, accent=(56, 189, 248, 255))
        draw_hex_bolt(d, cx, cy, 20, bolt_rot)
        d.text((bx1 - 126, by1 - 36), action_val, font=F_ANIM_SM, fill=(125, 211, 252, 255))

    elif action_kind == "torque_cw":
        # Sweeping torque wrench CW + rising torque dial + green click flash at peak
        sweep = min(1.0, (t_sec * 0.65) % 1.15)
        reached = sweep >= 0.92
        w_angle = -135 + 95 * min(1.0, sweep)
        col = (16, 185, 129, 255) if reached else (245, 158, 11, 255)
        # Dial gauge on right side of card
        gx, gy = bx1 - 74, by0 + 126
        d.arc([gx - 42, gy - 42, gx + 42, gy + 42], start=135, end=405, fill=(51, 65, 85, 220), width=9)
        d.arc([gx - 42, gy - 42, gx + 42, gy + 42], start=135, end=135 + int(270 * min(1.0, sweep)), fill=col, width=9)
        d.text((gx - 34, gy - 8), action_val[:8], font=F_ANIM_SM, fill=(248, 250, 252, 255))
        if reached:
            d.ellipse([cx - 64, cy - 64, cx + 64, cy + 64], outline=(16, 185, 129, 210), width=4)
            d.text((gx - 38, gy + 46), "ЩЕЛЧОК ✓", font=F_ANIM_SM, fill=(52, 211, 153, 255))
        draw_curved_arrow(d, cx - 22, cy, 52, int((t_sec * 120) % 360), 110, True, col, 5)
        draw_wrench(d, cx - 22, cy, w_angle, length=106, accent=col)
        draw_hex_bolt(d, cx - 22, cy, 19, t_sec * 1.8, body_col=(251, 191, 36))

    elif action_kind == "drain_fluid":
        # Oil sump cutaway + unscrewed plug + golden pouring stream & pan ripples
        sx, sy = bx0 + 70, by0 + 52
        d.rounded_rectangle([sx, sy, sx + 150, sy + 44], radius=8, fill=(51, 65, 85, 240), outline=(148, 163, 184, 255), width=2)
        # Drain pan below
        px0, py0 = sx + 15, by1 - 54
        d.polygon([(px0, py0), (px0 + 150, py0), (px0 + 132, py0 + 38), (px0 + 18, py0 + 38)],
                  fill=(30, 41, 59, 255), outline=(148, 163, 184, 255))
        fill_h = int(10 + 18 * prog)
        d.rectangle([px0 + 22, py0 + 35 - fill_h, px0 + 128, py0 + 35], fill=(217, 119, 6, 235))
        # Animated stream & droplets
        stream_x = sx + 75
        wobble = 2.5 * math.sin(t_sec * 14)
        d.polygon([(stream_x - 6, sy + 44), (stream_x + 6, sy + 44),
                   (stream_x + 4 + wobble, py0 + 26), (stream_x - 4 + wobble, py0 + 26)],
                  fill=(245, 158, 11, 235))
        for k in range(5):
            dy = ((t_sec * 120 + k * 22) % 72)
            d.ellipse([stream_x - 4 + (k % 2) * 5, sy + 48 + dy, stream_x + 3 + (k % 2) * 5, sy + 56 + dy],
                      fill=(251, 191, 36, 255))
        d.text((bx1 - 128, by0 + 115), "ГОРЯЧЕЕ\nМАСЛО ▼", font=F_ANIM_SM, fill=(251, 191, 36, 255))

    elif action_kind == "fill_fluid":
        # Tilted golden oil canister pouring into funnel + rising MIN->MAX level gauge
        kx, ky = bx0 + 46, by0 + 56
        tilt = 8 * math.sin(t_sec * 2.2)
        d.rounded_rectangle([kx, ky, kx + 86, ky + 54], radius=10, fill=(245, 158, 11, 240), outline=(254, 243, 199, 255), width=2)
        d.text((kx + 14, ky + 18), "5W-30", font=F_ANIM_SM, fill=(15, 23, 42, 255))
        # Pouring golden arc
        for k in range(8):
            f = k / 7.0
            px = kx + 88 + f * 48
            py = ky + 28 + (f * f) * 95 + 2 * math.sin(t_sec * 12 + k)
            d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(251, 191, 36, 245))
        # Level tank MIN -> MAX on right
        tx0, ty0, tx1, ty1 = bx1 - 122, by0 + 54, bx1 - 36, by1 - 22
        d.rounded_rectangle([tx0, ty0, tx1, ty1], radius=8, fill=(15, 23, 42, 255), outline=(148, 163, 184, 255), width=2)
        lvl = 0.25 + 0.62 * (0.5 + 0.5 * math.sin(t_sec * 1.6 - 1.2))
        fy = int(ty1 - 6 - (ty1 - ty0 - 16) * lvl)
        d.rounded_rectangle([tx0 + 5, fy, tx1 - 5, ty1 - 5], radius=5, fill=(245, 158, 11, 235))
        d.line([(tx0 - 6, ty0 + 28), (tx1 + 6, ty0 + 28)], fill=(16, 185, 129, 255), width=2)
        d.text((tx0 - 44, ty0 + 21), "MAX", font=F_LABEL, fill=(52, 211, 153, 255))
        d.line([(tx0 - 6, ty1 - 28), (tx1 + 6, ty1 - 28)], fill=(248, 113, 113, 255), width=2)
        d.text((tx0 - 42, ty1 - 35), "MIN", font=F_LABEL, fill=(248, 113, 113, 255))

    elif action_kind in ("belt_timing", "tensioner_pin"):
        # Twin DOHC cam sprockets + crank pulley + moving toothed belt + green TDC alignment bar
        c1x, c1y = bx0 + 115, by0 + 92
        c2x, c2y = bx0 + 225, by0 + 92
        ckx, cky = bx0 + 170, by0 + 178
        ang = t_sec * 1.4 if "2 оборота" in action_label.lower() else 0.12 * math.sin(t_sec * 3.0)
        # Belt loop
        d.polygon([(c1x - 28, c1y), (c2x + 28, c2y), (ckx + 22, cky + 18), (ckx - 22, cky + 18)],
                  outline=(245, 158, 11, 240), width=5)
        for sx, sy, r in [(c1x, c1y, 28), (c2x, c2y, 28), (ckx, cky, 22)]:
            d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(51, 65, 85, 255), outline=(203, 213, 225, 255), width=3)
            mx, my = sx + (r - 6) * math.cos(ang - math.pi / 2), sy + (r - 6) * math.sin(ang - math.pi / 2)
            d.ellipse([mx - 4, my - 4, mx + 4, my + 4], fill=(16, 185, 129, 255))
        # Green TDC locking bar across camshafts
        glow = int(170 + 85 * (0.5 + 0.5 * math.sin(t_sec * 6)))
        d.line([(c1x - 36, c1y), (c2x + 36, c2y)], fill=(16, 185, 129, glow), width=5)
        d.text((bx1 - 110, by1 - 36), "ВМТ LOCK ✓", font=F_ANIM_SM, fill=(52, 211, 153, 255))

    elif action_kind == "press_piston":
        # Caliper cylinder housing + piston sliding inward under emerald force arrows
        hx0, hy0 = bx0 + 80, by0 + 78
        d.rounded_rectangle([hx0, hy0, hx0 + 120, hy0 + 104], radius=8, fill=(51, 65, 85, 255), outline=(148, 163, 184, 255), width=3)
        shift = int(42 * (0.5 + 0.5 * math.sin(t_sec * 2.5 - 1.2)))
        px0 = hx0 + 95 - shift
        d.rounded_rectangle([px0, hy0 + 16, px0 + 62, hy0 + 88], radius=6, fill=(203, 213, 225, 255), outline=(16, 185, 129, 255), width=2)
        # Force arrows pushing left into housing
        ax = px0 + 98
        d.line([(ax + 38, hy0 + 52), (ax, hy0 + 52)], fill=(16, 185, 129, 255), width=6)
        d.polygon([(ax - 8, hy0 + 52), (ax + 10, hy0 + 40), (ax + 10, hy0 + 64)], fill=(16, 185, 129, 255))
        d.text((bx0 + 34, by1 - 32), "ПЛАВНЫЙ ВЖИМ ПОРШНЯ В СУППОРТ", font=F_ANIM_SM, fill=(52, 211, 153, 255))

    elif action_kind in ("measure_gap", "dipstick_check"):
        # Spark plug electrode gap + sliding feeler blade OR dipstick MIN-MAX scan
        sx, sy = bx0 + 135, by0 + 82
        d.rectangle([sx - 18, sy - 26, sx + 18, sy + 24], fill=(241, 245, 249, 255), outline=(100, 116, 139, 255), width=2)
        d.rectangle([sx - 5, sy + 24, sx + 5, sy + 40], fill=(203, 213, 225, 255))
        # Ground electrode L-hook
        d.line([(sx - 22, sy + 22), (sx - 22, sy + 58), (sx + 8, sy + 58)], fill=(148, 163, 184, 255), width=6)
        # Sliding cyan feeler gauge wire in gap
        slide = int(26 * math.sin(t_sec * 3.2))
        d.line([(sx - 6 + slide, sy + 48), (sx + 95 + slide, sy + 48)], fill=(56, 189, 248, 255), width=5)
        # Electric spark pulse
        if int(t_sec * 6) % 2 == 0:
            d.ellipse([sx - 6, sy + 42, sx + 6, sy + 54], fill=(125, 211, 252, 240))
        d.text((bx1 - 135, by0 + 98), action_val, font=F_ANIM_BIG, fill=(56, 189, 248, 255))
        d.text((bx1 - 135, by0 + 130), "ЩУП КОНТРОЛЯ", font=F_LABEL, fill=(191, 219, 254, 255))

    elif action_kind in ("air_blow", "clean_surface", "lubricate"):
        # Oscillating nozzle / applicator + vivid cyan/amber particle wave across part surface
        sy = by0 + 158
        d.rounded_rectangle([bx0 + 48, sy, bx1 - 48, sy + 24], radius=6, fill=(71, 85, 105, 255), outline=(148, 163, 184, 255))
        sweep_x = int(bx0 + 90 + 185 * (0.5 + 0.5 * math.sin(t_sec * 3.4)))
        p_col = (251, 191, 36, 235) if action_kind == "lubricate" else (56, 189, 248, 235)
        d.polygon([(sweep_x - 10, by0 + 62), (sweep_x + 10, by0 + 62), (sweep_x + 28, sy - 4), (sweep_x - 28, sy - 4)],
                  fill=(*p_col[:3], 75))
        d.rounded_rectangle([sweep_x - 16, by0 + 48, sweep_x + 16, by0 + 74], radius=5, fill=(226, 232, 240, 255))
        for k in range(9):
            ang = k * 0.7 + t_sec * 7
            px = sweep_x + int(34 * math.cos(ang))
            py = sy - 8 - int(22 * abs(math.sin(ang)))
            d.ellipse([px - 3, py - 3, px + 3, py + 3], fill=p_col)

    else:
        # remove_part / inspect_node: Component lifting smoothly out of mounting seat with glowing chevron vectors
        mx, my = bx0 + 115, by0 + 128
        d.rounded_rectangle([mx - 52, my + 8, mx + 52, my + 48], radius=8, outline=(100, 116, 139, 200), width=2)
        lift = int(34 * (0.5 + 0.5 * math.sin(t_sec * 2.8 - 1.0)))
        d.rounded_rectangle([mx - 48, my - 10 - lift, mx + 48, my + 28 - lift],
                            radius=8, fill=(59, 130, 246, 225), outline=(191, 219, 254, 255), width=2)
        # Animated upward/outward neon-orange chevrons
        ax = bx1 - 95
        for k in range(3):
            ay = by1 - 44 - k * 28 - int((t_sec * 42) % 24)
            d.line([(ax - 16, ay + 10), (ax, ay), (ax + 16, ay + 10)], fill=(251, 146, 60, 245 - k * 55), width=5)

    return Image.alpha_composite(stage_rgba, overlay)


def compose_step_stage_frame(hero_im: Image.Image, book_photo_im: Image.Image, step_num: int,
                             action_kind: str, action_label: str, action_val: str,
                             t_sec: float, prog: float) -> Image.Image:
    """Builds one 730x530 full-color animated frame combining hero scene + colorized book photo + 24fps mechanism."""
    W, H = 730, 530
    # Smooth Ken Burns zoom + pan on crisp 3D colorful studio illustration
    zoom = 1.02 + 0.065 * prog
    pan_x = 0.5 + 0.35 * math.sin(prog * math.pi - 0.5)
    cw, ch = int(hero_im.width / zoom), int(hero_im.height / zoom)
    x0 = max(0, min(hero_im.width - cw, int((hero_im.width - cw) * pan_x)))
    y0 = max(0, (hero_im.height - ch) // 2)
    cropped = hero_im.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.Resampling.BILINEAR)
    stage_rgba = cropped.convert("RGBA")

    # Subtle dark vignette at bottom-left & bottom-right so insets pop with crisp contrast
    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    gd.rounded_rectangle([12, 12, 296, 232], radius=12, fill=(10, 15, 28, 228), outline=(56, 189, 248, 210), width=2)
    stage_rgba = Image.alpha_composite(stage_rgba, grad)

    # Paste enhanced colorful original manual photo inside the top-left PIP frame (268 x 182)
    pip = book_photo_im.copy()
    pip.thumbnail((266, 178), Image.Resampling.LANCZOS)
    px = 12 + (284 - pip.width) // 2
    py = 42 + (182 - pip.height) // 2
    stage_rgba.paste(pip.convert("RGBA"), (px, py))

    lbl_draw = ImageDraw.Draw(stage_rgba)
    lbl_draw.text((22, 19), f"● КАДР КНИГИ (ЦВЕТ) • ОПЕРАЦИЯ #{step_num}", font=F_LABEL, fill=(125, 211, 252, 255))

    # Add 24fps live mechanical action overlay
    stage_rgba = draw_animated_action_overlay(stage_rgba, action_kind, action_label, action_val, t_sec, prog)
    return stage_rgba.convert("RGB")


def render_guide_video(guide, sample_frame_out=None):
    slug = guide["slug"]
    out_mp4 = os.path.join(OUT_DIR, f"{slug}.mp4")
    all_steps = [s for ch in guide["chapters"] for s in ch["steps"]]
    total_steps = len(all_steps)

    tmpdir = tempfile.mkdtemp(prefix=f"vid_{slug}_")
    try:
        chapter_mp4s = []
        global_idx = 0
        fps = 24

        for ch_i, ch in enumerate(guide["chapters"]):
            steps = ch["steps"]
            ch_dur = ch["duration"]
            n_steps = len(steps)
            step_dur = ch_dur / n_steps

            hero_path = STAGE_POSTER_MAP.get(ch["id"], "docs/media/posters/oil-hero.jpg")
            if slug == "spark-plugs" and ch_i == 0:
                hero_a = Image.open("docs/media/posters/spark-hero.jpg").convert("RGB").resize((920, 668), Image.Resampling.LANCZOS)
                hero_b = Image.open("docs/media/posters/spark-gap-stage.jpg").convert("RGB").resize((920, 668), Image.Resampling.LANCZOS)
            else:
                hero_a = Image.open(hero_path).convert("RGB").resize((920, 668), Image.Resampling.LANCZOS)
                hero_b = hero_a

            ch_vis = os.path.join(tmpdir, f"ch_{ch_i}_vis.mp4")
            proc = subprocess.Popen(
                [
                    FFMPEG, "-y",
                    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1280x720", "-r", str(fps),
                    "-i", "-",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
                    "-an", ch_vis,
                ],
                stdin=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            for s_i, st in enumerate(steps):
                global_idx += 1
                if s_i < n_steps - 1:
                    frames = max(24, round(step_dur * fps))
                else:
                    used_frames = sum(max(24, round(step_dur * fps)) for _ in range(n_steps - 1))
                    frames = max(24, round(ch_dur * fps) - used_frames)

                action_kind, action_label, action_val = classify_action(st["caption"], st["tool"])
                st["actionKind"] = action_kind
                st["actionLabel"] = action_label
                st["actionVal"] = action_val

                # Enhance & colorize the step photo on disk once too
                disk_photo_path = "docs" + st["image"]
                enhanced_book_im = enhance_and_colorize_book_photo(disk_photo_path)
                enhanced_book_im.save(disk_photo_path, quality=92)

                hud_bg = draw_hud_background(guide, ch, st, total_steps, global_idx, action_label)
                active_hero = hero_b if (slug == "spark-plugs" and s_i >= 3) else hero_a

                for f_idx in range(frames):
                    t_sec = f_idx / fps
                    prog = f_idx / max(1, frames - 1)
                    stage_rgb = compose_step_stage_frame(
                        active_hero, enhanced_book_im, st["num"],
                        action_kind, action_label, action_val, t_sec, prog
                    )
                    frame_full = hud_bg.copy()
                    frame_full.paste(stage_rgb, (506, 110))
                    if sample_frame_out and ch_i == 0 and s_i == 3 and f_idx == 14:
                        frame_full.save(sample_frame_out)
                    proc.stdin.write(frame_full.tobytes())

            proc.stdin.close()
            err_out = proc.stderr.read()
            proc.wait()
            if proc.returncode != 0:
                raise RuntimeError(f"FFmpeg encode failed: {err_out.decode('utf-8', 'ignore')[-500:]}")

            audio_file = "docs" + ch["audioUrl"]
            ch_mux = os.path.join(tmpdir, f"ch_{ch_i}_mux.mp4")
            subprocess.run([
                FFMPEG, "-y",
                "-i", ch_vis,
                "-i", audio_file,
                "-c:v", "copy",
                "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "1",
                "-shortest",
                ch_mux,
            ], check=True, capture_output=True)
            chapter_mp4s.append(ch_mux)

        final_list = os.path.join(tmpdir, "final_list.txt")
        with open(final_list, "w") as ff:
            for cm in chapter_mp4s:
                ff.write(f"file '{cm}'\n")

        subprocess.run([
            FFMPEG, "-y",
            "-f", "concat", "-safe", "0", "-i", final_list,
            "-c", "copy",
            "-movflags", "+faststart",
            out_mp4,
        ], check=True, capture_output=True)

        size_mb = os.path.getsize(out_mp4) / (1024 * 1024)
        print(f"Rendered animated color video: {out_mp4} ({size_mb:.2f} MB)")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    with open("data/guides.json", "r", encoding="utf-8") as f:
        guides = json.load(f)
    for idx, g in enumerate(guides):
        if g["slug"] in HERO_POSTER_BY_SLUG:
            g["posterUrl"] = HERO_POSTER_BY_SLUG[g["slug"]]
        sample = "/tmp/sample_animated_frame.png" if idx == 0 else None
        render_guide_video(g, sample_frame_out=sample)

    # Persist updated posterUrls + step action metadata to both data/guides.json and docs/data/guides.json
    for target in ("data/guides.json", "docs/data/guides.json"):
        with open(target, "w", encoding="utf-8") as out_f:
            json.dump(guides, out_f, ensure_ascii=False, indent=2)
    print("Updated guides.json with colorful posters & step action metadata!")


if __name__ == "__main__":
    main()
