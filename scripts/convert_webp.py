"""Convert UI assets PNG to WebP and report sizes."""
from pathlib import Path
from PIL import Image

ASSETS = Path("frontend/static/ui-assets")

pngs = sorted(ASSETS.glob("*.png"))
if not pngs:
    print("No PNG assets found.")
    raise SystemExit

total_before = 0
total_after = 0

for png in pngs:
    # Skip orig variants; keep them as backups for now
    if "_orig" in png.stem:
        continue
    webp = png.with_suffix(".webp")
    img = Image.open(png)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")
    # Quality 85 balances quality and size; PNG with transparency -> WebP lossy with alpha
    img.save(webp, "WEBP", quality=85, method=6)
    before = png.stat().st_size
    after = webp.stat().st_size
    total_before += before
    total_after += after
    print(f"{png.name:42} {before/1024:6.1f} KB -> {webp.name:42} {after/1024:6.1f} KB ({after/before*100:5.1f}%)")

print(f"\nTotal referenced PNG: {total_before/1024/1024:.2f} MB")
print(f"Total WebP:           {total_after/1024/1024:.2f} MB")
print(f"Reduction:            {(1 - total_after/total_before)*100:.1f}%")
