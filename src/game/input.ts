/**
 * Input manager: keyboard state mapped to rebindable actions (optional camera pan + hotkeys).
 * The game is fully playable with the mouse alone (decision D11); the keyboard only adds shortcuts.
 */
import { useSettings, type ActionId } from './settings'

const down = new Set<string>()
const pressedQueue = new Set<string>()
let enabled = false

export const input = {
  /** Is the action's key held right now? */
  held(a: ActionId) {
    return enabled && down.has(useSettings.getState().controls.bindings[a])
  },
  /** Was the action pressed since the last frame? (consumes) */
  pressed(a: ActionId) {
    const code = useSettings.getState().controls.bindings[a]
    if (pressedQueue.has(code)) {
      pressedQueue.delete(code)
      return enabled
    }
    return false
  },
  setEnabled(v: boolean) {
    if (v && !enabled) pressedQueue.clear() // keys pressed while a UI was open must not leak into the game
    enabled = v
    if (!v) {
      down.clear()
      pressedQueue.clear()
    }
  },
  get enabled() {
    return enabled
  },
  debug() {
    return { down: [...down], queue: [...pressedQueue], enabled }
  },
  /** For QA automation */
  inject(code: string, isDown: boolean) {
    if (isDown) {
      if (!down.has(code)) pressedQueue.add(code)
      down.add(code)
    } else down.delete(code)
  },
}

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return
  if (!down.has(e.code) && enabled) pressedQueue.add(e.code)
  down.add(e.code)
  if (enabled && ['F5'].includes(e.code)) e.preventDefault()
})
window.addEventListener('keyup', (e) => down.delete(e.code))
window.addEventListener('blur', () => down.clear())
