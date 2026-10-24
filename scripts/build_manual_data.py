#!/usr/bin/env python3
"""
Extracts structured data, step-by-step repair photos (with vector callouts preserved),
full 385-page search index, TOC, OBD-II trouble codes, torque specs, fluid capacities,
maintenance schedule, and wiring diagram index from Ford_Fiesta_Fusion_TR_Carinfo.com.ua_compressed.pdf.
"""
import json
import os
import re
import subprocess
import pymupdf
import imageio_ffmpeg

PDF_PATH = "Ford_Fiesta_Fusion_TR_Carinfo.com.ua_compressed.pdf"
STEPS_DIR = "docs/media/steps"
DATA_DIR = "data"

os.makedirs(STEPS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

doc = pymupdf.open(PDF_PATH)
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()


def get_audio_duration(path: str) -> float:
    p = subprocess.run([ffmpeg_exe, "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", p.stderr)
    if not m:
        return 30.0
    return round(int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)), 2)


def save_clip(pdf_page: int, rect_tuple: tuple, filename: str, dpi: int = 300) -> str:
    page = doc[pdf_page - 1]
    r = pymupdf.Rect(*rect_tuple)
    # Slight 1pt inset to avoid outer grey border artifacts if needed, keep rounded frame intact
    pix = page.get_pixmap(clip=r, dpi=dpi)
    out_path = os.path.join(STEPS_DIR, filename)
    pix.save(out_path, jpg_quality=92)
    return f"/media/steps/{filename}"


# Save cover image
cover_pix = doc[0].get_pixmap(dpi=160)
cover_pix.save("docs/media/cover.jpg", jpg_quality=90)

# Step photo definitions (verified visually against PDF pages 74, 75, 106, 107, 197, 198, 228)
PHOTO_SPECS = {
    # Guide 1: Oil & Filter Change (book p.105-106 / PDF 106-107)
    "oil_s01.jpg": (106, (226.1, 408.2, 395.9, 501.8)),
    "oil_s02.jpg": (106, (226.1, 537.0, 395.9, 640.2)),
    "oil_s03.jpg": (106, (226.1, 685.9, 395.9, 784.9)),
    "oil_s04.jpg": (106, (407.4, 100.5, 577.1, 223.4)),
    "oil_s05.jpg": (106, (407.2, 318.9, 577.5, 452.0)),
    "oil_s06.jpg": (106, (407.2, 537.2, 577.5, 670.3)),
    "oil_s07.jpg": (107, (45.4, 70.9, 215.2, 174.1)),
    "oil_s08.jpg": (107, (45.4, 299.1, 215.3, 412.0)),
    "oil_s09.jpg": (107, (45.4, 457.7, 215.3, 570.6)),
    "oil_s10.jpg": (107, (45.4, 606.7, 215.3, 719.6)),
    "oil_s11.jpg": (107, (226.8, 70.9, 396.6, 183.7)),
    "oil_s12.jpg": (107, (226.8, 249.4, 396.6, 362.2)),
    "oil_s13.jpg": (107, (226.8, 398.2, 396.6, 451.6)),
    "oil_s14.jpg": (107, (227.1, 547.4, 396.3, 660.2)),

    # Guide 2: Front Brake Pads (book p.196-197 / PDF 197-198)
    "brakes_s01.jpg": (198, (44.6, 71.5, 396.0, 371.4)),
    "brakes_s02.jpg": (197, (45.4, 318.9, 215.3, 431.7)),
    "brakes_s03.jpg": (197, (45.3, 477.7, 215.1, 600.7)),
    "brakes_s04.jpg": (197, (45.3, 626.5, 215.1, 749.5)),
    "brakes_s05.jpg": (197, (226.8, 70.9, 396.4, 203.9)),
    "brakes_s06.jpg": (197, (226.8, 269.3, 396.5, 402.4)),
    "brakes_s07.jpg": (197, (226.8, 457.8, 396.4, 590.9)),
    "brakes_s08.jpg": (197, (226.7, 636.4, 396.5, 759.4)),
    "brakes_s09.jpg": (197, (408.2, 90.6, 577.7, 183.7)),

    # Guide 3: Timing Belt Duratec 1.4/1.6 (book p.73-74 / PDF 74-75)
    "belt_s01.jpg": (74, (44.6, 467.6, 214.3, 590.5)),
    "belt_s02.jpg": (74, (226.1, 70.9, 395.9, 183.7)),
    "belt_s03.jpg": (74, (226.1, 408.2, 395.9, 521.0)),
    "belt_s04.jpg": (74, (226.1, 606.6, 395.9, 719.4)),
    "belt_s05.jpg": (74, (407.8, 249.4, 577.0, 352.6)),
    "belt_s06.jpg": (74, (407.8, 646.3, 577.0, 749.5)),
    "belt_s07.jpg": (75, (45.4, 90.8, 215.2, 184.4)),
    "belt_s08.jpg": (75, (45.4, 527.2, 215.2, 640.0)),
    "belt_s09.jpg": (75, (226.8, 110.6, 396.6, 213.8)),
    "belt_s10.jpg": (75, (226.8, 289.0, 396.6, 402.4)),
    "belt_s11.jpg": (75, (226.8, 437.9, 396.6, 550.7)),
    "belt_s12.jpg": (75, (226.8, 646.3, 396.6, 759.1)),
    "belt_s13.jpg": (75, (408.5, 478.0, 577.7, 590.8)),

    # Guide 4: Spark Plugs (book p.227 / PDF 228)
    "plugs_s01.jpg": (228, (44.7, 676.1, 214.5, 784.7)),
    "plugs_s02.jpg": (228, (226.1, 100.6, 395.9, 213.4)),
    "plugs_s03.jpg": (228, (226.1, 279.2, 395.9, 392.0)),
    "plugs_s04.jpg": (228, (226.1, 418.1, 395.9, 530.9)),
    "plugs_s05.jpg": (228, (226.1, 616.5, 395.9, 749.1)),
    "plugs_s06.jpg": (228, (407.5, 70.9, 577.3, 193.9)),
}

for fname, (pp, rect) in PHOTO_SPECS.items():
    save_clip(pp, rect, fname, dpi=300)

print(f"Saved {len(PHOTO_SPECS)} high-DPI step photos.")

# Measure audio durations
d_oil = [get_audio_duration(f"public/media/audio/oil_0{i}.mp3") for i in range(1, 5)]
d_brakes = [get_audio_duration(f"public/media/audio/brakes_0{i}.mp3") for i in range(1, 4)]
d_belt = [get_audio_duration(f"public/media/audio/belt_0{i}.mp3") for i in range(1, 3)]
d_plugs = [get_audio_duration("public/media/audio/plugs_01.mp3")]


def build_chapters(raw_chapters):
    cursor = 0.0
    out = []
    for idx, ch in enumerate(raw_chapters):
        dur = ch["duration"]
        ch_copy = dict(ch)
        ch_copy["index"] = idx + 1
        ch_copy["startTime"] = round(cursor, 2)
        ch_copy["endTime"] = round(cursor + dur, 2)
        cursor += dur
        out.append(ch_copy)
    return out, round(cursor, 2)


oil_chapters, oil_total = build_chapters([
    {
        "id": "oil-ch-1",
        "title": "Этап 1. Подготовка и слив отработанного масла",
        "audioUrl": "/media/audio/oil_01.mp3",
        "duration": d_oil[0],
        "voiceScript": "Замена масла и масляного фильтра на Форд Фиеста и Фьюжн. Этап первый: подготовка и слив старого масла. Работа выполняется на подъемнике за сорок пять минут. Подготовьте ключ на тринадцать, съемник фильтра, чистую ветошь, емкость не менее пяти литров и свежее масло пять вэ тридцать. Сливайте масло на прогретом двигателе. Сначала отверните пробку маслоналивной горловины. Очистите металлической щеткой и тряпкой сливную пробку картера. Ключом на тринадцать ослабьте пробку, подставьте емкость и осторожно слейте горячее масло. Затем заверните пробку моментом двадцать восемь ньютон-метров.",
        "keyMetric": "Пробка картера: 28 Н·м (1.4/1.6/2.0) • 25 Н·м (1.3)",
        "warning": "Будьте осторожны: моторное масло горячее! Работайте в перчатках.",
        "steps": [
            {"num": 1, "image": "/media/steps/oil_s01.jpg", "caption": "Прогрейте двигатель и отверните пробку маслоналивной горловины.", "tool": "Вручную"},
            {"num": 2, "image": "/media/steps/oil_s02.jpg", "caption": "Очистите металлической щеткой и ветошью сливную пробку масляного картера.", "tool": "Металлическая щетка"},
            {"num": 3, "image": "/media/steps/oil_s03.jpg", "caption": "Ослабьте затяжку пробки сливного отверстия поддона.", "tool": "Ключ «на 13»"},
            {"num": 4, "image": "/media/steps/oil_s04.jpg", "caption": "Подставьте емкость (от 5 л), выверните пробку, слейте масло и заверните пробку (28 Н·м).", "tool": "Емкость ≥ 5 л, динамометрический ключ"}
        ]
    },
    {
        "id": "oil-ch-2",
        "title": "Этап 2. Снятие старого фильтра и очистка фланца",
        "audioUrl": "/media/audio/oil_02.mp3",
        "duration": d_oil[1],
        "voiceScript": "Этап второй: демонтаж старого фильтра и очистка фланца. Масляный фильтр расположен на передней стенке блока в районе третьего цилиндра. Подложите под фильтр обтирочную ткань, чтобы остатки масла не испачкали агрегаты. Специальным ключом или универсальным съемником строньте фильтр с места, затем отверните его рукой и снимите. После снятия тщательно протрите чистой тканью привалочную поверхность фланца на блоке цилиндров от грязи и старого масла.",
        "keyMetric": "Расположение: передняя часть блока у 3-го цилиндра",
        "warning": "Подложите ветошь под корпус фильтра — при отворачивании вытекает остаток масла.",
        "steps": [
            {"num": 5, "image": "/media/steps/oil_s05.jpg", "caption": "Строньте с места масляный фильтр специальным ключом.", "tool": "Съемник масляного фильтра"},
            {"num": 6, "image": "/media/steps/oil_s06.jpg", "caption": "Отверните фильтр рукой и аккуратно снимите его, придерживая снизу ветошью.", "tool": "Обтирочная ткань"},
            {"num": 7, "image": "/media/steps/oil_s07.jpg", "caption": "При отсутствии чашки-съемника используйте универсальный краб-съемник.", "tool": "Универсальный съемник"},
            {"num": 8, "image": "/media/steps/oil_s08.jpg", "caption": "Насухо протрите привалочную поверхность фланца на блоке цилиндров.", "tool": "Чистая безворсовая ткань"}
        ]
    },
    {
        "id": "oil-ch-3",
        "title": "Этап 3. Установка нового фильтра и заливка масла",
        "audioUrl": "/media/audio/oil_03.mp3",
        "duration": d_oil[2],
        "voiceScript": "Этап третий: установка нового фильтра и заливка масла. Заполните новый масляный фильтр чистым моторным маслом примерно на одну треть объема. Обязательно смажьте резиновое уплотнительное кольцо свежим маслом. Наверните фильтр на штуцер вручную и после касания кольца с фланцем блока доверните его ровно на три четверти оборота только руками, без ключа. Залейте в горловину свежее масло: три и восемь литра для мотора один и четыре, или четыре и двадцать пять сотых литра для мотора один и шесть.",
        "keyMetric": "Затяжка фильтра: +3/4 оборота от руки • Масло 5W-30",
        "warning": "Не затягивайте новый фильтр съемником — вы повредите резиновое кольцо!",
        "steps": [
            {"num": 9, "image": "/media/steps/oil_s09.jpg", "caption": "Заполните новый фильтр примерно на 1/3 объема свежим моторным маслом.", "tool": "Ford Formula E 5W-30"},
            {"num": 10, "image": "/media/steps/oil_s10.jpg", "caption": "Смажьте резиновое кольцо маслом и заверните фильтр руками на 3/4 оборота после касания.", "tool": "Только вручную (3/4 об.)"},
            {"num": 11, "image": "/media/steps/oil_s11.jpg", "caption": "Залейте чистое моторное масло (1.4 л — 3,8 л; 1.6 л — 4,25 л; 1.3 л — 4,35 л; 2.0 л — 4,3 л).", "tool": "Воронка, канистра 5W-30"}
        ]
    },
    {
        "id": "oil-ch-4",
        "title": "Этап 4. Контроль уровня по щупу и проверка герметичности",
        "audioUrl": "/media/audio/oil_04.mp3",
        "duration": d_oil[3],
        "voiceScript": "Этап четвертый: контроль уровня и проверка на утечки. Подождите от трех до пяти минут, чтобы масло стекло в поддон. Извлеките щуп, протрите его насухо, вставьте до упора и снова выньте. Масляная пленка должна быть между метками минимум и максимум. Заверните крышку горловины и запустите двигатель на холостом ходу. Лампа аварийного давления масла должна погаснуть через две-три секунды. Убедитесь, что под сливной пробкой и фильтром нет подтеков.",
        "keyMetric": "Пауза стока: 3–5 мин • Лампа давления гаснет за 2–3 с",
        "warning": "Обязательно осмотрите сливную пробку и стык фильтра при работающем двигателе.",
        "steps": [
            {"num": 12, "image": "/media/steps/oil_s12.jpg", "caption": "Подождите 3–5 минут, извлеките масляный щуп, протрите его насухо и вставьте обратно.", "tool": "Чистая салфетка"},
            {"num": 13, "image": "/media/steps/oil_s13.jpg", "caption": "Повторно выньте щуп: пленка масла должна находиться строго между метками MIN и MAX.", "tool": "Контроль MIN–MAX"},
            {"num": 14, "image": "/media/steps/oil_s14.jpg", "caption": "Закройте горловину, запустите ДВС (лампа гаснет за 2–3 с) и проверьте отсутствие утечек.", "tool": "Осмотр на холостом ходу"}
        ]
    }
])

brakes_chapters, brakes_total = build_chapters([
    {
        "id": "brakes-ch-1",
        "title": "Этап 1. Устройство суппорта, подготовка и снятие фиксатора",
        "audioUrl": "/media/audio/brakes_01.mp3",
        "duration": d_brakes[0],
        "voiceScript": "Замена передних тормозных колодок Форд Фиеста и Фьюжн. Этап первый: подготовка и снятие пружинного фиксатора. Колодки меняются строго комплектом из четырех штук на обе стороны. Перед работой проверьте уровень тормозной жидкости Дот четыре в бачке: если он у отметки максимум, откачайте немного жидкости шприцем. Подготовьте баллонный ключ, большую отвертку и шестигранник на семь. Снимите переднее колесо. Большой отверткой плавно утопите поршень рабочего цилиндра внутрь суппорта, затем подденьте отверткой концы пружинного фиксатора наружной колодки и снимите его.",
        "keyMetric": "Комплект: 4 колодки • Тормозная жидкость: Super DOT-4",
        "warning": "Если бачок ГТЦ полон до MAX — откачайте часть жидкости шприцем до утапливания поршня!",
        "steps": [
            {"num": 1, "image": "/media/steps/brakes_s01.jpg", "caption": "Устройство переднего тормоза: колодки (1, 2), скоба (3), пружина (4), суппорт (5), пальцы (8, 9).", "tool": "Схема узла (рис. 9.6)"},
            {"num": 2, "image": "/media/steps/brakes_s02.jpg", "caption": "Утопите поршень большой отверткой и извлеките концы пружинного фиксатора из суппорта.", "tool": "Большая плоская отвертка"},
            {"num": 3, "image": "/media/steps/brakes_s03.jpg", "caption": "Снимите пружинный фиксатор наружной колодки и оцените его целостность.", "tool": "Осмотр пружины"}
        ]
    },
    {
        "id": "brakes-ch-2",
        "title": "Этап 2. Выворачивание пальцев и демонтаж изношенных колодок",
        "audioUrl": "/media/audio/brakes_02.mp3",
        "duration": d_brakes[1],
        "voiceScript": "Этап второй: демонтаж суппорта и старых колодок. Подденьте отверткой и снимите пластиковые защитные колпачки обоих направляющих пальцев. Шестигранником на семь выверните нижний и верхний направляющие пальцы и извлеките их из втулок. Снимите суппорт с направляющей скобы, следя, чтобы тормозной шланг не перекручивался и не натягивался. Извлеките внутреннюю колодку с пружинным захватом из полости поршня, а затем выведите наружную колодку из пазов скобы.",
        "keyMetric": "Специнструмент: шестигранник «на 7»",
        "warning": "Не оставляйте снятый суппорт висеть на тормозном шланге — подвяжите его к пружине стойки.",
        "steps": [
            {"num": 4, "image": "/media/steps/brakes_s04.jpg", "caption": "Подденьте отверткой и снимите защитные колпачки направляющих пальцев суппорта.", "tool": "Тонкая отвертка"},
            {"num": 5, "image": "/media/steps/brakes_s05.jpg", "caption": "Шестигранником «на 7» выверните и извлеките нижний и верхний направляющие пальцы.", "tool": "Шестигранник «на 7»"},
            {"num": 6, "image": "/media/steps/brakes_s06.jpg", "caption": "Снимите суппорт с направляющей скобы, не допуская перекручивания и натяжения шланга.", "tool": "Подвес для суппорта"},
            {"num": 7, "image": "/media/steps/brakes_s07.jpg", "caption": "Извлеките внутреннюю тормозную колодку (с трехлепестковой пружиной) из поршня.", "tool": "Вручную"},
            {"num": 8, "image": "/media/steps/brakes_s08.jpg", "caption": "Снимите наружную тормозную колодку, выводя ее из пазов направляющей скобы.", "tool": "Очистка пазов скобы"}
        ]
    },
    {
        "id": "brakes-ch-3",
        "title": "Этап 3. Проверка диска, сборка с фиксатором резьбы и прикатка",
        "audioUrl": "/media/audio/brakes_03.mp3",
        "duration": d_brakes[2],
        "voiceScript": "Этап третий: ревизия, сборка и прикатка тормозов. Сверьте маркировку новых колодок со старыми и проверьте минимальную толщину тормозного диска: не менее двадцати миллиметров. Осмотрите резинопластиковые втулки пальцев и проверьте легкость хода суппорта. Установите новые колодки и суппорт. Перед заворачиванием нанесите на резьбу направляющих пальцев анаэробный фиксатор и затяните их моментом двадцать восемь ньютон-метров. Перед выездом обязательно несколько раз нажмите педаль тормоза, чтобы свести колодки к диску, и проверьте уровень жидкости в бачке.",
        "keyMetric": "Пальцы суппорта: 28 Н·м • Гайки колеса: 90 Н·м • Диск ≥ 20 мм",
        "warning": "Перед началом движения ОБЯЗАТЕЛЬНО нажмите педаль тормоза 4–5 раз до твердой педали!",
        "steps": [
            {"num": 9, "image": "/media/steps/brakes_s09.jpg", "caption": "Сверьте маркировку колодок, смажьте резьбу пальцев фиксатором резьбы (28 Н·м), прокачайте педаль.", "tool": "Фиксатор резьбы, ключ 28 Н·м"}
        ]
    }
])

belt_chapters, belt_total = build_chapters([
    {
        "id": "belt-ch-1",
        "title": "Этап 1. Блокировка фаз ВМТ и демонтаж шкивов, крышек и опоры ДВС",
        "audioUrl": "/media/audio/belt_01.mp3",
        "duration": d_belt[0],
        "voiceScript": "Замена ремня привода ГРМ на двигателях Дюратек один и четыре и один и шесть литра. Этап первый: фиксация фаз и разборка привода. Регламент замены составляет шестьдесят тысяч километров или шесть лет. Снимите правое переднее колесо и брызговик двигателя. Ножом разрежьте и снимите одноразовые эластичные ремни гидроусилителя и навесных агрегатов. Выставьте первый цилиндр в верхнюю мертвую точку такта сжатия: вверните спецболт упора коленвала в блок и установите стопорную планку в пазы распредвалов. Удерживая тормоз на пятой передаче, отверните болт и снимите шкив коленвала, затем снимите шкив водяного насоса, верхнюю и нижнюю крышки ГРМ, правую опору двигателя и ее кронштейн.",
        "keyMetric": "Спецболт ВМТ: М10×1,5 (длина 38,3 мм) + планка распредвалов",
        "warning": "Шкивы Duratec 1.4/1.6 БЕЗ шпонок! Никогда не отворачивайте болт коленвала без фиксаторов ГРМ.",
        "steps": [
            {"num": 1, "image": "/media/steps/belt_s01.jpg", "caption": "Поднимите передок, снимите правое колесо и нижний брызговик двигателя.", "tool": "Подъемник, головки «на 8/10»"},
            {"num": 2, "image": "/media/steps/belt_s02.jpg", "caption": "Разрежьте ножом одноразовые эластичные ремни привода ГУР и вспомогательных агрегатов.", "tool": "Монтажный нож"},
            {"num": 3, "image": "/media/steps/belt_s03.jpg", "caption": "Выставьте ВМТ 1-го цилиндра: уприте коленвал в спецболт М10×1,5 и вставьте планку в распредвалы.", "tool": "Набор фиксаторов Ford"},
            {"num": 4, "image": "/media/steps/belt_s04.jpg", "caption": "Удерживая тормоз на V передаче (с помощником), выверните болт шкива коленвала.", "tool": "Головка «на 18»"},
            {"num": 5, "image": "/media/steps/belt_s05.jpg", "caption": "Извлеките болт (он одноразовый!) и снимите шкив коленчатого вала.", "tool": "Новый болт шкива"},
            {"num": 6, "image": "/media/steps/belt_s06.jpg", "caption": "Снимите шкив водяного насоса (4 болта) и выверните 9 болтов верхней крышки ГРМ.", "tool": "Головка «на 8», «на 10»"},
            {"num": 7, "image": "/media/steps/belt_s07.jpg", "caption": "Расположение 9 точек крепления верхней защитной крышки ремня ГРМ.", "tool": "Схема крепежа"},
            {"num": 8, "image": "/media/steps/belt_s08.jpg", "caption": "Снимите нижнюю крышку ГРМ, вывесите двигатель, снимите правую опору и ее кронштейн.", "tool": "Домкрат под ДВС, TORX E8, «на 13»"}
        ]
    },
    {
        "id": "belt-ch-2",
        "title": "Этап 2. Установка ремня ГРМ, затяжка шкива (45 Н·м + 90°) и проверка фаз",
        "audioUrl": "/media/audio/belt_02.mp3",
        "duration": d_belt[1],
        "voiceScript": "Этап второй: установка нового ремня и контрольная проверка фаз. Пассатижами поверните планку натяжного ролика по часовой стрелке до совмещения отверстий, зафиксируйте ее штифтом и снимите старый ремень. Категорически запрещено вращать коленвал при снятом ремне, иначе поршни повредят клапаны. При замене ролика затяните его болт моментом двадцать пять ньютон-метров. Наденьте новый ремень последовательно на шкив выпускного распредвала, впускного вала, коленвала и заведите за ролик, после чего выньте стопорный штифт ролика. Установите крышки и шкив коленвала, затянув новый болт шкива в два этапа: сорок пять ньютон-метров и доворот на девяносто градусов. Выньте фиксаторы, проверните коленвал на два оборота и повторно проверьте вхождение стопорной планки распредвалов.",
        "keyMetric": "Болт шкива КВ: 45 Н·м + 90° • Ролик: 25 Н·м • Опора: 48 Н·м",
        "warning": "ЗАПРЕЩЕНО проворачивать коленвал при снятом ремне ГРМ — клапаны упрутся в поршни!",
        "steps": [
            {"num": 9, "image": "/media/steps/belt_s09.jpg", "caption": "Пассатижами поверните подвижную лапку натяжного ролика по часовой стрелке до совмещения отверстий.", "tool": "Пассатижи"},
            {"num": 10, "image": "/media/steps/belt_s10.jpg", "caption": "Вставьте фиксирующий штифт в совмещенные отверстия натяжного ролика.", "tool": "Фиксирующий штифт"},
            {"num": 11, "image": "/media/steps/belt_s11.jpg", "caption": "Снимите старый ремень ГРМ со шкивов (валы остаются зафиксированными).", "tool": "Без вращения валов!"},
            {"num": 12, "image": "/media/steps/belt_s12.jpg", "caption": "Замените натяжной ролик (25 Н·м), уложите ремень: выпуск → впуск → КВ → ролик, выньте штифт.", "tool": "Момент 25 Н·м"},
            {"num": 13, "image": "/media/steps/belt_s13.jpg", "caption": "Затяните шкив КВ (45 Н·м + 90°), сделайте 2 оборота КВ и проверьте свободный вход планки в распредвалы.", "tool": "Динамометр + угломер 90°"}
        ]
    }
])

plugs_chapters, plugs_total = build_chapters([
    {
        "id": "plugs-ch-1",
        "title": "Этап 1. Продувка колодцев, замена свечей и регулировка зазора 1,3 мм",
        "audioUrl": "/media/audio/plugs_01.mp3",
        "duration": d_plugs[0],
        "voiceScript": "Замена и обслуживание свечей зажигания Форд Фиеста и Фьюжн. Вам понадобятся свечной ключ на шестнадцать с резиновой втулкой, головка на восемь, круглый щуп и сжатый воздух. Сначала снимите корпус воздушного фильтра для доступа к головке блока. Аккуратно снимите высоковольтные наконечники, удерживая их за колпачки, а не за провода. Обязательно продуйте свечные колодцы сжатым воздухом, чтобы песок и пыль не попали в цилиндры. Выверните свечи ключом на шестнадцать. Проверьте круглым щупом зазор между электродами: норма составляет одну целую три десятых миллиметра. При регулировке подгибайте только боковой электрод, не касаясь центрального изолятора. Вверните свечи сначала от руки, затем затяните моментом пятнадцать ньютон-метров.",
        "keyMetric": "Зазор электродов: 1,3 мм • Момент затяжки свечей: 15 Н·м",
        "warning": "Регулируйте зазор ТОЛЬКО подгибанием бокового электрода — нажим на центральный сломает изолятор!",
        "steps": [
            {"num": 1, "image": "/media/steps/plugs_s01.jpg", "caption": "Снимите корпус воздушного фильтра для доступа к свечным колодцам ГБЦ.", "tool": "Головка «на 8», отвертка"},
            {"num": 2, "image": "/media/steps/plugs_s02.jpg", "caption": "Снимите высоковольтные наконечники и тщательно продуйте свечные колодцы сжатым воздухом.", "tool": "Пневмопистолет"},
            {"num": 3, "image": "/media/steps/plugs_s03.jpg", "caption": "Выверните свечу зажигания специальным свечным ключом «на 16» с резиновой втулкой.", "tool": "Свечной ключ «на 16»"},
            {"num": 4, "image": "/media/steps/plugs_s04.jpg", "caption": "Извлеките свечу из колодца и оцените цвет нагара на изоляторе.", "tool": "Диагностика сгорания"},
            {"num": 5, "image": "/media/steps/plugs_s05.jpg", "caption": "Круглым щупом проверьте искровой зазор между электродами — норма 1,3 мм.", "tool": "Круглый щуп 1,3 мм"},
            {"num": 6, "image": "/media/steps/plugs_s06.jpg", "caption": "При необходимости подогните боковой электрод, вверните свечи от руки и затяните моментом 15 Н·м.", "tool": "Момент затяжки 15 Н·м"}
        ]
    }
])

GUIDES = [
    {
        "slug": "oil-change",
        "title": "Замена масла в двигателе и масляного фильтра",
        "shortTitle": "Замена масла и фильтра ДВС",
        "section": "Раздел 5. Двигатель — Система смазки",
        "bookPages": "105–106",
        "pdfPages": [106, 107],
        "difficulty": 2,
        "workers": 1,
        "workplace": "На подъемнике / яме",
        "workTime": "45 мин",
        "interval": "20 000 км / 1 год (10 000 км в городе)",
        "engines": ["Duratec 1.3", "Duratec 1.4", "Duratec 1.6", "Duratec-HE 2.0"],
        "videoUrl": "/media/videos/oil-change.mp4",
        "posterUrl": "/media/steps/oil_s09.jpg",
        "totalDuration": oil_total,
        "tools": [
            "Ключ или головка «на 13» (сливная пробка)",
            "Специальный съемник масляного фильтра",
            "Емкость для слива масла (не менее 5 л)",
            "Металлическая щетка и чистая ветошь",
            "Динамометрический ключ (25–28 Н·м)"
        ],
        "consumables": [
            "Моторное масло Ford/Motorcraft Formula E SAE 5W-30 (ACEA A1/B1 или A3/B3)",
            "Объем с фильтром: 1.4 л — 3,8 л | 1.6 л — 4,25 л | 2.0 л — 4,3 л | 1.3 л — 4,35 л",
            "Новый масляный фильтр с уплотнительным кольцом"
        ],
        "torques": [
            {"part": "Пробка маслосливного отверстия (1.4 / 1.6 / 2.0 л)", "value": "28 Н·м"},
            {"part": "Пробка маслосливного отверстия (1.3 л)", "value": "25 Н·м"},
            {"part": "Масляный фильтр", "value": "От руки + 3/4 оборота"}
        ],
        "chapters": oil_chapters
    },
    {
        "slug": "brake-pads",
        "title": "Замена передних тормозных колодок",
        "shortTitle": "Передние тормозные колодки",
        "section": "Раздел 9. Тормозная система",
        "bookPages": "195–197",
        "pdfPages": [196, 197, 198],
        "difficulty": 2,
        "workers": 1,
        "workplace": "На машине (домкрат)",
        "workTime": "30 мин",
        "interval": "Контроль каждые 20 000 км",
        "engines": ["Все модификации Fiesta / Fusion"],
        "videoUrl": "/media/videos/brake-pads.mp4",
        "posterUrl": "/media/steps/brakes_s05.jpg",
        "totalDuration": brakes_total,
        "tools": [
            "Шестигранник «на 7» (направляющие пальцы суппорта)",
            "Баллонный ключ для гаек колес и домкрат с упорами",
            "Большая плоская отвертка (утапливание поршня)",
            "Шприц или груша (для откачки излишка DOT-4 из бачка)"
        ],
        "consumables": [
            "Комплект передних тормозных колодок (4 шт., строго одной маркировки)",
            "Анаэробный фиксатор резьбы (для направляющих пальцев)",
            "Тормозная жидкость Motorcraft Super DOT-4 (при доливке)"
        ],
        "torques": [
            {"part": "Пальцы крепления суппорта к направляющей колодок", "value": "28 Н·м"},
            {"part": "Болты направляющей колодок к поворотному кулаку", "value": "70 Н·м"},
            {"part": "Гайки крепления колес", "value": "90 Н·м"},
            {"part": "Мин. допустимая толщина тормозного диска", "value": "20 мм (ST 2.0 — 23 мм)"}
        ],
        "chapters": brakes_chapters
    },
    {
        "slug": "timing-belt",
        "title": "Замена ремня привода ГРМ и натяжного ролика",
        "shortTitle": "Замена ремня ГРМ (1.4 / 1.6)",
        "section": "Раздел 5. Двигатель — Привод ГРМ",
        "bookPages": "73–74",
        "pdfPages": [74, 75],
        "difficulty": 4,
        "workers": 2,
        "workplace": "На подъемнике / яме",
        "workTime": "6 часов",
        "interval": "60 000 км или 6 лет (осмотр каждые 20 000 км)",
        "engines": ["Duratec 1.4 (80 л.с.)", "Duratec 1.6 (100 л.с.)"],
        "videoUrl": "/media/videos/timing-belt.mp4",
        "posterUrl": "/media/steps/belt_s11.jpg",
        "totalDuration": belt_total,
        "tools": [
            "Фиксирующий спецболт КВ М10×1,5 (длина стержня 38,3 мм)",
            "Стопорная планка распределительных валов",
            "Головки и ключи «на 8», «на 10», «на 13», «на 18», TORX E8",
            "Пассатижи и стопорный штифт натяжного ролика",
            "Динамометрический ключ и угломер (45 Н·м + 90°)"
        ],
        "consumables": [
            "Ремень привода ГРМ и натяжной ролик",
            "Новый одноразовый болт шкива коленчатого вала",
            "Новые эластичные ремни привода ГУР и вспомогательных агрегатов"
        ],
        "torques": [
            {"part": "Болт шкива коленвала (1-й этап + 2-й этап)", "value": "45 Н·м + доворот на 90°"},
            {"part": "Болт натяжного ролика ГРМ", "value": "25 Н·м"},
            {"part": "Заглушка технологического отверстия ВМТ в блоке", "value": "20 Н·м"},
            {"part": "Правая опора двигателя (к кронштейну / к кузову)", "value": "48 Н·м / 48 Н·м"},
            {"part": "Кронштейн правой опоры к ГБЦ", "value": "25 Н·м"}
        ],
        "chapters": belt_chapters
    },
    {
        "slug": "spark-plugs",
        "title": "Замена и обслуживание свечей зажигания",
        "shortTitle": "Замена свечей зажигания",
        "section": "Раздел 10. Электрооборудование — СУД",
        "bookPages": "227",
        "pdfPages": [228],
        "difficulty": 2,
        "workers": 1,
        "workplace": "На машине",
        "workTime": "1 ч 30 мин",
        "interval": "Проверка каждые 20 000 км",
        "engines": ["Duratec 1.3", "Duratec 1.4", "Duratec 1.6", "Duratec-HE 2.0"],
        "videoUrl": "/media/videos/spark-plugs.mp4",
        "posterUrl": "/media/steps/plugs_s05.jpg",
        "totalDuration": plugs_total,
        "tools": [
            "Свечной ключ «на 16» с резиновой удерживающей втулкой",
            "Торцовая головка «на 8» и крестовая отвертка (корпус фильтра)",
            "Компрессор / сжатый воздух для продувки свечных колодцев",
            "Круглый проволочный щуп 1,3 мм"
        ],
        "consumables": [
            "1.4 / 1.6 л: Motorcraft AYFS22C",
            "1.3 л: Motorcraft AYFS32CJ | 2.0 л ST: Motorcraft AYFS22IPJ",
            "Аналоги: DENSO T16VR-U10 / PT16VR13 (зазор 1,3 мм)"
        ],
        "torques": [
            {"part": "Свечи зажигания в ГБЦ", "value": "15 Н·м"},
            {"part": "Болты крепления катушки зажигания", "value": "10 Н·м"},
            {"part": "Искровой зазор между электродами", "value": "1,3 мм"}
        ],
        "chapters": plugs_chapters
    }
]

with open(os.path.join(DATA_DIR, "guides.json"), "w", encoding="utf-8") as f:
    json.dump(GUIDES, f, ensure_ascii=False, indent=2)


# Parse Table of Contents from PDF pages 5..10
toc_raw = "\n".join(doc[i].get_text() for i in range(4, 10))
# Normalize dotted lines across line breaks
lines = [ln.strip() for ln in toc_raw.splitlines() if ln.strip()]
merged_toc = []
buf = ""
for ln in lines:
    if ln.lower() in ("содержание", "ford fiesta/fusion") or re.fullmatch(r"\d+", ln):
        continue
    buf = (buf + " " + ln).strip() if buf else ln
    m = re.search(r"^(.*?)(?:\s*\.\s*)+\s*(\d{1,3})$", buf)
    if m:
        title = re.sub(r"\s*\.\s*$", "", m.group(1)).strip()
        book_p = int(m.group(2))
        merged_toc.append({"title": title, "bookPage": book_p, "pdfPage": book_p + 1})
        buf = ""

sections = []
current_sec = None
for item in merged_toc:
    t = item["title"]
    if t.startswith("РАЗДЕЛ ") or t in ("ПРИЛОЖЕНИЯ", "СХЕМЫ ЭЛЕКТРООБОРУДОВАНИЯ"):
        current_sec = {
            "title": t,
            "bookPage": item["bookPage"],
            "pdfPage": item["pdfPage"],
            "items": []
        }
        sections.append(current_sec)
    elif current_sec is not None:
        current_sec["items"].append(item)

print(f"Parsed {len(sections)} TOC sections and {sum(len(s['items']) for s in sections)} subsections.")


# Parse Wiring Diagrams from PDF pages 354..384
wiring_diagrams = []
for pdf_p in range(354, 385):
    txt = doc[pdf_p - 1].get_text()
    # Match blocks starting with "Схема ..."
    matches = re.finditer(r"(Схема\s+\d+[а-я]?)\.\s*([^:]+):\s*(.*?)(?=\nСхема\s+\d+|\Z)", txt, flags=re.S)
    for m in matches:
        code = m.group(1).strip()
        system_name = " ".join(m.group(2).split())
        components = " ".join(m.group(3).replace("-\n", "").split())
        # Remove page headers/footers accidentally caught at end
        components = re.sub(r"\s*(?:схемы электрооборудования|\d{3}\s*Ford Fiesta/Fusion).*$", "", components, flags=re.I)
        wiring_diagrams.append({
            "code": code,
            "title": system_name,
            "components": components,
            "bookPage": pdf_p - 1,
            "pdfPage": pdf_p
        })

# Sort naturally by schema number
def schema_sort_key(d):
    m = re.search(r"(\d+)([а-я]?)", d["code"])
    return (int(m.group(1)), m.group(2)) if m else (999, "")

wiring_diagrams.sort(key=schema_sort_key)
print(f"Extracted {len(wiring_diagrams)} wiring diagrams.")


# Parse OBD-II Trouble Codes cleanly from PDF pages 339..343 + normalize Cyrillic/OCR lookalikes
CYR_TO_LAT = str.maketrans({
    "Р": "P", "В": "B", "С": "C", "А": "A", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "0", "Т": "T", "Х": "X", "Э": "9", "I": "1"
})


def normalize_dtc(raw_code: str) -> str:
    c = raw_code.strip().translate(CYR_TO_LAT)
    c = re.sub(r"^1\s+", "", c)
    # In this book, some B-codes were OCR-typeset with leading '8' instead of 'B' (e.g., 81047 -> B1047, 81317 -> B1317)
    if re.fullmatch(r"8\d{4}", c):
        c = "B" + c[1:]
    return c


# Extract code+description pairs using spatial columns on PDF pages 339..343
dtc_list = []
for pdf_p in range(339, 344):
    page = doc[pdf_p - 1]
    words = page.get_text("blocks")
    # Also parse structured table rows via y-coordinate alignment in left (x < 310) and right (x >= 310) halves
    blocks = [b for b in words if b[6] == 0]
    for col_min, col_max in [(0, 310), (310, 630)]:
        col_blocks = [b for b in blocks if col_min <= b[0] < col_max and 60 <= b[1] <= 790]
        # Separate code blocks (narrow left side of column) vs description blocks
        code_x_limit = col_min + 72
        c_lines = []
        d_lines = []
        d_dict = page.get_text("dict")
        for blk in d_dict["blocks"]:
            if blk.get("type") != 0:
                continue
            for ln in blk["lines"]:
                x0, y0, x1, y1 = ln["bbox"]
                if not (col_min <= x0 < col_max and 65 <= y0 <= 785):
                    continue
                txt_ln = "".join(sp["text"] for sp in ln["spans"]).strip()
                if not txt_ln or txt_ln in ("Код", "Описание неисправности") or "прил. 4" in txt_ln.lower() or "коды неисправностей" in txt_ln.lower():
                    continue
                if "КУЗОВНЫЕ РАЗМЕРЫ" in txt_ln or "Приложение" in txt_ln or "ЛАМПЫ" in txt_ln or "ГОРЮЧЕ-СМАЗОЧНЫЕ" in txt_ln:
                    continue
                if pdf_p == 339 and y0 < 470:
                    continue
                if pdf_p == 343 and y0 > 245:
                    continue
                if x0 < code_x_limit:
                    c_lines.append((y0, txt_ln))
                else:
                    d_lines.append((y0, txt_ln))
        c_lines.sort()
        d_lines.sort()
        # Merge multiline codes like "Р0201 –" + next line "Р0204"
        merged_codes = []
        i = 0
        while i < len(c_lines):
            y0, ct = c_lines[i]
            if (ct.endswith("–") or ct.endswith("-") or ct.endswith(",")) and i + 1 < len(c_lines) and abs(c_lines[i + 1][0] - y0) < 16:
                ct = ct + " " + c_lines[i + 1][1]
                i += 2
            else:
                i += 1
            merged_codes.append((y0, ct))

        # Assign each description line to the nearest preceding/aligned code y0
        for idx_c, (cy, raw_c) in enumerate(merged_codes):
            next_cy = merged_codes[idx_c + 1][0] if idx_c + 1 < len(merged_codes) else 9999
            desc_parts = [dt for (dy, dt) in d_lines if (cy - 4) <= dy < (next_cy - 4)]
            desc = " ".join(desc_parts).replace("- ", "").strip()
            norm_c = " – ".join(normalize_dtc(part) for part in re.split(r"\s*[–-]\s*", raw_c)) if ("–" in raw_c or "-" in raw_c) else ", ".join(normalize_dtc(p) for p in raw_c.split(","))
            if norm_c and desc:
                cat = norm_c[0] if norm_c[0] in ("P", "B", "C", "U") else "P"
                cat_label = {
                    "P": "Двигатель и трансмиссия (Powertrain)",
                    "B": "Кузовная электроника и SRS (Body)",
                    "C": "Шасси, ABS/ESP и рулевое (Chassis)",
                    "U": "Шина данных CAN и связь блоков (Network)"
                }.get(cat, "Бортовая диагностика")
                dtc_list.append({
                    "code": norm_c,
                    "category": cat,
                    "categoryName": cat_label,
                    "description": desc,
                    "bookPage": pdf_p - 1,
                    "pdfPage": pdf_p
                })

print(f"Extracted {len(dtc_list)} OBD-II DTC fault codes.")


# Structured Reference Data (Fluids, Torques, Lamps, Maintenance Schedule)
REFERENCE_DATA = {
    "bookMeta": {
        "title": "Ford Fiesta / Fusion — Руководство по эксплуатации, ТО и ремонту",
        "publisher": "ИД «Третий Рим» (серия «Ремонт без проблем»), Москва, 2010",
        "authors": "А.В. Кондратьев, А.И. Ханов, И.С. Горфин",
        "isbn": "978-5-91770-033-5",
        "totalPages": len(doc),
        "models": [
            "Ford Fiesta Mk5 (выпуск с 2001 г., рестайлинг 2006 г.) — 1.3, 1.4, 1.6 Duratec; 2.0 Duratec-HE (ST)",
            "Ford Fusion (выпуск с 2002 г., рестайлинг 2006 г.) — 1.4, 1.6 Duratec"
        ]
    },
    "fluids": [
        {"node": "Топливный бак", "volume": "45,0 л", "spec": "Неэтилированный бензин с октановым числом не ниже АИ-95"},
        {"node": "Двигатель Duratec 1,3 л (с фильтром)", "volume": "4,35 л", "spec": "Ford/Motorcraft Formula E SAE 5W-30 (допустимо 5W-40, 10W-40 ACEA A1/B1, A3/B3)"},
        {"node": "Двигатель Duratec 1,4 л (с фильтром)", "volume": "3,80 л", "spec": "Ford/Motorcraft Formula E SAE 5W-30"},
        {"node": "Двигатель Duratec 1,6 л (с фильтром)", "volume": "4,25 л", "spec": "Ford/Motorcraft Formula E SAE 5W-30"},
        {"node": "Двигатель Duratec-HE 2,0 л ST (с фильтром)", "volume": "4,30 л", "spec": "Ford/Motorcraft Formula E SAE 5W-30"},
        {"node": "Система охлаждения двигателя", "volume": "5,00 л", "spec": "Антифриз Motorcraft Super Plus Antifreeze 2000 (WSS-M97B44-D)"},
        {"node": "5-ступенчатая МКПП Durashift / робот EST", "volume": "2,30 л", "spec": "Трансмиссионное масло Ford WSD-M2C 200-C"},
        {"node": "4-ступенчатая АКПП AW81-40-LE", "volume": "5,75 л", "spec": "Жидкость для АКПП Ford WSS-M2C 924-A"},
        {"node": "Гидроусилитель рулевого управления (ГУР)", "volume": "По меткам MIN–MAX", "spec": "Ford Power Steering Fluid WSA-M2C 195-A"},
        {"node": "Гидропривод тормозов и сцепления", "volume": "По меткам MIN–MAX", "spec": "Тормозная жидкость Motorcraft Super DOT-4"},
        {"node": "Чехол наружного / внутреннего ШРУС", "volume": "0,09 л / 0,10 л", "spec": "Пластичная смазка WWS-M1C 259-A1"},
        {"node": "Бачок омывателя стекол", "volume": "2,50 л", "spec": "Незамерзающая жидкость (до −40 °C зимой)"}
    ],
    "torques": [
        {"group": "Двигатель 1.4 / 1.6", "part": "Пробка маслосливного отверстия поддона", "nm": "28 Н·м"},
        {"group": "Двигатель 1.3", "part": "Пробка маслосливного отверстия поддона", "nm": "25 Н·м"},
        {"group": "Двигатель 1.4 / 1.6", "part": "Болт крепления шкива коленчатого вала", "nm": "45 Н·м + доворот на 90°"},
        {"group": "Двигатель 1.3", "part": "Болт крепления шкива коленчатого вала", "nm": "125 Н·м"},
        {"group": "Двигатель 2.0 ST", "part": "Болт крепления шкива коленчатого вала", "nm": "100 Н·м + доворот на 90°"},
        {"group": "Двигатель 1.4 / 1.6", "part": "Болт крепления натяжного ролика ремня ГРМ", "nm": "25 Н·м"},
        {"group": "Двигатель 1.4 / 1.6", "part": "Болты крепления шкивов распредвалов", "nm": "60 Н·м"},
        {"group": "Двигатель 1.4 / 1.6 / 2.0", "part": "Болты ГБЦ (3 этапа)", "nm": "15 Н·м → 30 Н·м → доворот 90°"},
        {"group": "Двигатель 1.3", "part": "Болты ГБЦ (4 этапа)", "nm": "4 Н·м → 15 Н·м → +90° → +120°"},
        {"group": "Все двигатели", "part": "Опоры силового агрегата (правая / задняя / левая к кузову)", "nm": "48 Н·м (гайка левой к кронштейну — 90 Н·м)"},
        {"group": "Трансмиссия", "part": "Болты крепления картера КПП к двигателю", "nm": "47 Н·м"},
        {"group": "Трансмиссия", "part": "Болты кожуха сцепления к маховику", "nm": "20 Н·м"},
        {"group": "Ходовая часть", "part": "Гайки крепления колес", "nm": "90 Н·м"},
        {"group": "Ходовая часть", "part": "Гайка передней ступицы / задней ступицы", "nm": "290 Н·м / 235 Н·м"},
        {"group": "Ходовая часть", "part": "Стяжной болт стойки с кулаком / шаровой опоры", "nm": "85 Н·м / 48 Н·м"},
        {"group": "Рулевое управление", "part": "Гайка наконечника рулевой тяги / тяга к рейке", "nm": "48 Н·м / 110 Н·м"},
        {"group": "Тормозная система", "part": "Пальцы переднего суппорта / скоба к кулаку", "nm": "28 Н·м / 70 Н·м"},
        {"group": "Электрооборудование", "part": "Свечи зажигания / датчик кислорода (лямбда)", "nm": "15 Н·м / 42 Н·м"}
    ],
    "lamps": [
        {"light": "Дальний / ближний свет головной фары", "type": "H4", "watts": "60/55 Вт"},
        {"light": "Противотуманная фара (передняя)", "type": "H11", "watts": "55 Вт"},
        {"light": "Габаритные огни, боковой повторитель, плафоны салона и багажника", "type": "W5W", "watts": "5 Вт"},
        {"light": "Передний указатель поворота, задний ПТФ, свет заднего хода", "type": "P21W", "watts": "21 Вт"},
        {"light": "Задний указатель поворота (оранжевая колба)", "type": "PY21W", "watts": "21 Вт"},
        {"light": "Стоп-сигнал и габарит заднего фонаря", "type": "P21/5W", "watts": "21/5 Вт"},
        {"light": "Дополнительный верхний стоп-сигнал", "type": "W16W", "watts": "16 Вт"},
        {"light": "Фонарь освещения номерного знака", "type": "ZW5", "watts": "5 Вт"}
    ],
    "maintenance": [
        {"item": "Масло в двигателе и масляный фильтр", "km20": "Замена", "km40": "Замена", "km60": "Замена", "km80": "Замена", "km100": "Замена", "km120": "Замена", "page": 105},
        {"item": "Воздушный фильтр и топливный фильтр", "km20": "Замена", "km40": "Замена", "km60": "Замена", "km80": "Замена", "km100": "Замена", "km120": "Замена", "page": 123},
        {"item": "Тормозная жидкость и рабочая жидкость трансмиссии", "km20": "Проверка", "km40": "Замена", "km60": "Проверка", "km80": "Замена", "km100": "Проверка", "km120": "Замена", "page": 190},
        {"item": "Ремень привода ГРМ (Duratec 1.4 / 1.6 — по разделу 5)", "km20": "Проверка", "km40": "Проверка", "km60": "Замена*", "km80": "Проверка", "km100": "Проверка", "km120": "Замена", "page": 73},
        {"item": "Ремни привода навесных агрегатов и насоса ГУР", "km20": "Проверка", "km40": "Проверка", "km60": "Проверка", "km80": "Проверка", "km100": "Проверка", "km120": "Замена", "page": 69},
        {"item": "Колодки, диски, барабаны, шланги и стояночный тормоз", "km20": "Проверка", "km40": "Проверка", "km60": "Проверка", "km80": "Проверка", "km100": "Проверка", "km120": "Проверка", "page": 188},
        {"item": "Свечи зажигания, АКБ, свет фар, подвеска и углы колес", "km20": "Проверка", "km40": "Проверка", "km60": "Проверка", "km80": "Проверка", "km100": "Проверка", "km120": "Проверка", "page": 227}
    ],
    "sections": sections,
    "wiringDiagrams": wiring_diagrams,
    "dtcCodes": dtc_list
}

with open(os.path.join(DATA_DIR, "manual_index.json"), "w", encoding="utf-8") as f:
    json.dump(REFERENCE_DATA, f, ensure_ascii=False, indent=2)


# Build lightweight full-text search index of all 385 PDF pages
pages_index = []
for i in range(len(doc)):
    raw_txt = doc[i].get_text()
    # Clean hyphenated line breaks ("газораспре-\nделительного" -> "газораспределительного")
    clean_txt = re.sub(r"-\s*\n\s*", "", raw_txt)
    clean_txt = re.sub(r"\s+", " ", clean_txt).strip()
    pages_index.append({
        "pdfPage": i + 1,
        "bookPage": i if i >= 1 else 0,
        "text": clean_txt
    })

with open(os.path.join(DATA_DIR, "pages_text.json"), "w", encoding="utf-8") as f:
    json.dump(pages_index, f, ensure_ascii=False)

print("Built data/guides.json, data/manual_index.json, and data/pages_text.json successfully!")
