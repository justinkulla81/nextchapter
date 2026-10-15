"""Writes one sheet of an .xlsx workbook as CSV: xlsx_to_csv.py <in.xlsx> <out.csv> [sheet name].

Used by the import-occupations workflow to turn the BLS workbooks into the CSV that
scripts/import-occupations.ts reads. Cell text is kept as the workbook shows it, so
the "#" and "*" markers BLS uses for top-coded and withheld figures survive.
"""
import csv
import sys

from openpyxl import load_workbook

src, dest = sys.argv[1], sys.argv[2]
wb = load_workbook(src, read_only=True, data_only=True)
if len(sys.argv) > 3:
    names = [n for n in wb.sheetnames if n.strip().lower() == sys.argv[3].strip().lower()]
    if not names:
        sys.exit(f"No sheet named {sys.argv[3]!r} in {src}. Sheets: {wb.sheetnames}")
    ws = wb[names[0]]
else:
    ws = wb[wb.sheetnames[0]]

with open(dest, "w", newline="", encoding="utf-8") as f:
    out = csv.writer(f)
    for row in ws.iter_rows(values_only=True):
        out.writerow(["" if v is None else v for v in row])
print(f"{src} [{ws.title}] -> {dest}")
