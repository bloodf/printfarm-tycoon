"""Mouse-only playthrough (M1.1 acceptance "a complete day with zero key presses", extended for M2).

Every game action is done with the mouse: clicking objects in the 3D view (projected from their world position), the
action popover, the toolbar, the laptop apps and the packing station. The harness only skips game time (to save
wall-clock time), reads state to verify, and, for M2, forces the random events it needs to test (a printer error, a
power outage, an internet outage) through window.__qa instead of waiting for the dice. A keydown counter in the page
proves no keyboard input happened.

M2 coverage: no avatar (camera-only game), drying a damp spool in the filament dryer, fixing a printer error
(E302 fan failure → spare part → timed fix → print resumes), lights-out power outage, internet outage (Shop offline).

    python3 tools/qa/playthrough_click.py [low|high]
"""
import os
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

Q = next((a for a in sys.argv[1:] if a in ("low", "medium", "high", "ultra")), "low")
OUT = Path("docs/qa/playthrough_click")
OUT.mkdir(parents=True, exist_ok=True)
for f in list(OUT.glob("*.jpg")) + list(OUT.glob("*.png")):
    f.unlink()
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name} {detail}", flush=True)


with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                                "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.set_default_timeout(300000)
    errs = []
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"PAGEERROR: {e}"))
    n = [0]

    def ev(js):
        return pg.evaluate(js)

    def wait_until(js, timeout=60):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if ev(f"(()=>{{const g=window.__pft.useGame.getState(); const s=g.sim; return !!({js})}})()"):
                return True
            pg.wait_for_timeout(400)
        return False

    def shot(name, settle=1500):
        pg.wait_for_timeout(settle)
        n[0] += 1
        pg.screenshot(path=str(OUT / f"{n[0]:02d}_{name}.jpg"), type="jpeg", quality=86)
        print(f"[{n[0]:02d}] {name}", flush=True)

    def click_object(uid, frame=None):
        """Point at an object in the 3D view until it is hovered, then click it → popover."""
        if ev("!!window.__pft.useGame.getState().popover"):
            pg.locator(".popover button[aria-label='Close']").first.click()
            wait_until("!g.popover", 10)
        if frame:
            yaw = f",{frame[4]}" if len(frame) > 4 else ""
            ev(f"window.__qa.orbitTo({frame[0]},{frame[1]},{frame[2]},{frame[3]}{yaw})")
        wait_until("window.__qa.orbitSettled()", 30)
        for attempt in range(8):
            pos = ev(f"window.__qa.screenPos('{uid}')")
            if not pos:
                pg.wait_for_timeout(800)
                continue
            pg.mouse.move(pos[0] + attempt * 4, pos[1] + attempt * 3)
            if wait_until(f"g.hover && g.hover.uid.startsWith('{uid}')", 25):
                pg.mouse.click(pos[0] + attempt * 4, pos[1] + attempt * 3)
                if wait_until(f"g.popover && g.popover.uid.startsWith('{uid}')", 25):
                    wait_until("window.__qa.orbitSettled()", 20)
                    return True
            print(f"   retry {uid}: hover={ev('window.__qa.state().hover')}", flush=True)
        return False

    def popover_action(label, until_js=None, timeout=40):
        btn = pg.locator(".popover .pop-btn", has_text=label).first
        if not btn.count():
            print("   popover buttons:", pg.locator(".popover .pop-btn").all_inner_texts())
            return False
        btn.click()
        return wait_until(until_js, timeout) if until_js else True

    def toolbar(label):
        pg.locator(".toolbar .tb-btn", has_text=label).first.click()

    pg.add_init_script("window.__keys = 0; window.addEventListener('keydown', () => window.__keys++, true)")
    pg.goto(f"{os.environ.get('PFT_URL', 'http://127.0.0.1:5173')}/?quality={Q}")
    check("boot", wait_until("document.querySelector('.boot-start.pulse')", 180))
    pg.mouse.click(640, 360)
    check("menu", wait_until("g.screen === 'menu'", 30))
    shot("menu", 2500)
    pg.get_by_text("New game").click()
    check("new game", wait_until("g.screen === 'game'", 30))
    check("no avatar / first-person mode in the build", ev("!document.querySelector('.crosshair') && !document.querySelector('.menu-mode') && !/\"mode\"/.test(localStorage.getItem('pft.settings.v1') || '')"))
    shot("start_overview", 4000)

    # ------------------------------------------------------------ laptop via the toolbar
    toolbar("Laptop")
    check("toolbar → laptop", wait_until("g.overlay === 'laptop'", 20))
    pg.locator(".mail-item").nth(1).click()
    check("read mail (goal 1)", wait_until("s.goalsDone.includes('read_mail')", 20))
    pg.locator(".os-app", has_text="Slicer").click()
    pg.wait_for_timeout(2500)
    pg.get_by_role("button", name="Save to USB").click()
    check("slice → USB", wait_until("s.printers[0].status === 'waiting_usb'", 20))
    pg.locator(".os-top button[title='Close (Esc)']").click()
    check("close laptop with the mouse", wait_until("g.overlay === null", 20))

    # ------------------------------------------------------------ printer: click → popover → start
    pr = ev("window.__qa.printerPos(0)")
    check("click printer → popover", click_object("printer:", (pr[0], pr[1] + 0.25, pr[2], 1.4)))
    shot("printer_popover", 1500)
    check("start print from the popover", popover_action("Start print from USB", "s.printers[0].status === 'heating' || s.printers[0].status === 'printing'"))
    toolbar("8×")
    check("toolbar fast-forward", wait_until("g.fastForward", 10))
    shot("printing_fastforward", 2500)
    toolbar("1×")

    # ------------------------------------------------------------ M2: a printer error mid-print, fixed with a spare part
    check("force E302 fan failure (harness)", ev("window.__qa.forceError(0, 'E302')"))
    check("printer in error state", wait_until("s.printers[0].status === 'error' && s.printers[0].error.code === 'E302'", 20))
    check("error toast shown", wait_until("g.toasts.some(t => t.title.includes('E302'))", 20))
    check("click the erroring printer", click_object("printer:"))
    shot("error_popover", 1500)
    check("fix needs a spare fan (disabled, none in stock)", pg.locator(".popover .pop-btn.disabled", has_text="Fix E302").count() == 1)
    ev("window.__pft.useGame.getState().sim.parts.fan = 1; window.__pft.useGame.getState().bump()")  # harness: the spare arrives
    pg.wait_for_timeout(1500)
    check("timed fix → print resumes", popover_action("Fix E302", "s.printers[0].status === 'printing' && !s.printers[0].error && s.parts.fan === 0", 60))

    # ------------------------------------------------------------ M2: dry the damp blue spool
    blue = ev("window.__pft.useGame.getState().sim.spools.find(x => x.color === 'blue').id")
    m0 = ev(f"window.__pft.useGame.getState().sim.spools.find(x => x.id === '{blue}').moisture")
    sp = ev(f"window.__qa.where('spool:{blue}')")
    check("click the damp blue spool on the shelf", click_object(f"spool:{blue}", (sp[0], sp[1], sp[2], 1.1, 1.5708)) if sp else False, f"moisture {m0:.2f}")
    check("take it", popover_action("Take spool", "s.held && s.held.kind === 'spool'"))
    dr = ev("window.__qa.where('dryer:')")
    check("click the filament dryer", click_object("dryer:", (dr[0], dr[1], dr[2], 1.3)) if dr else False)
    shot("dryer_popover", 1200)
    check("put it in the dryer", popover_action("Dry Blue PLA", f"s.spools.find(x => x.id === '{blue}').loc.t === 'dryer'"))
    shot("dryer_loaded", 2000)
    for _ in range(40):
        if ev("window.__pft.useGame.getState().sim.printers[0].status") == "done":
            break
        ev("window.__qa.skip(10)")
        pg.wait_for_timeout(200)
    check("print finished", wait_until("s.printers[0].status === 'done'", 10))
    check("click printer again", click_object("printer:", (pr[0], pr[1] + 0.25, pr[2], 1.4)))
    shot("remove_popover", 1500)
    check("timed 'Remove print' button", popover_action("Remove print", "s.held && s.held.kind === 'item'"))
    shot("holding_print", 1500)

    # ------------------------------------------------------------ packing
    pk = ev("window.__qa.where('packing')")
    check("click packing table", click_object("packing", (pk[0] - 0.4, pk[1], pk[2], 1.6)))
    check("place the print on the table", popover_action("Place print on the table", "s.items.some(i => i.loc.t === 'table')"))
    check("click packing table again", click_object("packing"))
    check("open the packing station", popover_action("Use packing station", "g.overlay === 'packing'"))
    pg.get_by_role("button", name="Looks good → choose box").click()
    pg.get_by_role("button", name="Fold box & put the print in").click()
    pg.get_by_role("button", name="Add kraft paper (10 left)").click()
    pg.get_by_role("button", name="Close the flaps").click()
    tb = pg.locator(".tape-btn").bounding_box()
    pg.mouse.move(tb["x"] + 60, tb["y"] + 20)
    pg.mouse.down()
    pg.wait_for_timeout(1600)
    pg.mouse.up()
    pg.get_by_role("button", name="Print shipping label").click()
    check("packed (mouse only)", wait_until("s.items.some(i => i.kind === 'box')", 20))
    shot("packed", 2000)
    pg.get_by_role("button", name="Done").click()
    wait_until("g.overlay === null", 20)
    check("click the packed parcel", click_object("packed:", (pk[0] - 0.4, pk[1], pk[2], 1.6)))
    check("pick up the parcel", popover_action("Pick up box", "s.held && s.held.kind === 'item'"))
    ob = ev("window.__qa.where('outbox')")
    check("click the outbox", click_object("outbox", (ob[0] - 0.3, ob[1], ob[2], 1.8, -1.5708)))
    check("parcel in the outbox", popover_action("Place parcel in the Outbox", "s.items.some(i => i.loc.t === 'outbox')"))
    shot("outbox", 1500)

    # ------------------------------------------------------------ M2: dried spool comes out
    for _ in range(30):
        if ev(f"window.__pft.useGame.getState().sim.spools.find(x => x.id === '{blue}').moisture") < 0.05:
            break
        ev("window.__qa.skip(10)")
        pg.wait_for_timeout(100)
    check("spool dried below 5% + goal", wait_until(f"s.spools.find(x => x.id === '{blue}').moisture < 0.05 && s.goalsDone.includes('dry')", 10))
    check("click the dryer", click_object("dryer:", (dr[0], dr[1], dr[2], 1.3)))
    check("take the dry spool out", popover_action("Take out Blue PLA", "s.held && s.held.kind === 'spool'"))
    sh = ev("window.__qa.where('shelf')")
    check("click the shelf", click_object("shelf", (sh[0], sh[1], sh[2], 1.8, 1.5708)))
    lbl = "Store Blue PLA" if pg.locator(".popover .pop-btn", has_text="Store Blue PLA").count() else "Put your spool on the shelf"
    check("store it", popover_action(lbl, f"s.spools.find(x => x.id === '{blue}').loc.t === 'shelf'"))

    # ------------------------------------------------------------ M2: lights out
    ev("window.__qa.orbitTo(0, 1.0, 0.3, 3.6)")
    ev("window.__qa.forceIncident('power_outage', 40)")
    toolbar("8×")
    check("power goes out", wait_until("!s.power", 60))
    toolbar("1×")
    check("outage banner", wait_until("document.querySelector('.outage') && document.querySelector('.outage').textContent.includes('POWER OUTAGE')", 20))
    shot("lights_out", 4000)
    ev("window.__qa.skip(41)")
    check("power back", wait_until("s.power", 20))
    shot("power_back", 4000)

    # ------------------------------------------------------------ M2: internet down → Shop offline
    ev("window.__qa.forceIncident('internet_outage', 60)")
    toolbar("8×")
    check("internet goes down", wait_until("!s.internet", 60))
    toolbar("1×")
    toolbar("Laptop")
    wait_until("g.overlay === 'laptop'", 20)
    pg.locator(".os-app", has_text="Shop").click()
    pg.wait_for_timeout(1500)
    check("Shop says offline", pg.get_by_text("Shop offline (internet down)").count() > 0)
    shot("internet_down_shop", 1500)
    pg.locator(".os-top button[title='Close (Esc)']").click()
    wait_until("g.overlay === null", 20)
    ev("window.__qa.skip(61)")
    check("internet back", wait_until("s.internet", 20))

    # ------------------------------------------------------------ shop with the mouse
    toolbar("Laptop")
    wait_until("g.overlay === 'laptop'", 20)
    pg.locator(".os-app", has_text="Shop").click()
    pg.locator(".spool-card", has_text="Orange").click()
    pg.get_by_role("button", name="Place order").click()
    check("bought filament in the Shop", wait_until("s.crates.length > 0", 20))
    pg.locator(".os-top button[title='Close (Esc)']").click()
    wait_until("g.overlay === null", 20)

    # ------------------------------------------------------------ courier, sleep, day 2, delivery
    for _ in range(40):
        if ev("window.__pft.useGame.getState().sim.time % 1440") >= 17 * 60 + 2:
            break
        ev("window.__qa.skip(30)")
        pg.wait_for_timeout(150)
    check("courier shipped + paid", wait_until("s.orders.some(o => o.status === 'shipped')", 10))
    hd = ev("window.__qa.where('housedoor')")
    check("click the house door", click_object("housedoor", (hd[0] + 1.0, 1.2, hd[2], 1.6)))
    check("end the day", popover_action("End the day", "g.overlay === 'report'"))
    shot("report", 2500)
    pg.get_by_role("button", name="Sleep → Day 2").click()
    check("day 2", wait_until("s.day === 2 && g.overlay === null", 30))
    ev("window.__qa.skip(35)")
    wait_until("s.crates.some(c => c.arrived && !c.opened)", 20)
    cr = ev("window.__qa.where('crate:')")
    check("click the delivery", click_object("crate:", (cr[0], 0.4, cr[2], 1.5)) if cr else False)
    check("timed unpack", popover_action("Open & unpack", "s.crates.every(c => c.opened)"))
    shot("day2", 2000)
    keys = ev("window.__keys")
    check("zero keyboard events (mouse only)", keys == 0, f"keydown events: {keys}")
    check("no console errors", not errs, json.dumps(errs[:5]))
    b.close()

passed = sum(1 for r in results if r[1])
print(f"\nRESULT {passed}/{len(results)} checks passed")
(OUT / "results.json").write_text(json.dumps([{"check": r[0], "pass": r[1], "detail": r[2]} for r in results], indent=1))
sys.exit(0 if passed == len(results) else 1)
