import * as THREE from 'three'

export interface PrintUniforms {
  uClipY: { value: number }
  uBaseY: { value: number }
  uHot: { value: number }
  uShiftY: { value: number }
  uShiftX: { value: number }
  /** multicolour: colour bands by height (1 = single colour) */
  uBands: { value: number }
  uBandCols: { value: THREE.Color[] }
  uHeight: { value: number }
}

/**
 * FDM print look:
 *  - progressive reveal: fragments above uClipY (world) are discarded; back faces render as a flat "cap"
 *  - layer lines (0.25 mm) as a subtle normal/roughness ripple, anti-aliased with fwidth()
 *  - a hot, glowing top layer while printing (uHot)
 *  - layer shift: geometry above uShiftY is offset by uShiftX (world X) in the vertex shader
 */
export function makePrintMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial & { userData: { u: PrintUniforms } } {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.0, side: THREE.DoubleSide }) as THREE.MeshStandardMaterial & {
    userData: { u: PrintUniforms }
  }
  const u: PrintUniforms = {
    uClipY: { value: 1e6 },
    uBaseY: { value: 0 },
    uHot: { value: 0 },
    uShiftY: { value: 1e6 },
    uShiftX: { value: 0 },
    uBands: { value: 1 },
    uBandCols: { value: [0, 1, 2, 3, 4].map(() => new THREE.Color(color)) },
    uHeight: { value: 0.05 },
  }
  m.userData.u = u
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uShiftY; uniform float uShiftX;
        varying vec3 vPrintWorld;`)
      .replace('#include <project_vertex>', `
        vec4 pw = modelMatrix * vec4(transformed, 1.0);
        if (pw.y > uShiftY) pw.x += uShiftX;
        vPrintWorld = pw.xyz;
        vec4 mvPosition = viewMatrix * pw;
        gl_Position = projectionMatrix * mvPosition;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uClipY; uniform float uBaseY; uniform float uHot;
        uniform float uBands; uniform vec3 uBandCols[5]; uniform float uHeight;
        varying vec3 vPrintWorld;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uBands > 1.5) {
          int bi = int(clamp(floor((vPrintWorld.y - uBaseY) / max(uHeight, 1e-4) * uBands), 0.0, uBands - 1.0));
          for (int k = 0; k < 5; k++) if (k == bi) diffuseColor.rgb = uBandCols[k];
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vPrintWorld.y > uClipY) discard;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float layer = (vPrintWorld.y - uBaseY) / 0.00025;
          float w = fwidth(layer);
          float fadeL = 1.0 - smoothstep(0.35, 0.9, w);
          float ripple = cos(layer * 6.2831853) * fadeL;
          if (gl_FrontFacing) {
            normal = normalize(normal + vec3(0.0, 0.35 * ripple, 0.0) * (1.0 - abs(normal.y)));
          } else {
            // inside of the part seen through the open top: draw it as the solid top surface
            normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          }
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float nearTop = 1.0 - smoothstep(0.0, 0.0016, uClipY - vPrintWorld.y);
          totalEmissiveRadiance += vec3(1.0, 0.38, 0.08) * nearTop * uHot * 1.6;
          if (!gl_FrontFacing) diffuseColor.rgb *= 0.92;
        }`)
  }
  m.customProgramCacheKey = () => 'printmat-v2'
  return m
}

/** Plain printed-part material (finished items in hands / on tables) with layer lines. */
export function makeFinishedMaterial(color: THREE.ColorRepresentation) {
  const m = makePrintMaterial(color)
  m.side = THREE.FrontSide
  return m
}

/** Set multicolour bands (colours in order bottom → top). */
export function setBands(m: ReturnType<typeof makePrintMaterial>, colors: string[], baseY: number, height: number) {
  const u = m.userData.u
  u.uBands.value = Math.max(1, Math.min(5, colors.length))
  colors.slice(0, 5).forEach((c, i) => u.uBandCols.value[i].set(c))
  u.uBaseY.value = baseY
  u.uHeight.value = height
}
