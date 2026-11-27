/**
 * Audio engine: Web Audio mixer with buses (master → music / sfx / ambience / ui),
 * one-shots and loops, optional 3D positioning (HRTF panner) driven by the camera listener.
 */
import { useSettings } from './settings'

export type Bus = 'music' | 'sfx' | 'ambience' | 'ui'
type Vec3 = [number, number, number]

export interface LoopHandle {
  setVolume(v: number, ramp?: number): void
  setRate(r: number): void
  setPosition(p: Vec3): void
  stop(fade?: number): void
}

const BASE = '/assets/audio/'

class AudioEngine {
  ctx: AudioContext | null = null
  private master!: GainNode
  private buses = {} as Record<Bus, GainNode>
  private buffers = new Map<string, AudioBuffer>()
  private loading = new Map<string, Promise<AudioBuffer | null>>()
  private lastPlay = new Map<string, number>()
  /** Loops requested before the AudioContext existed (autoplay policy); started on unlock. */
  private pending: (() => void)[] = []

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      for (const b of ['music', 'sfx', 'ambience', 'ui'] as Bus[]) {
        this.buses[b] = this.ctx.createGain()
        this.buses[b].connect(this.master)
      }
      this.applyVolumes()
      useSettings.subscribe(() => this.applyVolumes())
      const p = this.pending
      this.pending = []
      p.forEach((start) => start())
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  /** For QA: is the mixer running and how many sounds are decoded? */
  status() {
    return { state: this.ctx?.state ?? 'locked', decoded: this.buffers.size, pendingLoops: this.pending.length }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running'
  }

  applyVolumes() {
    if (!this.ctx) return
    const a = useSettings.getState().audio
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(a.master, t, 0.05)
    this.buses.music.gain.setTargetAtTime(a.music, t, 0.05)
    this.buses.sfx.gain.setTargetAtTime(a.sfx, t, 0.05)
    this.buses.ambience.gain.setTargetAtTime(a.ambience, t, 0.05)
    this.buses.ui.gain.setTargetAtTime(a.ui, t, 0.05)
  }

  load(name: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(name)) return Promise.resolve(this.buffers.get(name)!)
    if (!this.loading.has(name)) {
      const p = fetch(BASE + name + '.ogg')
        .then((r) => r.arrayBuffer())
        .then((ab) => (this.ctx ?? new OfflineAudioContext(1, 1, 44100)).decodeAudioData(ab))
        .then((buf) => {
          this.buffers.set(name, buf)
          return buf
        })
        .catch(() => null)
      this.loading.set(name, p)
    }
    return this.loading.get(name)!
  }

  preload(names: string[]) {
    return Promise.all(names.map((n) => this.load(n)))
  }

  private route(bus: Bus, volume: number, pos?: Vec3, ref = 1) {
    const ctx = this.ctx!
    const gain = ctx.createGain()
    gain.gain.value = volume
    let panner: PannerNode | null = null
    if (pos) {
      panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = ref
      panner.rolloffFactor = 1.3
      panner.maxDistance = 30
      panner.positionX.value = pos[0]
      panner.positionY.value = pos[1]
      panner.positionZ.value = pos[2]
      gain.connect(panner).connect(this.buses[bus])
    } else gain.connect(this.buses[bus])
    return { gain, panner }
  }

  /** Fire-and-forget one-shot. `throttle` (s) avoids machine-gunning the same sound. */
  play(name: string, o: { bus?: Bus; volume?: number; rate?: number; pos?: Vec3; ref?: number; throttle?: number; detune?: number } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return
    const now = this.ctx.currentTime
    if (o.throttle && now - (this.lastPlay.get(name) ?? -1e9) < o.throttle) return
    this.lastPlay.set(name, now)
    const buf = this.buffers.get(name)
    if (!buf) {
      this.load(name).then((b) => b && this.play(name, { ...o, throttle: 0 }))
      return
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = (o.rate ?? 1) * (o.detune ? 1 + (Math.random() - 0.5) * o.detune : 1)
    const { gain } = this.route(o.bus ?? 'sfx', o.volume ?? 1, o.pos, o.ref)
    src.connect(gain)
    src.start()
  }

  loop(name: string, o: { bus?: Bus; volume?: number; pos?: Vec3; ref?: number; rate?: number } = {}): LoopHandle {
    let src: AudioBufferSourceNode | null = null
    let nodes: { gain: GainNode; panner: PannerNode | null } | null = null
    let stopped = false
    let vol = o.volume ?? 1
    let rate = o.rate ?? 1
    let pos = o.pos
    const start = async () => {
      if (!this.ctx) {
        this.pending.push(() => void start())
        return
      }
      const buf = await this.load(name)
      if (!buf || stopped || !this.ctx) return
      nodes = this.route(o.bus ?? 'sfx', 0, pos, o.ref)
      src = this.ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.playbackRate.value = rate
      src.connect(nodes.gain)
      src.start(0, Math.random() * buf.duration)
      nodes.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.15)
    }
    start()
    return {
      setVolume: (v, ramp = 0.2) => {
        vol = v
        if (nodes && this.ctx) nodes.gain.gain.setTargetAtTime(v, this.ctx.currentTime, ramp)
      },
      setRate: (r) => {
        rate = r
        if (src && this.ctx) src.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.1)
      },
      setPosition: (p) => {
        pos = p
        if (nodes?.panner) {
          nodes.panner.positionX.value = p[0]
          nodes.panner.positionY.value = p[1]
          nodes.panner.positionZ.value = p[2]
        }
      },
      stop: (fadeS = 0.3) => {
        stopped = true
        if (nodes && src && this.ctx) {
          nodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fadeS / 3)
          const s = src
          setTimeout(() => s.stop(), fadeS * 1000 + 50)
        }
      },
    }
  }

  setListener(pos: Vec3, fwd: Vec3, up: Vec3 = [0, 1, 0]) {
    if (!this.ctx) return
    const l = this.ctx.listener
    if (l.positionX) {
      const t = this.ctx.currentTime
      l.positionX.setTargetAtTime(pos[0], t, 0.02)
      l.positionY.setTargetAtTime(pos[1], t, 0.02)
      l.positionZ.setTargetAtTime(pos[2], t, 0.02)
      l.forwardX.setTargetAtTime(fwd[0], t, 0.02)
      l.forwardY.setTargetAtTime(fwd[1], t, 0.02)
      l.forwardZ.setTargetAtTime(fwd[2], t, 0.02)
      l.upX.value = up[0]
      l.upY.value = up[1]
      l.upZ.value = up[2]
    }
  }
}

export const audio = new AudioEngine()

/** UI sound helpers */
export const sfx = {
  hover: () => audio.play('ui_hover', { bus: 'ui', throttle: 0.04 }),
  click: () => audio.play('ui_click', { bus: 'ui' }),
  back: () => audio.play('ui_back', { bus: 'ui' }),
  toggle: () => audio.play('ui_toggle', { bus: 'ui' }),
  error: () => audio.play('ui_error', { bus: 'ui', throttle: 0.2 }),
}

export const PRELOAD_SOUNDS = [
  'ui_hover', 'ui_click', 'ui_back', 'ui_toggle', 'ui_error', 'notif_mail', 'notif_order', 'cash', 'laptop_open',
  'printer_steppers_loop', 'printer_fan_loop', 'printer_done', 'printer_alarm', 'printer_home', 'printer_beep',
  'bed_flex_pop', 'spaghetti_rip', 'spool_swap', 'box_fold', 'tape_rip', 'paper_crinkle', 'label_print', 'box_place', 'item_pickup',
  'item_place', 'door_open', 'courier_van', 'room_tone_loop', 'music_lofi_loop',
  'power_down', 'power_up', 'dryer_hum_loop', 'ams_feed', 'toolchange', 'error_alarm', 'rain_loop',
]
