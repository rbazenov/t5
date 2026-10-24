#!/usr/bin/env python3
import sys
import pymupdf

pdf_path = sys.argv[1]
page_num = int(sys.argv[2])
dpi = int(sys.argv[3])
out_path = sys.argv[4]

doc = pymupdf.open(pdf_path)
if page_num < 1 or page_num > len(doc):
    sys.exit(2)
pix = doc[page_num - 1].get_pixmap(dpi=dpi)
pix.save(out_path)
