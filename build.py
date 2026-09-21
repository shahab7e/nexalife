"""هر PDF داخل catalogs/ رو به تصاویر صفحه‌ای تبدیل می‌کنه.

چرا: رندر PDF داخل مرورگر (pdf.js) روی بعضی فایل‌های خروجی‌گرفته‌شده گیر می‌کنه،
و لود ۵ مگابایت PDF قبل از نمایش هم کنده. تصویرِ آماده هر دو مشکل رو حل می‌کنه.

اجرا:  pip install pypdfium2 pillow
       python build.py
"""

import json
import re
import shutil
import sys
from pathlib import Path

import pypdfium2 as pdfium

sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # کنسول ویندوز

ROOT = Path(__file__).parent
SRC = ROOT / "catalogs"
DST = ROOT / "pages"
TARGET_W = 1400  # عرض تصویر هر صفحه به پیکسل
QUALITY = 82


def slug(name, i):
    s = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower()
    return s or f"catalog-{i}"


def main():
    pdfs = sorted(SRC.glob("*.pdf"))
    if not pdfs:
        print(f"هیچ PDFی توی {SRC} نیست.")
        return

    manifest = []
    for i, pdf_path in enumerate(pdfs, start=1):
        name = pdf_path.stem.strip()
        cid = slug(name, i)
        out_dir = DST / cid
        if out_dir.exists():
            shutil.rmtree(out_dir)
        out_dir.mkdir(parents=True)

        pdf = pdfium.PdfDocument(pdf_path)
        page_w = page_h = None
        for n, page in enumerate(pdf, start=1):
            if page_w is None:
                page_w, page_h = page.get_width(), page.get_height()
            scale = TARGET_W / page.get_width()
            img = page.render(scale=scale).to_pil().convert("RGB")
            img.save(out_dir / f"{n:03d}.jpg", quality=QUALITY, optimize=True)

        # نسبت واقعیِ صفحه‌ی PDF (نه یه عدد ثابت) تا کاتالوگ‌های افقی و عمودی
        # هر کدوم با ابعاد خودشون نمایش داده بشن
        manifest.append(
            {"id": cid, "name": name, "pages": len(pdf), "ratio": round(page_w / page_h, 6)}
        )
        size_mb = sum(f.stat().st_size for f in out_dir.iterdir()) / 1e6
        print(f"{name}: {len(pdf)} صفحه -> {out_dir.name}/ ({size_mb:.1f} MB)")

    DST.mkdir(exist_ok=True)
    (DST / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nmanifest.json نوشته شد ({len(manifest)} کاتالوگ).")


if __name__ == "__main__":
    main()
