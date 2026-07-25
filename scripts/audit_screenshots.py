"""Capture layout audit screenshots for the v2 heritage network."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audit_output"
OUT.mkdir(exist_ok=True)
VIEWPORTS = [{"name":"desktop_1440","width":1440,"height":900},{"name":"tablet_768","width":768,"height":1024},{"name":"mobile_390","width":390,"height":844}]
SELECTORS = {"title":"h1","subtitle":"header > p:last-child","network":".network","actions":".actions","site":".site","debug":".debug"}

def measure(page):
    return page.evaluate("""selectors => { const r = {}; for (const [key, sel] of Object.entries(selectors)) { const el = document.querySelector(sel); r[key] = el ? (() => { const b = el.getBoundingClientRect(); return {width:b.width,height:b.height,top:b.top,left:b.left}; })() : null; } r.viewport={width:innerWidth,height:innerHeight}; return r; }""", SELECTORS)

def main():
    metrics = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for vp in VIEWPORTS:
            context = browser.new_context(viewport={"width":vp["width"],"height":vp["height"]})
            page = context.new_page()
            page.goto(f"http://127.0.0.1:8000/?game=audit-{vp['name']}")
            page.wait_for_selector(".network", timeout=10000)
            page.wait_for_selector(".actions button", timeout=10000)
            page.screenshot(path=str(OUT / f"{vp['name']}.png"), full_page=True)
            metrics[vp["name"]] = measure(page)
            context.close()
        browser.close()
    (OUT / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved screenshots and metrics to {OUT}")

if __name__ == "__main__":
    main()
