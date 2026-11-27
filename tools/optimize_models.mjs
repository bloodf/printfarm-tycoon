// Optimise raw Blender exports (tools/blender/out) → public/assets/models
// Keeps the scene graph, node names, material names and extras intact (the game rig depends on them),
// then verifies that every named node survived.
import { execFileSync } from 'node:child_process'
import { readdirSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const SRC = 'tools/blender/out'
const OUT = 'public/assets/models'
mkdirSync(OUT, { recursive: true })
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

async function names(file) {
  const doc = await io.read(file)
  const nodes = new Set(doc.getRoot().listNodes().map((n) => n.getName()))
  const mats = new Set(doc.getRoot().listMaterials().map((m) => m.getName()))
  return { nodes, mats }
}

/** Materials the game recolours per instance/slot must stay separate. gltf-transform's optimize always runs dedup, which
 *  merges materials with identical properties (e.g. ToolColor_0..4 all start white). Nudge their emissive factors apart
 *  in a temp copy first; the game overwrites these colours at runtime. */
const KEEP_SEPARATE = /^(ToolColor_\d|Filament|DryerScreen|Screen|LED)/
async function unmergeable(src) {
  const doc = await io.read(src)
  const mats = doc.getRoot().listMaterials().filter((m) => KEEP_SEPARATE.test(m.getName()))
  if (mats.length < 2) return src
  mats.forEach((m, i) => {
    const e = m.getEmissiveFactor()
    m.setEmissiveFactor([e[0] > 0.5 ? e[0] - i * 1e-3 : e[0] + i * 1e-3, e[1], e[2]])
  })
  const tmp = src.replace(/\.glb$/, '.tmp.glb')
  await io.write(tmp, doc)
  return tmp
}

const only = process.argv.slice(2)
let failed = false
for (const f of readdirSync(SRC).filter((f) => f.endsWith('.glb') && !f.endsWith('.tmp.glb'))) {
  if (only.length && !only.some((o) => f.startsWith(o))) continue
  const src = `${SRC}/${f}`
  const dst = `${OUT}/${f}`
  const input = await unmergeable(src)
  execFileSync('npx', ['gltf-transform', 'optimize', input, dst,
    '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '2048',
    '--flatten', 'false', '--join', 'false', '--palette', 'false', '--instance', 'false',
    '--simplify', 'false', '--prune', 'false'], { stdio: 'pipe' })
  if (input !== src) unlinkSync(input)
  const a = await names(src)
  const b = await names(dst)
  const lostNodes = [...a.nodes].filter((n) => !b.nodes.has(n))
  const CRITICAL = /^(Filament|Screen|LED|Glass|LightPanel|WindowGlow|ChamberLight|ToolColor|DryerScreen)/
  const lostMats = [...a.mats].filter((n) => CRITICAL.test(n) && !b.mats.has(n))
  const kb = (p) => Math.round(statSync(p).size / 1024)
  console.log(`${f.padEnd(24)} ${String(kb(src)).padStart(6)} KB → ${String(kb(dst)).padStart(5)} KB  nodes ${b.nodes.size}/${a.nodes.size}`)
  // Blender renames duplicate object names ("Slot_0" → "Slot_0.001"). The game tolerates this for rig nodes looked
  // up inside one prop (src/world/assets.ts findNode), but flag it so new rigs get unique names.
  const dupes = [...b.nodes].filter((n) => /\.\d{3}$/.test(n) && !/(_mesh|mesh)\.\d{3}$/.test(n))
  if (dupes.length) console.log('   note: Blender-suffixed node names (resolved by findNode aliasing):', dupes.slice(0, 12).join(', '))
  if (lostNodes.length || lostMats.length) {
    failed = true
    console.log('   LOST nodes:', lostNodes.slice(0, 20).join(', '), ' LOST materials:', lostMats.join(', '))
  }
}
if (failed) process.exit(1)
