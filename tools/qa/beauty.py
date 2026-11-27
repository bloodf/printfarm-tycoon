"""Beauty shots for art review (QA): the garage in M2 state: 7 printers mid-production (Ender, K1, MK4, P1S on the
bench; A1 + AMS lite and Snapmaker U1 on the print table; Prusa XL on its cart), dryers running, then a printer
error and a lights-out power cut. Camera poses are set through runtime.focus (the game has no avatar).

    python3 tools/qa/beauty.py [high|ultra|medium|low] [shot-name filters...]
Output: docs/qa/beauty/*.jpg
"""
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

Q = next((a for a in sys.argv[1:] if a in ("low", "medium", "high", "ultra")), "high")
ONLY = [a for a in sys.argv[1:] if a not in ("low", "medium", "high", "ultra")]  # optional shot-name filters
OUT = Path("docs/qa/beauty")
OUT.mkdir(parents=True, exist_ok=True)

SETUP = r"""
(() => {
  const g = window.__pft.useGame.getState(); const s = g.sim; const qa = window.__qa;
  s.money = 30000;
  const sp = (color, qty) => ({kind:'spool', material:'PLA', color, qty});
  const r = qa.run('buy', [
    {kind:'printer', printer:'a1', qty:1}, {kind:'printer', printer:'u1', qty:1}, {kind:'printer', printer:'xl', qty:1},
    {kind:'printer', printer:'k1', qty:1}, {kind:'printer', printer:'mk4', qty:1}, {kind:'printer', printer:'p1s', qty:1},
    sp('red', 2), sp('white', 2), sp('orange', 3), sp('yellow', 3), sp('green', 3), sp('black', 2),
    {kind:'upgrade', upgrade:'dryer', qty:2}]);
  if (!r.ok) return 'buy failed: ' + r.error;
  qa.run('sleepUntilMorning');
  s.incidents = []; s.power = true; s.internet = true;   // a calm day for the hero shots
  qa.skip(31);
  for (const c of s.crates) if (c.arrived && !c.opened) qa.run('openCrate', c.id);
  qa.skip(60 * 6);  // afternoon light
  const used = () => new Set(s.spools.filter(x => x.loc.t === 'shelf').map(x => x.loc.slot));
  const freeShelf = () => { const u = used(); let i = 0; while (u.has(i)) i++; return i; };
  const take = (color) => s.spools.find(x => x.loc.t === 'shelf' && x.color === color && x.material === 'PLA');
  const load = (p, colors) => {
    p.spools.forEach((sid, i) => { if (sid) { const o = s.spools.find(x => x.id === sid); o.loc = {t:'shelf', slot: freeShelf()}; p.spools[i] = null; } });
    colors.forEach((c, i) => { const x = take(c); if (!x) throw new Error('no ' + c); x.loc = {t:'printer', printerId: p.id, tool: i}; x.sealed = false; x.grams = 700; x.moisture = 0.03; p.spools[i] = x.id; });
  };
  const plan = {
    ender3v3: ['planter', ['black'], ['black'], 0.6, 'spaghetti'],
    k1: ['helmet', ['orange'], ['orange'], 0.45],
    mk4: ['vase', ['white'], ['white'], 0.55],
    p1s: ['gear', ['green'], ['green'], 0.7],
    a1: ['benchy_mc', ['red', 'white', 'blue', 'yellow'], ['red', 'white', 'blue'], 0.25],
    u1: ['dragon_mc', ['red', 'orange', 'yellow', 'green'], ['red', 'orange', 'yellow', 'green'], 0.55],
    xl: ['chestplate', ['grey', 'white', 'orange', 'yellow', 'green'], ['grey'], 0.4],
  };
  const out = [];
  s.printers.forEach((p, i) => {
    const [prod, loadC, colors, f, fail] = plan[p.modelId];
    p.status = 'idle'; p.job = null; p.bedItemId = null; p.error = null; p.fwPending = false;
    load(p, loadC);
    const o = {...s.orders[0], id: 'qa' + i, number: 3000 + i, productId: prod, color: colors[0], colors, material: 'PLA', status: 'new'};
    s.orders.push(o);
    const usb = p.modelId === 'ender3v3';
    const rr = qa.run('sendJob', o.id, p.id, 'standard', usb);
    if (usb) qa.run('startFromUsb', p.id);
    const j = p.job;
    out.push([p.modelId, p.slot, rr.ok ? 'ok' : rr.error]);
    if (!j) return;
    j.heatLeftMin = 0; p.status = 'printing'; j.failure = null; j.error = null;
    j.elapsedMin = j.durationMin * f;
    if (fail === 'spaghetti') { j.failure = {type: 'spaghetti', at: 0.12}; j.failed = true; j.stoppedAt = 0.12; j.spaghettiGrams = 22; }
  });
  // dryers: two black spools and the damp blue one's twin drying
  const blacks = s.spools.filter(x => x.loc.t === 'shelf' && x.color === 'black');
  s.dryers.forEach((d, di) => {
    const x = blacks[di]; if (!x) return;
    x.loc = {t:'dryer', dryerId: d.id, slot: 0}; x.sealed = false; x.moisture = 0.3; d.slots[0] = x.id;
  });
  g.bump();
  return out;
})()
"""

CAM = r"""
(([c, l]) => {
  const T = window.__pft.runtime; const V = [...T.printerPos.values()][0].constructor;
  T.focus = {pos: new V(c[0], c[1], c[2]), look: new V(l[0], l[1], l[2])};
})
"""

PRINTERS = r"""
(() => {
  const T = window.__pft.runtime; const s = window.__pft.useGame.getState().sim;
  return s.printers.map((p, i) => { const v = T.printerPos.get(p.id); const f = T.printerFacing.get(p.id);
    return {i, m: p.modelId, pos: v ? [v.x, v.y, v.z] : null, face: f ? [f.x, f.y, f.z] : [0, 0, 1]}; });
})()
"""


def closeup(pr, dist=0.78, up=0.42, side=0.2, look_up=0.2):
    (x, y, z), (fx, _, fz) = pr["pos"], pr["face"]
    sx, sz = -fz, fx  # perpendicular (to the printer's right)
    return (x + fx * dist + sx * side, y + up, z + fz * dist + sz * side), (x, y + look_up, z)


SHOTS = [
    # name, pose (fixed (cam, look) or ("printer", model, kwargs)), hide hud
    ("01_establishing", ((2.25, 1.75, 2.65), (-0.9, 0.85, -1.4)), True),
    ("02_workbench", ((0.0, 1.45, -1.45), (0.0, 1.05, -2.85)), True),
    ("03_print_table", ((0.95, 1.5, 0.95), (-0.55, 0.95, 0.7)), True),
    ("04_a1_ams", ("printer", "a1", {}), True),
    ("05_u1_toolchanger", ("printer", "u1", {}), True),
    ("06_xl", ("printer", "xl", dict(dist=1.25, up=0.6, side=0.3, look_up=0.35)), True),
    ("07_k1", ("printer", "k1", {}), True),
    ("08_dryer", ((1.95, 1.35, -2.25), (2.72, 0.98, -2.6)), True),
    ("09_gameplay_hud", ((0.6, 1.7, 1.9), (-0.4, 0.9, -0.6)), False),
]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1600, "height": 900})
    pg.set_default_timeout(600000)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"{os.environ.get('PFT_URL', 'http://127.0.0.1:5173')}/?quality={Q}")
    for _ in range(200):
        pg.wait_for_timeout(1000)
        if pg.locator(".boot-start.pulse").count():
            break
    pg.mouse.click(800, 450)
    pg.wait_for_timeout(2000)
    pg.get_by_text("New game").click()
    pg.wait_for_timeout(6000)
    print("setup:", pg.evaluate(SETUP), flush=True)
    pg.wait_for_timeout(15000)  # new printer models stream in
    prs = pg.evaluate(PRINTERS)
    print(prs, flush=True)

    def want(name):
        return not ONLY or any(o in name for o in ONLY)

    def shoot(name, pose, hide, settle=9000):
        t = time.time()
        pg.add_style_tag(content=".hud{display:%s !important}" % ("none" if hide else "block"))
        if pose[0] == "printer":
            pr = next(x for x in prs if x["m"] == pose[1])
            cam, look = closeup(pr, **pose[2])
        else:
            cam, look = pose
        pg.evaluate(CAM, [list(cam), list(look)])
        pg.wait_for_timeout(settle)
        pg.screenshot(path=str(OUT / f"{name}.jpg"), type="jpeg", quality=90)
        print(f"{name} {time.time() - t:.0f}s", pg.evaluate("window.__pft.runtime.stats"), flush=True)

    for name, pose, hide in SHOTS:
        if want(name):
            shoot(name, pose, hide)

    if want("10_farm"):  # Farm app with the live chamber cameras
        pg.evaluate("window.__pft.runtime.focus = null")
        pg.add_style_tag(content=".hud{display:block !important}")
        pg.evaluate("(()=>{const g=window.__pft.useGame.getState(); g.setLaptopApp('farm'); g.open('laptop')})()")
        pg.wait_for_timeout(25000)
        pg.screenshot(path=str(OUT / "10_farm_live_cam.jpg"), type="jpeg", quality=90)
        print("10_farm_live_cam", flush=True)
        pg.evaluate("window.__pft.useGame.getState().close()")
        pg.wait_for_timeout(3000)

    if want("11_error"):  # AMS tangle on the A1: error screen + toast
        a1 = next(x for x in prs if x["m"] == "a1")
        pg.add_style_tag(content=".hud{display:block !important}")
        cam, look = closeup(a1, dist=0.75, up=0.3, side=0.3, look_up=0.12)
        pg.evaluate(CAM, [list(cam), list(look)])
        pg.wait_for_timeout(12000)  # let the view settle (post-FX recompiles after the laptop closes)
        # at ~0.1–0.3 fps one frame can outlast the 6.5 s toast lifetime: extend toasts as they are created (harness only)
        pg.evaluate("window.__pft.useGame.subscribe(s => s.toasts.forEach(t => { if (!t.held) { t.held = true; t.born = Date.now() + 60000 } }))")
        ok = pg.evaluate(f"window.__qa.forceError({a1['i']}, 'E201')")
        print("forced E201:", ok, flush=True)
        for _ in range(40):         # wait for the game loop to raise the toast, then shoot before it expires
            if pg.evaluate("window.__pft.useGame.getState().toasts.some(t => t.title.includes('E201'))"):
                break
            pg.wait_for_timeout(500)
        # at ~0.3 fps the 6.5 s toast lifetime is shorter than a few frames: keep it up for the shot (harness only)
        pg.evaluate("window.__pft.useGame.getState().toasts.forEach(t => { t.born = Date.now() + 60000 })")
        for _ in range(30):         # React commits slowly at this frame rate: wait for the toast element itself
            if pg.evaluate("document.querySelectorAll('.toast').length > 0"):
                break
            pg.wait_for_timeout(1000)
        pg.wait_for_timeout(2000)
        print("toasts store/dom:", pg.evaluate("[window.__pft.useGame.getState().toasts.map(t => t.title), document.querySelectorAll('.toast').length]"), flush=True)
        pg.screenshot(path=str(OUT / "11_error_ams_tangle.jpg"), type="jpeg", quality=90)
        print("11_error_ams_tangle", flush=True)

    if want("12_slicer"):  # Slicer with a multicolour order mapped onto the A1's AMS slots
        a1 = next(x for x in prs if x["m"] == "a1")
        pg.evaluate(f"""(() => {{ const g = window.__pft.useGame.getState(); const s = g.sim; const p = s.printers[{a1['i']}];
          p.status = 'idle'; p.job = null; p.error = null; p.bedItemId = null;
          s.orders.push({{...s.orders[0], id: 'qa_mc', number: 4001, productId: 'benchy_mc', color: 'red', colors: ['red', 'white', 'blue'],
            material: 'PLA', status: 'new', price: 19.49}});
          g.bump(); g.setLaptopApp('slicer'); g.open('laptop'); }})()""")
        pg.wait_for_timeout(6000)
        pg.locator(".slicer-order", has_text="4001").first.click()
        pg.wait_for_timeout(3000)
        pg.locator(".printer-pick", has_text="A1").first.click()
        pg.wait_for_timeout(15000)
        pg.screenshot(path=str(OUT / "12_slicer_multicolour.jpg"), type="jpeg", quality=90)
        print("12_slicer_multicolour", flush=True)
        pg.evaluate("window.__pft.useGame.getState().close()")
        pg.wait_for_timeout(3000)

    if want("13_lights"):  # lights-out power cut, wide
        pg.evaluate("window.__qa.forceIncident('power_outage', 90); window.__qa.skip(2)")
        shoot("13_lights_out", ((2.25, 1.75, 2.65), (-0.9, 0.85, -1.4)), False, 12000)
    print("page errors:", errs[:5])
    b.close()
print("done")
