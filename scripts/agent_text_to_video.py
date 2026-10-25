#!/usr/bin/env python3
"""
Pure Text-to-Video AI Synthesis Agent (Backend MP4 Generator).
Analyzes repair instructions in plain text and generates an animated H.264 MP4
video completely from scratch — WITHOUT inserting any images/scans from the book!
"""
import json
import os
import re
import subprocess
import sys
import uuid
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

# Reuse vector mechanics & font helpers from render_videos.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_videos import (
    FONT_BOLD,
    FONT_REG,
    font,
    wrap_text,
    classify_action,
    compose_step_stage_frame,
)

def load_font(size, bold=False):
    return font(FONT_BOLD if bold else FONT_REG, size)

SUBSYSTEM_POSTERS = [
    (r"гидроцилиндр|гидронасос|рвд|экскаватор|стрел[аы]|ковш|\bмпа\b", "Гидросистема спецтехники", "docs/media/posters/hydraulics-hero.jpg"),
    (r"ремень\s*грм|цепь\s*грм|распредвал|шкив\s*колен|натяжн.*ролик|\bвмт\b", "Привод ГРМ и фазы", "docs/media/posters/belt-hero.jpg"),
    (r"тормоз|суппорт|колодк|барабан|ручник|dot-?4", "Тормозная система", "docs/media/posters/brakes-hero.jpg"),
    (r"свеч[иауе]|катушк.*зажиган|высоковольтн", "Система зажигания и ГБЦ", "docs/media/posters/spark-hero.jpg"),
    (r"радиатор|термостат|охлаждающ|антифриз|бач.*охлажд|помп[ауы]", "Система охлаждения", "docs/media/posters/cooling-hero.jpg"),
    (r"топлив|бензонасос|форсунк|рамп[ауы]|дроссель|воздушн.*фильтр", "Система питания", "docs/media/posters/fuel-hero.jpg"),
    (r"амортизатор|стойк[ауи]|шаров.*опор|рычаг|рулев|ступиц|шрус", "Подвеска и рулевое", "docs/media/posters/suspension-hero.jpg"),
    (r"сцеплен|маховик|коробк.*передач|\bкпп\b|выжимн", "Трансмиссия и сцепление", "docs/media/posters/clutch-hero.jpg"),
    (r"аккумулятор|\bакб\b|клемм[ауы]|генератор|стартер|предохранител|разъем|датчик", "Электрооборудование", "docs/media/posters/electric-hero.jpg"),
]


def detect_subsystem(text: str):
    low = (text or "").lower()
    for pat, name, poster in SUBSYSTEM_POSTERS:
        if re.search(pat, low):
            return name, poster
    return "Двигатель и узлы агрегата", "docs/media/posters/oil-hero.jpg"


def parse_text_into_steps(title: str, raw_text: str):
    cleaned = (raw_text or "").strip()
    lines = [ln.strip() for ln in re.split(r"[\r\n]+", cleaned) if ln.strip()]
    steps = []
    for ln in lines:
        m = re.match(r"^(?:\d{1,2}[.)]|[-•▪])\s*(.+)$", ln)
        if m and len(m.group(1).strip()) >= 8:
            steps.append(m.group(1).strip())
    if len(steps) < 2:
        for m in re.finditer(r"(?:^|\s)\d{1,2}\.\s+([А-ЯЁA-Z][^.!?]{8,195}[.!?]?)", cleaned):
            s = re.sub(r"\(см\.\s*рис[^)]*\)", "", m.group(1), flags=re.I).strip()
            if len(s) >= 10 and s not in steps:
                steps.append(s)
    if len(steps) < 2:
        sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if 14 <= len(s.strip()) <= 200]
        steps = sents[:6]
    if not steps:
        steps = [cleaned[:180] or title or "Выполните операцию согласно тексту техкарты."]
    return steps[:6]


def render_mp4_from_payload(payload: dict, out_mp4_path: str):
    title = str(payload.get("title") or "Синтезированная видеоинструкция").strip()
    raw_text = str(payload.get("text") or "").strip()
    steps_in = payload.get("steps")
    if isinstance(steps_in, list) and len(steps_in) >= 1:
        steps = [str(s.get("caption") if isinstance(s, dict) else s).strip() for s in steps_in[:6]]
    else:
        steps = parse_text_into_steps(title, raw_text)

    full_ctx = f"{title} {raw_text} {' '.join(steps)}"
    sub_name, sub_poster = detect_subsystem(full_ctx)

    W, H = 1280, 720
    fps = 20
    sec_per_step = 4.0
    frames_per_step = int(fps * sec_per_step)

    if os.path.exists(sub_poster):
        hero = Image.open(sub_poster).convert("RGB")
    else:
        hero = Image.new("RGB", (W, H), (14, 23, 42))

    f_badge = load_font(14, bold=True)
    f_title = load_font(22, bold=True)
    f_sub = load_font(14, bold=False)
    f_step = load_font(20, bold=True)
    f_label = load_font(13, bold=True)

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    os.makedirs(os.path.dirname(out_mp4_path), exist_ok=True)

    cmd = [
        ffmpeg_exe, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{W}x{H}",
        "-pix_fmt", "rgb24",
        "-r", str(fps),
        "-i", "-",
        "-an",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "27",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        out_mp4_path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    total_steps = len(steps)
    for idx, step_txt in enumerate(steps):
        step_sub_name, step_poster = detect_subsystem(f"{step_txt} {title}")
        step_hero = Image.open(step_poster).convert("RGB") if os.path.exists(step_poster) else hero
        act_kind, act_label, act_val = classify_action(step_txt, "")

        # Prebuild static HUD frame for this step
        base = Image.new("RGB", (W, H), (10, 15, 26))
        d = ImageDraw.Draw(base)
        d.rectangle([0, 0, W, 72], fill=(17, 24, 39))
        d.line([(0, 72), (W, 72)], fill=(38, 51, 77), width=2)
        d.rounded_rectangle([26, 17, 268, 54], radius=8, fill=(56, 189, 248))
        d.text((38, 27), "ИИ-АГЕНТ • ТЕКСТ -> ВИДЕО", font=f_badge, fill=(9, 14, 26))
        d.text((284, 15), title[:54], font=f_title, fill=(248, 250, 252))
        d.text((284, 44), f"Система: {step_sub_name}  •  0% картинок из книги (чистый синтез)", font=f_sub, fill=(148, 163, 184))

        # Left Telemetry Card
        d.rounded_rectangle([26, 92, 468, 658], radius=14, fill=(17, 24, 39), outline=(38, 51, 77), width=2)
        d.rounded_rectangle([46, 112, 210, 142], radius=6, fill=(30, 58, 138))
        d.text((58, 119), f"ШАГ {idx + 1} ИЗ {total_steps}", font=f_badge, fill=(191, 219, 254))

        y_txt = 166
        for ln in wrap_text(d, step_txt, f_step, 396)[:7]:
            d.text((46, y_txt), ln, font=f_step, fill=(248, 250, 252))
            y_txt += 28

        d.rounded_rectangle([46, 420, 448, 496], radius=10, fill=(12, 23, 42), outline=(56, 189, 248), width=1)
        d.text((60, 434), f"РАСПОЗНАННОЕ ДЕЙСТВИЕ • {act_label}", font=f_label, fill=(56, 189, 248))
        d.text((60, 458), f"Параметр / норма: {act_val}", font=f_sub, fill=(226, 232, 240))

        d.rounded_rectangle([46, 512, 448, 636], radius=10, fill=(15, 29, 26), outline=(16, 185, 129), width=1)
        d.text((60, 526), "РЕЖИМ ГЕНЕРАЦИИ СЦЕНЫ", font=f_label, fill=(52, 211, 153))
        for k, gl in enumerate(wrap_text(d, "Агент проанализировал текст и синтезировал 3D/2.5D механику узла без вставки иллюстраций из книги.", f_sub, 372)[:3]):
            d.text((60, 550 + k * 21), gl, font=f_sub, fill=(209, 250, 229))

        # Right Stage border
        d.rounded_rectangle([488, 92, 1254, 658], radius=14, fill=(13, 19, 33), outline=(38, 51, 77), width=2)

        for f_i in range(frames_per_step):
            t_sec = (idx * frames_per_step + f_i) / fps
            prog = f_i / max(1, frames_per_step - 1)
            global_prog = (idx + prog) / max(1, total_steps)

            frame = base.copy()
            stage_comp = compose_step_stage_frame(
                step_hero, idx + 1, step_sub_name, act_kind, act_label, act_val, t_sec, prog
            )
            frame.paste(stage_comp, (506, 110))

            fd = ImageDraw.Draw(frame)
            fd.rounded_rectangle([26, 676, 1254, 692], radius=8, fill=(30, 41, 59))
            fill_w = max(24, int(1228 * global_prog))
            fd.rounded_rectangle([26, 676, 26 + fill_w, 692], radius=8, fill=(56, 189, 248))

            proc.stdin.write(np.asarray(frame, dtype=np.uint8).tobytes())

    proc.stdin.close()
    err = proc.stderr.read().decode("utf-8", errors="ignore")
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {err[-400:]}")

    return {
        "ok": True,
        "subsystem": sub_name,
        "stepsCount": len(steps),
        "durationSec": round(len(steps) * sec_per_step, 1),
        "sizeBytes": os.path.getsize(out_mp4_path),
    }


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "Usage: agent_text_to_video.py <input.json> <out.mp4>"}))
        sys.exit(1)
    in_json = sys.argv[1]
    out_mp4 = sys.argv[2]
    with open(in_json, "r", encoding="utf-8") as f:
        payload = json.load(f)
    res = render_mp4_from_payload(payload, out_mp4)
    print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
