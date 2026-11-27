import { create } from 'zustand'

export type ActionId = 'forward' | 'back' | 'left' | 'right' | 'drop' | 'fastforward' | 'pause' | 'quicksave'

export const ACTION_LABELS: Record<ActionId, string> = {
  forward: 'Pan camera forward', back: 'Pan camera back', left: 'Pan camera left', right: 'Pan camera right',
  drop: 'Drop carried item', fastforward: 'Fast-forward time', pause: 'Pause menu / close popup', quicksave: 'Quick save',
}

export const DEFAULT_BINDINGS: Record<ActionId, string> = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', drop: 'KeyG', fastforward: 'KeyT', pause: 'Escape', quicksave: 'F5',
}

export type Preset = 'low' | 'medium' | 'high' | 'ultra'

export interface GraphicsSettings {
  preset: Preset
  shadows: boolean
  ssao: boolean
  bloom: boolean
  resScale: number
  showFps: boolean
}

export const PRESETS: Record<Preset, Omit<GraphicsSettings, 'preset' | 'showFps'>> = {
  low: { shadows: false, ssao: false, bloom: false, resScale: 0.75 },
  medium: { shadows: true, ssao: false, bloom: true, resScale: 1 },
  high: { shadows: true, ssao: true, bloom: true, resScale: 1 },
  ultra: { shadows: true, ssao: true, bloom: true, resScale: 1.5 },
}

export interface Settings {
  graphics: GraphicsSettings
  audio: { master: number; music: number; sfx: number; ambience: number; ui: number }
  controls: { sensitivity: number; invertY: boolean; fov: number; bindings: Record<ActionId, string> }
  gameplay: { hints: boolean }
}

const DEFAULTS: Settings = {
  graphics: { preset: 'high', ...PRESETS.high, showFps: false },
  audio: { master: 0.8, music: 0.45, sfx: 0.9, ambience: 0.7, ui: 0.7 },
  controls: { sensitivity: 1, invertY: false, fov: 55, bindings: { ...DEFAULT_BINDINGS } },
  gameplay: { hints: true },
}

const KEY = 'pft.settings.v1'

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!raw) return structuredClone(DEFAULTS)
    return {
      graphics: { ...DEFAULTS.graphics, ...raw.graphics },
      audio: { ...DEFAULTS.audio, ...raw.audio },
      controls: { ...DEFAULTS.controls, ...raw.controls, fov: raw.controls?.fov > 80 ? DEFAULTS.controls.fov : raw.controls?.fov ?? DEFAULTS.controls.fov,
        bindings: Object.fromEntries(Object.entries({ ...DEFAULT_BINDINGS, ...raw.controls?.bindings }).filter(([k]) => k in DEFAULT_BINDINGS)) as Record<ActionId, string> },
      gameplay: { ...DEFAULTS.gameplay, ...raw.gameplay },
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(section: K, patch: Partial<Settings[K]>) => void
  setPreset: (p: Preset) => void
  bind: (action: ActionId, code: string) => void
  reset: () => void
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  set: (section, patch) => {
    set({ [section]: { ...get()[section], ...patch } } as Partial<SettingsStore>)
    persist()
  },
  setPreset: (p) => {
    set({ graphics: { ...get().graphics, preset: p, ...PRESETS[p] } })
    persist()
  },
  bind: (action, code) => {
    const b = { ...get().controls.bindings }
    // swap if the key is already used
    const clash = (Object.keys(b) as ActionId[]).find((a) => b[a] === code)
    if (clash) b[clash] = b[action]
    b[action] = code
    set({ controls: { ...get().controls, bindings: b } })
    persist()
  },
  reset: () => {
    set(structuredClone(DEFAULTS))
    persist()
  },
}))

function persist() {
  const { graphics, audio, controls, gameplay } = useSettings.getState()
  localStorage.setItem(KEY, JSON.stringify({ graphics, audio, controls, gameplay }))
}

/** Apply URL overrides used by QA automation, e.g. ?quality=low */
export function applyUrlOverrides() {
  const params = new URLSearchParams(location.search)
  const q = params.get('quality') as Preset | null
  if (q && q in PRESETS) useSettings.setState({ graphics: { ...useSettings.getState().graphics, preset: q, ...PRESETS[q] } })

}

export const keyLabel = (code: string) =>
  code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'R-Shift')
    .replace('ControlLeft', 'Ctrl').replace('ControlRight', 'R-Ctrl').replace('Escape', 'Esc').replace('AltLeft', 'Alt')
    .replace('Space', 'Space').replace('Tab', 'Tab').replace('ArrowUp', '↑').replace('ArrowDown', '↓')
    .replace('ArrowLeft', '←').replace('ArrowRight', '→')
