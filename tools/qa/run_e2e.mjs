// End-to-end test runner: makes sure a game server is up, then runs the Playwright (Python) playthrough against it.
//   node tools/qa/run_e2e.mjs [click|beauty] [low|medium|high|ultra]
// Env: PFT_PORT (default 5173), PFT_URL (use an already running server, skips starting one), PYTHON (default python3/python)
import { spawn, spawnSync } from 'node:child_process'

const suite = process.argv[2] ?? 'click'
const quality = process.argv[3] ?? (suite === 'beauty' ? 'high' : 'low')
const scripts = { click: 'tools/qa/playthrough_click.py', beauty: 'tools/qa/beauty.py' }
if (!scripts[suite]) {
  console.error(`unknown suite "${suite}" (use: ${Object.keys(scripts).join(', ')})`)
  process.exit(2)
}
const port = process.env.PFT_PORT ?? '5173'
const url = process.env.PFT_URL ?? `http://127.0.0.1:${port}`
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')

const up = async () => {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

let server = null
if (!(await up())) {
  if (process.env.PFT_URL) {
    console.error(`[e2e] no server answers at ${url}`)
    process.exit(2)
  }
  console.log(`[e2e] starting the dev server on ${url}`)
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
  const t0 = Date.now()
  while (!(await up())) {
    if (Date.now() - t0 > 60000 || server.exitCode !== null) {
      console.error('[e2e] the dev server did not start')
      server.kill()
      process.exit(2)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
} else console.log(`[e2e] using the server already running at ${url}`)

console.log(`[e2e] ${scripts[suite]} (${quality})`)
const r = spawnSync(python, [scripts[suite], quality], { stdio: 'inherit', env: { ...process.env, PFT_URL: url } })
if (r.error) console.error(`[e2e] could not run ${python}: ${r.error.message}`)
server?.kill()
process.exit(r.status ?? 1)
