#!/usr/bin/env python3
"""Собирает таблицу поставщиков б/у запчастей VW T5 по отправленным письмам.

Данные соответствуют письмам из папки «Отправленные» Gmail
(аккаунт prodjectmen@gmail.com) за 24.10.2026, тема — запрос прайса
на б/у запчасти VW Transporter T5 / Caravella / Multivan.
"""

import csv
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# (время МСК, компания, e-mail, тема письма, примечание, id письма)
ROWS = [
    ("20:29:24", "VW-Parts.ru", "info@vw-parts.ru",
     "Запрос прайса: б/у запчасти VW Transporter T5 / Caravella / Multivan — отгрузка в Глазов",
     "Запрос с отгрузкой в Глазов", "1a16ef5ce1d32ad0"),
    ("20:29:40", "A2Z Parts Online", "info@a2zpartsonline.com",
     "Request for quotation: used VW Transporter T5 / Caravella / Multivan parts — delivery to Moscow",
     "Отправлено дважды: 20:29 и 20:35 (второе письмо — id 1a16efb7cdbbcd9d)", "1a16ef60c59fc6b0"),
    ("20:30:14", "Asghar (личный Gmail)", "asghar@gmail.com",
     "Request for quotation: used VW Transporter T5 / Caravella / Multivan parts — delivery to Moscow",
     "Личный адрес, название компании в переписке не указано", "1a16ef692551e9b4"),
    ("20:30:48", "Alsama LLC", "info@alsamallc.com",
     "Request for quotation: used VW Transporter T5 / Caravella / Multivan parts — delivery to Moscow",
     "Название по домену alsamallc.com", "1a16ef713d95576f"),
    ("20:31:05", "Mehdi (личный Gmail)", "mehdi@gmail.com",
     "Request for quotation: used VW Transporter T5 / Caravella / Multivan parts — delivery to Moscow",
     "Личный адрес, название компании в переписке не указано", "1a16ef75443e1b0e"),
    ("20:31:13", "Prince Juraat (личный Gmail)", "prince.juraat@gmail.com",
     "Request for quotation: used VW Transporter T5 / Caravella / Multivan parts — delivery to Moscow",
     "Личный адрес, название компании в переписке не указано", "1a16ef7740ea22ab"),
    ("20:31:21", "Ardh Al Falah", "sales@ardhalfalah.com",
     "Request for quotation: used VW Transporter T5 / Caravella / Multivan parts — delivery to Moscow",
     "Название по домену ardhalfalah.com", "1a16ef79443cb52c"),
    ("20:31:29", "A to Z Auto Spares", "info@atozautospares.com",
     "Request for quotation: used VW Transporter T5 / Caravella / Multivan parts — delivery to Moscow",
     "Название по домену atozautospares.com", "1a16ef7b53554302"),
    ("20:31:37", "Beta Auto Parts", "care@betaautoparts.com",
     "Request for quotation: used VW Transporter T5 / Caravella / Multivan parts — delivery to Moscow",
     "Название по домену betaautoparts.com", "1a16ef7d541669ca"),
    ("20:31:45", "CompanyAP", "info@companyap.com",
     "Request for quotation: used VW Transporter T5 / Caravella / Multivan parts — delivery to Moscow",
     "Название по домену companyap.com", "1a16ef7f4be542b3"),
    ("20:35:37", "A2Z Parts Online", "info@a2zpartsonline.com",
     "Request for quotation: used VW Transporter T5 / Caravella parts — a2zpartsonline.com",
     "Повторная отправка (первое письмо — 20:29)", "1a16efb7cdbbcd9d"),
    ("20:35:50", "GCE UAE", "info@gceuae.com",
     "Request for quotation: used VW Transporter T5 / Caravella parts — gceuae.com",
     "Название по домену gceuae.com", "1a16efbaec743c92"),
    ("20:38:49", "ASGT Co. LLC — Parts for Commercial Vehicles", "info@arabstar12.ae",
     "Request for quotation: used VW Transporter T5 / Caravella parts — ASGT Co. LLC — Parts for Commercial Vehicles",
     "", "1a16efe6a37588dc"),
    ("20:39:28", "German Parts / Astra Auto Parts (Дубай)", "sales@astraautoparts.com",
     "Request for quotation: used VW Transporter T5 / Caravella parts — German Parts / Astra Auto Parts (Дубай)",
     "В теме указан Дубай", "1a16eff046ddd3ec"),
    ("20:40:01", "HnD Automotive Parts", "helpdesk@hndautomotiveparts.com",
     "Request for quotation: used VW Transporter T5 / Caravella parts — HnD Automotive Parts",
     "", "1a16eff86f4e609c"),
    ("20:40:26", "Part Store Dubai", "sales@partstore.ae",
     "Request for quotation: used VW Transporter T5 / Caravella parts — Part Store Dubai",
     "Дубай", "1a16effe7ccabc2e"),
    ("20:47:28", "Всенаразборка (ТММ)", "trans-mmo@mail.ru",
     "Запрос прайса: б/у запчасти VW Transporter T5 / Caravella / Multivan — Всенаразборку (ТММ, разборка + склад б/у и новых запчастей)",
     "", "1a16f06552458b8f"),
    ("21:06:46", "Разборка «Лидер» (RAZBORLIDER)", "avtorazborka.lider@yandex.ru",
     "Запрос прайса: б/у запчасти VW Transporter T5 / Caravella / Multivan — Разборка «Лидер» (RAZBORLIDER)",
     "", "1a16f18025764e64"),
    ("21:07:15", "SI-Motors (Си-Моторс)", "motors2@udm.ru",
     "Запрос прайса: б/у запчасти VW Transporter T5 / Caravella / Multivan — SI-Motors (Си-Моторс)",
     "", "1a16f1872d88be26"),
    ("21:07:25", "Автомагазин «Европеец» (сеть «Иномарка18»)", "e901401@yandex.ru",
     "Запрос прайса: б/у запчасти VW Transporter T5 / Caravella / Multivan — Автомагазин «Европеец» (сеть «Иномарка18»)",
     "", "1a16f189d4eabed4"),
    ("21:20:35", "Братский Авто", "internetshop@bratskiy.ru",
     "Запрос прайса: б/у запчасти VW Transporter T5 / Caravella / Multivan — Братский Авто",
     "", "1a16f24a814a2e2a"),
]

SERVICE_ROWS = [
    ("20:24:06", "ТЕСТ (свой адрес)", "prodjectmen@gmail.com",
     "ТЕСТ: запрос прайса VW T5 (проверка отправки)",
     "Тестовое письмо себе, не поставщик", "1a16ef0f43779a7a"),
]

DATE = "24.10.2026"
HEADERS = ["№", "Компания", "E-mail", "Дата и время (МСК)", "Тема письма",
           "Ответ", "Примечание", "ID письма (Gmail)"]
WIDTHS = [5, 42, 32, 20, 62, 12, 46, 20]


def main_rows():
    out = []
    for i, (time, company, email, subject, note, mid) in enumerate(ROWS, start=1):
        out.append([i, company, email, f"{DATE} {time}", subject, "", note, mid])
    return out


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        w.writerow(HEADERS)
        w.writerows(rows)


def style_sheet(ws, rows, title, subtitle):
    ws.sheet_view.showGridLines = False
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(HEADERS))
    c = ws.cell(row=1, column=1, value=title)
    c.font = Font(bold=True, size=14)
    c.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[1].height = 26

    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(HEADERS))
    c = ws.cell(row=2, column=1, value=subtitle)
    c.font = Font(size=10, italic=True, color="555555")
    c.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[2].height = 18

    header_row = 4
    thin = Side(style="thin", color="D0D7DE")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    fill = PatternFill("solid", fgColor="1F4E79")

    for col, (head, width) in enumerate(zip(HEADERS, WIDTHS), start=1):
        cell = ws.cell(row=header_row, column=col, value=head)
        cell.font = Font(bold=True, color="FFFFFF", size=10)
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border
        ws.column_dimensions[get_column_letter(col)].width = width
    ws.row_dimensions[header_row].height = 30

    for r, row in enumerate(rows, start=header_row + 1):
        for col, value in enumerate(row, start=1):
            cell = ws.cell(row=r, column=col, value=value)
            cell.font = Font(size=10)
            cell.border = border
            cell.alignment = Alignment(
                vertical="top", wrap_text=col in (2, 5, 7),
                horizontal="center" if col in (1, 4, 6) else "left")
        if r % 2 == 0:
            for col in range(1, len(HEADERS) + 1):
                ws.cell(row=r, column=col).fill = PatternFill("solid", fgColor="F2F6FA")

    last = header_row + len(rows)
    ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(HEADERS))}{last}"
    ws.freeze_panes = f"A{header_row + 1}"


def write_xlsx(path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Поставщики"
    style_sheet(
        ws, main_rows(),
        "Поставщики б/у запчастей VW T5 / Caravella / Multivan",
        f"Запросы прайса, отправленные {DATE} · аккаунт prodjectmen@gmail.com · "
        f"компаний: {len(ROWS)} · писем: {len(ROWS) + 1} (A2Z Parts Online получил два письма)")

    ws2 = wb.create_sheet("Служебные")
    style_sheet(
        ws2, [[i, *r] for i, r in enumerate(SERVICE_ROWS, start=1)],
        "Служебные письма",
        "Технические отправки, не являющиеся запросами поставщикам")

    wb.save(path)


if __name__ == "__main__":
    write_csv("suppliers/vw-t5-suppliers.csv", main_rows())
    write_xlsx("suppliers/vw-t5-suppliers.xlsx")
    print("ok:", datetime.now().isoformat(timespec="seconds"), len(ROWS), "компаний")
