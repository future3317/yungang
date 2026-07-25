"""Capture the React game shell at all required review viewports."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audit_output"
OUT.mkdir(exist_ok=True)
BASE_URL = os.environ.get("AUDIT_BASE_URL", "http://127.0.0.1:8010")
VIEWPORTS = [{"name":"desktop_1920","width":1920,"height":1080},{"name":"desktop_1440","width":1440,"height":900},{"name":"desktop_1280","width":1280,"height":800},{"name":"tablet_768","width":768,"height":1024},{"name":"mobile_390","width":390,"height":844}]
SELECTORS = {"map":".network-frame","actions":".action-groups","site":".site-node","mission":".mission-panel","header":".game-header"}

def measure(page):
    return page.evaluate("""selectors => { const result = {}; for (const [key, selector] of Object.entries(selectors)) { const element = document.querySelector(selector); result[key] = element ? (() => { const box = element.getBoundingClientRect(); return { width: box.width, height: box.height, top: box.top, left: box.left }; })() : null; } result.viewport = { width: innerWidth, height: innerHeight }; return result; }""", SELECTORS)

def main():
    metrics = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for viewport in VIEWPORTS:
            context = browser.new_context(viewport={"width":viewport["width"],"height":viewport["height"]})
            page = context.new_page()
            session = f"audit-{viewport['name']}"
            page.request.post(f"{BASE_URL}/api/games/{session}")
            page.goto(f"{BASE_URL}/game/{session}")
            page.wait_for_selector(SELECTORS["map"], timeout=10000)
            page.wait_for_selector(SELECTORS["site"], timeout=10000)
            page.screenshot(path=str(OUT / f"{viewport['name']}.png"), full_page=True)
            metrics[viewport["name"]] = measure(page)
            context.close()
        browser.close()
    (OUT / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved screenshots and metrics to {OUT}")

if __name__ == "__main__": main()

