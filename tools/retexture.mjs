// Hot-swap textures inside the raw Blender exports (tools/blender/out/*.glb) from assets_src/textures, without
// rebuilding models or re-baking lightmaps/AO. Then run `node tools/optimize_models.mjs`.
//
//   node tools/retexture.mjs osb concrete        # only these texture sets
//   node tools/retexture.mjs                      # every set found
//
// albedo/normal images are replaced directly; roughness was packed by the glTF exporter into a metallicRoughness
// image (G = roughness, B = metalness), so only its green channel is replaced.
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import sharp from 'sharp'

const RAW = 'tools/blender/out'
const TEX = 'assets_src/textures'
const only = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

async function replaceGreen(pngBuf, roughPath) {
  const base = sharp(pngBuf)
  const meta = await base.metadata()
  const { data, info } = await base.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const r = await sharp(roughPath).resize(meta.width, meta.height).greyscale().raw().toBuffer()
  for (let i = 0, j = 0; i < data.length; i += info.channels, j++) data[i + 1] = r[j]
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer()
}

let changed = 0
for (const f of readdirSync(RAW).filter((f) => f.endsWith('.glb'))) {
  const doc = await io.read(`${RAW}/${f}`)
  let n = 0
  for (const t of doc.getRoot().listTextures()) {
    const name = t.getName()
    if (name.startsWith('decal_')) {
      // decals: replace the image file 1:1
      const src = `${TEX}/${name}.png`
      if ((only.length && !only.includes(name)) || !existsSync(src)) continue
      t.setImage(readFileSync(src))
      t.setMimeType('image/png')
      n++
      continue
    }
    const m = name.match(/^(.*)_(albedo|normal|rough)$/)
    if (!m || (only.length && !only.includes(m[1]))) continue
    const src = `${TEX}/${name}.jpg`
    if (!existsSync(src)) continue
    if (m[2] === 'rough') {
      t.setImage(await replaceGreen(Buffer.from(t.getImage()), src))
      t.setMimeType('image/png')
    } else {
      t.setImage(readFileSync(src))
      t.setMimeType('image/jpeg')
    }
    n++
  }
  if (n) {
    await io.write(`${RAW}/${f}`, doc)
    console.log(`${f.padEnd(24)} ${n} textures replaced`)
    changed++
  }
}
console.log(changed ? 'done. Now run: node tools/optimize_models.mjs' : 'nothing to replace')
