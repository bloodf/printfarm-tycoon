import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { sfx } from '../../game/audio'
import { keyLabel, useSettings, type ActionId } from '../../game/settings'
import { COLORS, type ColorId } from '../../data/filaments'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost'; size?: 'sm' | 'lg'; block?: boolean; silent?: boolean }

export function Button({ variant, size, block, silent, className = '', onClick, onMouseEnter, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={`btn ${variant ?? ''} ${size ?? ''} ${block ? 'block' : ''} ${className}`}
      onMouseEnter={(e) => {
        if (!rest.disabled) sfx.hover()
        onMouseEnter?.(e)
      }}
      onClick={(e) => {
        if (!silent) (variant === 'ghost' ? sfx.back : sfx.click)()
        onClick?.(e)
      }}
    >
      {children}
    </button>
  )
}

export function Key({ action, sm }: { action: ActionId; sm?: boolean }) {
  const code = useSettings((s) => s.controls.bindings[action])
  return <span className={`keycap ${sm ? 'sm' : ''}`}>{keyLabel(code)}</span>
}

export function Stars({ value, size = 15 }: { value: number; size?: number }) {
  const full = Math.round(value * 2) / 2
  return (
    <span className="stars" style={{ fontSize: size }} title={`${value.toFixed(2)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? '' : i - 0.5 === full ? '' : 'off'} style={i - 0.5 === full ? { opacity: 0.55 } : undefined}>
          ★
        </span>
      ))}
    </span>
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => {
        sfx.toggle()
        onChange(!on)
      }}
      aria-pressed={on}
    />
  )
}

export function Slider({ value, min = 0, max = 1, step = 0.01, onChange }: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return <input className="slider" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: ReactNode; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.id}
          className={value === o.id ? 'on' : ''}
          disabled={o.disabled}
          onMouseEnter={() => sfx.hover()}
          onClick={() => {
            sfx.toggle()
            onChange(o.id)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Bar({ value, tone }: { value: number; tone?: 'ok' | 'info' }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function Swatch({ color }: { color: ColorId }) {
  return <span className="swatch" style={{ background: COLORS[color].hex }} />
}

export function Modal({ children, className = '', onBackdrop }: { children: ReactNode; className?: string; onBackdrop?: () => void }) {
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onBackdrop?.()}>
      <div className={`modal glass ${className}`}>{children}</div>
    </div>
  )
}
