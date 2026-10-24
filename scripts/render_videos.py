#!/usr/bin/env python3
"""
Renders 4 complete 1280x720 H.264 MP4 repair videos with:
- Smooth Ken Burns motion on the extracted original Ford Fiesta/Fusion manual photos
- Crisp Cyrillic HUD telemetry panel (Step #, Instruction, Tool, Key Spec/Torque, Safety Warning, Progress bar)
- Synchronized studio Russian voiceover audio tracks synthesized via voice-00
"""
import json
import math
import os
import shutil
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

OUT_DIR = "docs/media/videos"
os.makedirs(OUT_DIR, exist_ok=True)


def font(path, size):
    return ImageFont.truetype(path, size)


F_BADGE = font(FONT_BOLD, 14)
F_HEADER = font(FONT_BOLD, 21)
F_SUB = font(FONT_REG, 14)
F_STEP_NUM = font(FONT_MONO, 16)
F_CH_TITLE = font(FONT_BOLD, 16)
F_CAPTION = font(FONT_BOLD, 20)
F_LABEL = font(FONT_BOLD, 12)
F_VAL = font(FONT_REG, 15)
F_VAL_BOLD = font(FONT_BOLD, 15)
F_WARN = font(FONT_BOLD, 14)


def wrap_text(draw, text, fnt, max_width):
    words = text.split()
    lines = []
    cur = ""
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


def draw_hud_background(guide, chapter, step, total_steps, global_step_idx):
    W, H = 1280, 720
    img = Image.new("RGB", (W, H), (11, 15, 25))
    draw = ImageDraw.Draw(img)

    # Top bar background
    draw.rectangle([0, 0, W, 74], fill=(17, 24, 39))
    draw.line([(0, 74), (W, 74)], fill=(38, 49, 71), width=2)

    # Brand / Model pill
    draw.rounded_rectangle([28, 18, 250, 54], radius=8, fill=(245, 158, 11))
    draw.text((42, 27), "FORD FIESTA / FUSION", font=F_BADGE, fill=(11, 15, 25))

    # Guide title
    title_str = guide["shortTitle"]
    draw.text((268, 16), title_str, font=F_HEADER, fill=(248, 250, 252))
    meta_str = f"Стр. {guide['bookPages']}  •  {guide['workplace']}  •  Норматив: {guide['workTime']}"
    draw.text((268, 44), meta_str, font=F_SUB, fill=(148, 163, 184))

    # Right header difficulty badge
    diff_x = 1040
    draw.rounded_rectangle([diff_x, 18, 1252, 54], radius=8, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
    draw.text((diff_x + 14, 27), f"СЛОЖНОСТЬ: {guide['difficulty']}/5", font=F_BADGE, fill=(245, 158, 11))

    # Left telemetry column card (x: 28..468, y: 94..656)
    draw.rounded_rectangle([28, 94, 468, 656], radius=14, fill=(17, 24, 39), outline=(38, 49, 71), width=2)

    # Chapter & Step pill
    ch_pill_text = f"ЭТАП {chapter['index']} ИЗ {len(guide['chapters'])}"
    draw.rounded_rectangle([48, 114, 182, 144], radius=6, fill=(30, 58, 138))
    draw.text((60, 120), ch_pill_text, font=F_BADGE, fill=(191, 219, 254))

    step_str = f"ШАГ {global_step_idx:02d} / {total_steps:02d}"
    draw.text((342, 120), step_str, font=F_STEP_NUM, fill=(245, 158, 11))

    # Chapter title
    ch_lines = wrap_text(draw, chapter["title"], F_CH_TITLE, 396)
    y = 158
    for ln in ch_lines[:2]:
        draw.text((48, y), ln, font=F_CH_TITLE, fill=(148, 163, 184))
        y += 22

    draw.line([(48, y + 8), (448, y + 8)], fill=(38, 49, 71), width=1)
    y += 22

    # Main step instruction
    cap_lines = wrap_text(draw, step["caption"], F_CAPTION, 396)
    for ln in cap_lines[:5]:
        draw.text((48, y), ln, font=F_CAPTION, fill=(248, 250, 252))
        y += 27

    # Tool box
    y = max(y + 14, 356)
    draw.rounded_rectangle([48, y, 448, y + 66], radius=10, fill=(15, 23, 42), outline=(51, 65, 85), width=1)
    draw.text((62, y + 10), "ИНСТРУМЕНТ / ОПЕРАЦИЯ", font=F_LABEL, fill=(56, 189, 248))
    tool_lines = wrap_text(draw, step["tool"], F_VAL_BOLD, 372)
    draw.text((62, y + 32), tool_lines[0], font=F_VAL_BOLD, fill=(226, 232, 240))
    y += 78

    # Torque / Key Metric box
    draw.rounded_rectangle([48, y, 448, y + 74], radius=10, fill=(15, 23, 42), outline=(51, 65, 85), width=1)
    draw.text((62, y + 10), "ТЕХНИЧЕСКИЙ КОНТРОЛЬ / МОМЕНТ", font=F_LABEL, fill=(245, 158, 11))
    km_lines = wrap_text(draw, chapter["keyMetric"], F_VAL, 372)
    ky = y + 30
    for ln in km_lines[:2]:
        draw.text((62, ky), ln, font=F_VAL, fill=(241, 245, 249))
        ky += 19
    y += 86

    # Safety warning box at bottom of left panel
    if y + 96 <= 644:
        draw.rounded_rectangle([48, y, 448, 638], radius=10, fill=(59, 18, 25), outline=(185, 28, 28), width=1)
        draw.text((62, y + 10), "ВАЖНОЕ ПРЕДУПРЕЖДЕНИЕ", font=F_LABEL, fill=(252, 165, 165))
        w_lines = wrap_text(draw, chapter["warning"], F_WARN, 372)
        wy = y + 30
        for ln in w_lines[:3]:
            draw.text((62, wy), ln, font=F_WARN, fill=(254, 226, 226))
            wy += 19

    # Right photo stage frame (x: 490..1252, y: 94..656 -> 762 x 562)
    draw.rounded_rectangle([490, 94, 1252, 656], radius=14, fill=(17, 24, 39), outline=(38, 49, 71), width=2)

    # Bottom progress bar area (y: 672..706)
    draw.rounded_rectangle([28, 676, 1252, 692], radius=8, fill=(30, 41, 59))
    prog_ratio = global_step_idx / max(1, total_steps)
    prog_w = max(20, int(1224 * prog_ratio))
    draw.rounded_rectangle([28, 676, 28 + prog_w, 692], radius=8, fill=(245, 158, 11))

    return img


def prepare_photo_canvas(photo_rel_url, target_w=730, target_h=530):
    path = "docs" + photo_rel_url
    im = Image.open(path).convert("RGB")
    # Fit cleanly inside target_w x target_h while preserving aspect ratio, with soft dark matte
    canvas = Image.new("RGB", (target_w, target_h), (15, 21, 34))
    scale = min((target_w - 24) / im.width, (target_h - 24) / im.height)
    nw = max(1, int(im.width * scale))
    nh = max(1, int(im.height * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (target_w - nw) // 2
    oy = (target_h - nh) // 2
    canvas.paste(resized, (ox, oy))
    return canvas


def render_guide_video(guide, sample_frame_out=None):
    slug = guide["slug"]
    out_mp4 = os.path.join(OUT_DIR, f"{slug}.mp4")
    all_steps = [s for ch in guide["chapters"] for s in ch["steps"]]
    total_steps = len(all_steps)

    tmpdir = tempfile.mkdtemp(prefix=f"vid_{slug}_")
    try:
        chapter_mp4s = []
        global_idx = 0

        for ch_i, ch in enumerate(guide["chapters"]):
            steps = ch["steps"]
            ch_dur = ch["duration"]
            n_steps = len(steps)
            step_dur = ch_dur / n_steps
            fps = 24
            step_clips = []

            for s_i, st in enumerate(steps):
                global_idx += 1
                # Ensure exact frame count so sum of step clips matches chapter audio
                if s_i < n_steps - 1:
                    frames = max(24, round(step_dur * fps))
                else:
                    used_frames = sum(max(24, round(step_dur * fps)) for _ in range(n_steps - 1))
                    frames = max(24, round(ch_dur * fps) - used_frames)
                exact_dur = frames / fps

                bg = draw_hud_background(guide, ch, st, total_steps, global_idx)
                bg_path = os.path.join(tmpdir, f"bg_{ch_i}_{s_i}.png")
                bg.save(bg_path)

                photo = prepare_photo_canvas(st["image"], 730, 530)
                ph_path = os.path.join(tmpdir, f"ph_{ch_i}_{s_i}.jpg")
                photo.save(ph_path, quality=94)

                if sample_frame_out and ch_i == 0 and s_i == 0:
                    preview = bg.copy()
                    preview.paste(photo, (506, 110))
                    preview.save(sample_frame_out)

                step_mp4 = os.path.join(tmpdir, f"step_{ch_i}_{s_i}.mp4")
                # Smooth subtle zoom 1.00 -> 1.055 inside 730x530 stage, overlaid at (506, 110)
                vf = (
                    f"[1:v]scale=1460:1060,"
                    f"zoompan=z='min(zoom+0.00045,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                    f"d={frames}:s=730x530:fps={fps}[zp];"
                    f"[0:v][zp]overlay=506:110:shortest=1,format=yuv420p"
                )
                cmd = [
                    FFMPEG, "-y",
                    "-loop", "1", "-t", f"{exact_dur + 0.5:.3f}", "-i", bg_path,
                    "-i", ph_path,
                    "-filter_complex", vf,
                    "-frames:v", str(frames),
                    "-r", str(fps),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-an", step_mp4
                ]
                subprocess.run(cmd, check=True, capture_output=True)
                step_clips.append(step_mp4)

            # Concat step visuals for this chapter
            concat_txt = os.path.join(tmpdir, f"ch_{ch_i}_list.txt")
            with open(concat_txt, "w") as lf:
                for sc in step_clips:
                    lf.write(f"file '{sc}'\n")

            ch_vis = os.path.join(tmpdir, f"ch_{ch_i}_vis.mp4")
            subprocess.run(
                [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_txt, "-c", "copy", ch_vis],
                check=True, capture_output=True
            )

            # Mux chapter visual with voice-00 MP3 audio
            audio_file = "docs" + ch["audioUrl"]
            ch_mux = os.path.join(tmpdir, f"ch_{ch_i}_mux.mp4")
            subprocess.run([
                FFMPEG, "-y",
                "-i", ch_vis,
                "-i", audio_file,
                "-c:v", "copy",
                "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "1",
                "-shortest",
                ch_mux
            ], check=True, capture_output=True)
            chapter_mp4s.append(ch_mux)

        # Concat all chapters into final faststart MP4
        final_list = os.path.join(tmpdir, "final_list.txt")
        with open(final_list, "w") as ff:
            for cm in chapter_mp4s:
                ff.write(f"file '{cm}'\n")

        subprocess.run([
            FFMPEG, "-y",
            "-f", "concat", "-safe", "0", "-i", final_list,
            "-c", "copy",
            "-movflags", "+faststart",
            out_mp4
        ], check=True, capture_output=True)

        size_mb = os.path.getsize(out_mp4) / (1024 * 1024)
        print(f"Rendered {out_mp4} ({size_mb:.2f} MB)")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    with open("data/guides.json", "r", encoding="utf-8") as f:
        guides = json.load(f)
    for idx, g in enumerate(guides):
        sample = "/tmp/sample_video_frame.png" if idx == 0 else None
        render_guide_video(g, sample_frame_out=sample)


if __name__ == "__main__":
    main()
