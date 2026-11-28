import { useEffect, useMemo, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { Cpu, Gamepad2, Keyboard, Volume2 } from 'lucide-react'
import { useGame } from '../../game/store'
import { audio, PRELOAD_SOUNDS, sfx } from '../../game/audio'
import { ACTION_LABELS, keyLabel, useSettings, type ActionId, type Preset } from '../../game/settings'
import { TIPS } from '../../data/content'
import { money } from '../../game/format'
import { PRODUCTS } from '../../data/products'
import { Button, Modal, Seg, Slider, Stars, Toggle } from '../components/ui'

// --------------------------------------------------------------------------------------- boot / loading
export function BootScreen() {
  const { progress, active } = useProgress()
  const setScreen = useGame((g) => g.setScreen)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
  const [audioReady, setAudioReady] = useState(false)
  // latch: late texture loads (lightmaps, grunge) must not flip "ready" back off
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (progress >= 100 && !active) setDone(true)
  }, [progress, active])
  useEffect(() => {
    audio.preload(PRELOAD_SOUNDS).then(() => setAudioReady(true))
  }, [])
  const start = () => {
    if (!done) return
    audio.unlock()
    audio.preload(PRELOAD_SOUNDS)
    sfx.click()
    setScreen('menu')
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => done && e.code !== 'F5' && start()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  return (
    <div className="boot" onClick={start}>
      <div className="boot-inner anim-fade">
        <Logo />
        <div className="boot-bar">
          <div className="bar"><i style={{ width: `${Math.max(progress, 3)}%` }} /></div>
          <div className="row small muted" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span>{done ? (audioReady ? 'Ready' : 'Loading sounds…') : `Loading assets… ${Math.round(progress)}%`}</span>
            <span className="mono">M1 · garage vertical slice</span>
          </div>
        </div>
        <div className={`boot-start display ${done ? 'pulse' : ''}`} style={{ opacity: done ? 1 : 0 }}>
          Click or press any key to start
        </div>
        <div className="boot-tip small"><span className="upper accent">Tip</span>&nbsp;&nbsp;{tip}</div>
      </div>
    </div>
  )
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'small' : ''}`}>
      <div className="logo-mark">
        <svg viewBox="0 0 64 64" width="100%" height="100%">
          <defs>
            <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ffb15c" />
              <stop offset="1" stopColor="#ff6a00" />
            </linearGradient>
          </defs>
          <rect x="14" y="4" width="36" height="16" rx="3" fill="#2a313b" />
          <rect x="20" y="20" width="24" height="10" fill="#3a4350" />
          <path d="M24 30 h16 l-5 10 h-6 z" fill="url(#lg)" />
          <rect x="8" y="50" width="48" height="4" rx="2" fill="#ffb15c" opacity=".9" />
          <rect x="14" y="45" width="36" height="4" rx="2" fill="#ff8c33" opacity=".8" />
          <rect x="20" y="40" width="24" height="4" rx="2" fill="#ff6a00" opacity=".7" />
        </svg>
      </div>
      <div>
        <div className="logo-title display">PRINTFARM</div>
        <div className="logo-sub display">TYCOON</div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------------------- main menu
export function MainMenu() {
  const g = useGame()
  const [confirmNew, setConfirmNew] = useState(false)
  const [settings, setSettings] = useState(false)
  const [credits, setCredits] = useState(false)
  const save = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('pft.save.v1') || 'null')
      return raw ? { day: raw.sim.day as number, money: raw.sim.money as number, rep: raw.sim.reputation as number, printers: raw.sim.printers.length as number, at: raw.savedAt as number } : null
    } catch {
      return null
    }
  }, [g.screen]) // eslint-disable-line react-hooks/exhaustive-deps
  const startNew = () => {
    audio.unlock()
    g.newGame()
  }
  return (
    <div className="menu">
      <div className="menu-left anim-rise">
        <Logo />
        <div className="menu-tag">From a single printer in your garage to a humming print-farm empire.</div>
        <div className="menu-buttons">
          {save && (
            <Button variant="primary" size="lg" block onClick={() => { audio.unlock(); g.continueGame() }}>
              <Gamepad2 size={20} /> Continue
              <span className="menu-save">Day {save.day} · {money(save.money, false)}</span>
            </Button>
          )}
          <Button variant={save ? undefined : 'primary'} size="lg" block onClick={() => (save ? setConfirmNew(true) : startNew())}>New game</Button>
          <Button size="lg" block onClick={() => setSettings(true)}>Settings</Button>
          <Button size="lg" block variant="ghost" onClick={() => setCredits(true)}>Credits</Button>
        </div>
        {save && (
          <div className="menu-savecard glass small">
            <div className="upper muted">Last save</div>
            <div className="row" style={{ marginTop: 6 }}>
              <b className="display" style={{ fontSize: 18 }}>The Garage · Day {save.day}</b>
              <span className="spacer" />
              <Stars value={save.rep} size={13} />
            </div>
            <div className="muted">{save.printers} printer{save.printers > 1 ? 's' : ''} · {money(save.money)} · {new Date(save.at).toLocaleString()}</div>
          </div>
        )}
      </div>
      <div className="menu-foot small muted">v0.1 · M1 Garage vertical slice · Three.js r187 · React 19</div>
      {confirmNew && (
        <Modal onBackdrop={() => setConfirmNew(false)}>
          <h2>Start a new game?</h2>
          <p className="muted">Your current save (Day {save?.day}) will be overwritten when the new game saves.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConfirmNew(false)}>Cancel</Button>
            <Button variant="primary" onClick={startNew}>Start fresh</Button>
          </div>
        </Modal>
      )}
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      {credits && <Credits onClose={() => setCredits(false)} />}
    </div>
  )
}

export function Credits({ onClose }: { onClose: () => void }) {
  return (
    <Modal onBackdrop={onClose}>
      <h1>Credits</h1>
      <p className="muted">PrintFarm Tycoon is a two-person studio project.</p>
      <div className="credits-grid">
        <div><div className="upper muted">Director / Producer</div><b>You</b></div>
        <div><div className="upper muted">Development, art, audio, UI</div><b>Claude</b></div>
        <div><div className="upper muted">Engine</div>Three.js · React Three Fiber · postprocessing · N8AO</div>
        <div><div className="upper muted">Assets</div>Every model, texture and sound is generated by code: Blender 5 (bpy), NumPy/SciPy synthesis</div>
        <div><div className="upper muted">Printers modelled after</div>Creality Ender-3 V3 SE · Prusa MK4 · Bambu Lab P1S (parody names)</div>
        <div><div className="upper muted">Fonts</div>Rajdhani · Inter · JetBrains Mono (OFL)</div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
        <Button variant="primary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}

// --------------------------------------------------------------------------------------- pause
export function PauseMenu() {
  const g = useGame()
  const [settings, setSettings] = useState(false)
  const resume = () => g.close()
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !settings) resume()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  return (
    <div className="backdrop">
      <div className="pause anim-rise">
        <Logo small />
        <div className="upper muted" style={{ marginTop: 18 }}>Paused · Day {g.sim.day}</div>
        <div className="col" style={{ marginTop: 12, width: 300 }}>
          <Button variant="primary" size="lg" block onClick={resume}>Resume</Button>
          <Button size="lg" block onClick={() => g.save()}>Save game</Button>
          <Button size="lg" block onClick={() => setSettings(true)}>Settings</Button>
          <Button size="lg" block variant="ghost" onClick={() => { g.save(true); g.quitToMenu() }}>Save & quit to menu</Button>
        </div>
        <ControlsCheatSheet />
      </div>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </div>
  )
}

function ControlsCheatSheet() {
  const rows: [string, string][] = [['Left-drag', 'Rotate the view'], ['Right / middle-drag', 'Rotate / pan'], ['Wheel', 'Zoom'], ['Double-click floor', 'Move the view there'],
    ['Touch drag', 'Rotate the view'], ['Two fingers', 'Pan and pinch to zoom'],
    ['Click or tap object', 'Actions'], ['WASD (optional)', 'Pan'], ['Toolbar', 'Laptop · zoom · time · end day']]
  return (
    <div className="cheats glass small">
      {rows.map(([k, l]) => (<div key={k} className="row"><span className="keycap sm">{k}</span><span className="muted">{l}</span></div>))}
    </div>
  )
}

// --------------------------------------------------------------------------------------- settings
type Tab = 'graphics' | 'audio' | 'controls' | 'gameplay'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const [tab, setTab] = useState<Tab>('graphics')
  const [binding, setBinding] = useState<ActionId | null>(null)
  useEffect(() => {
    if (!binding) return
    const k = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code !== 'Escape') s.bind(binding, e.code)
      setBinding(null)
      sfx.toggle()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [binding, s])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.code === 'Escape' && !binding && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  const G = s.graphics
  const A = s.audio
  const C = s.controls
  return (
    <Modal className="settings" onBackdrop={onClose}>
      <div className="row">
        <h1>Settings</h1>
        <span className="spacer" />
        <Button variant="ghost" onClick={() => s.reset()}>Reset to defaults</Button>
      </div>
      <div className="settings-tabs">
        {([['graphics', <Cpu key="c" size={16} />, 'Graphics'], ['audio', <Volume2 key="v" size={16} />, 'Audio'], ['controls', <Keyboard key="k" size={16} />, 'Controls'], ['gameplay', <Gamepad2 key="g" size={16} />, 'Gameplay']] as const).map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => { sfx.toggle(); setTab(id) }}>{icon}{label}</button>
        ))}
      </div>
      <div className="settings-body">
        {tab === 'graphics' && (
          <>
            <SRow label="Quality preset" hint="Sets the options below">
              <Seg<Preset> value={G.preset} onChange={(p) => s.setPreset(p)} options={[{ id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }, { id: 'ultra', label: 'Ultra' }]} />
            </SRow>
            <SRow label="Shadows"><Toggle on={G.shadows} onChange={(v) => s.set('graphics', { shadows: v })} /></SRow>
            <SRow label="Ambient occlusion (N8AO)"><Toggle on={G.ssao} onChange={(v) => s.set('graphics', { ssao: v })} /></SRow>
            <SRow label="Bloom"><Toggle on={G.bloom} onChange={(v) => s.set('graphics', { bloom: v })} /></SRow>
            <SRow label="Resolution scale" hint={`${Math.round(G.resScale * 100)}%`}><Slider value={G.resScale} min={0.5} max={1.5} step={0.05} onChange={(v) => s.set('graphics', { resScale: v })} /></SRow>
            <SRow label="Show FPS counter"><Toggle on={G.showFps} onChange={(v) => s.set('graphics', { showFps: v })} /></SRow>
          </>
        )}
        {tab === 'audio' && (
          <>
            {(['master', 'music', 'sfx', 'ambience', 'ui'] as const).map((k) => (
              <SRow key={k} label={{ master: 'Master', music: 'Music (radio)', sfx: 'Sound effects', ambience: 'Ambience', ui: 'Interface' }[k]} hint={`${Math.round(A[k] * 100)}%`}>
                <Slider value={A[k]} onChange={(v) => s.set('audio', { [k]: v })} />
              </SRow>
            ))}
          </>
        )}
        {tab === 'controls' && (
          <>
            <SRow label="Camera drag sensitivity" hint={C.sensitivity.toFixed(2)}><Slider value={C.sensitivity} min={0.2} max={3} step={0.05} onChange={(v) => s.set('controls', { sensitivity: v })} /></SRow>
            <SRow label="Invert vertical drag"><Toggle on={C.invertY} onChange={(v) => s.set('controls', { invertY: v })} /></SRow>
            <SRow label="Camera field of view" hint={`${C.fov}°`}><Slider value={C.fov} min={40} max={80} step={1} onChange={(v) => s.set('controls', { fov: v })} /></SRow>
            <div className="upper muted" style={{ margin: '14px 0 6px' }}>Optional keyboard shortcuts · click to rebind (the game is fully playable with the mouse)</div>
            <div className="binds">
              {(Object.keys(ACTION_LABELS) as ActionId[]).map((a) => (
                <button key={a} className={`bind ${binding === a ? 'listening' : ''}`} onClick={() => { sfx.click(); setBinding(a) }}>
                  <span>{ACTION_LABELS[a]}</span>
                  <span className="keycap sm">{binding === a ? '…' : keyLabel(C.bindings[a])}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {tab === 'gameplay' && (
          <SRow label="Tutorial hints" hint="Show goal hints on the HUD"><Toggle on={s.gameplay.hints} onChange={(v) => s.set('gameplay', { hints: v })} /></SRow>
        )}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="primary" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  )
}

function SRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="srow">
      <div className="grow">
        <div>{label}</div>
        {hint && <div className="small muted">{hint}</div>}
      </div>
      <div className="srow-ctl">{children}</div>
    </div>
  )
}

// --------------------------------------------------------------------------------------- end of day
export function DayReport() {
  const g = useGame()
  const r = g.report
  if (!r) return null
  const s = g.sim
  const dayLedger = s.ledger.filter((l) => l.day === r.day)
  const byCat = new Map<string, number>()
  for (const l of dayLedger) byCat.set(l.category, (byCat.get(l.category) ?? 0) + l.amount)
  const net = dayLedger.reduce((a, l) => a + l.amount, 0)
  const shippedToday = s.orders.filter((o) => o.shippedDay === r.day)
  const repDelta = r.repEnd - r.repStart
  return (
    <div className="backdrop">
      <div className="report glass anim-rise">
        <div className="upper accent">End of day</div>
        <h1 className="display" style={{ fontSize: 44, margin: '2px 0 0' }}>Day {r.day} complete</h1>
        <div className="muted">The garage lights click off. Here's how today went.</div>
        <div className="report-stats">
          <Stat label="Parcels shipped" value={String(r.shipped)} />
          <Stat label="Prints finished" value={String(r.printsDone)} />
          <Stat label="Failures" value={String(r.failures)} tone={r.failures ? 'warn' : undefined} />
          <Stat label="Net today" value={money(net)} tone={net >= 0 ? 'ok' : 'danger'} />
        </div>
        <div className="report-cols">
          <div className="card">
            <div className="upper muted">Ledger</div>
            {[...byCat.entries()].length === 0 && <div className="muted small" style={{ marginTop: 8 }}>No transactions today.</div>}
            {[...byCat.entries()].map(([k, v]) => (
              <div key={k} className="row ledger-row"><span className="grow" style={{ textTransform: 'capitalize' }}>{k}</span><b className={v >= 0 ? 'ok' : 'danger'}>{money(v)}</b></div>
            ))}
            <div className="divider" />
            <div className="row ledger-row"><span className="grow">Balance</span><b className="display" style={{ fontSize: 20 }}>{money(s.money)}</b></div>
          </div>
          <div className="card">
            <div className="upper muted">Reputation</div>
            <div className="row" style={{ marginTop: 8 }}>
              <Stars value={s.reputation} size={22} />
              <b className="display" style={{ fontSize: 22 }}>{s.reputation.toFixed(2)}</b>
              <span className={repDelta >= 0 ? 'ok' : 'danger'}>{repDelta >= 0 ? '▲' : '▼'} {Math.abs(repDelta).toFixed(2)}</span>
            </div>
            <div className="upper muted" style={{ marginTop: 14 }}>Shipped today</div>
            {shippedToday.length === 0 && <div className="muted small">Nothing went out today.</div>}
            {shippedToday.slice(0, 6).map((o) => (
              <div key={o.id} className="row small" style={{ marginTop: 4 }}>
                <span className="mono dim">#{o.number}</span>
                <span className="grow ellipsis">{PRODUCTS[o.productId].name}</span>
                {o.late ? <span className="chip danger">late</span> : <span className="chip ok">on time</span>}
              </div>
            ))}
            <div className="small muted" style={{ marginTop: 10 }}>Reviews arrive tomorrow morning.</div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <span className="small muted">Printers keep running overnight. Watch out for failures!</span>
          <Button variant="primary" size="lg" onClick={() => g.startNextDay()}>Sleep → Day {r.day + 1}</Button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }) {
  return (
    <div className="stat card">
      <div className="upper muted">{label}</div>
      <div className={`display stat-v ${tone ?? ''}`}>{value}</div>
    </div>
  )
}
