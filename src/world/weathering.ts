/**
 * Engine "weathering" (M1.1 R-6): breaks the clean-CG look on every world material.
 *  - world-space triplanar grunge (smudges/fingerprints, dust, fine scratches) → albedo + roughness breakup
 *  - low-frequency macro variation (kills visible texture tiling)
 *  - grime creeping up vertical surfaces near the floor (walls, legs, boxes)
 *  - dust on up-facing surfaces
 *  - dirt collecting where the baked AO is dark (uses the glTF occlusion map when present)
 * One shared shader variant (stable cache key) → negligible cost.
 */
import * as THREE from 'three'

let grunge: THREE.Texture | null = null
function grungeTex() {
  if (!grunge) {
    grunge = new THREE.TextureLoader().load('/assets/textures/grunge.jpg')
    grunge.wrapS = grunge.wrapT = THREE.RepeatWrapping
    grunge.colorSpace = THREE.NoColorSpace
    grunge.anisotropy = 4
  }
  return grunge
}

const SKIP = /^(Screen|LED|Glass|WindowGlass|LightPanel|WindowGlow|ChamberLight|Decal_|Label|OutsideView|Filament|Ink|SwitchRedGlow|LEDGreen|ScaleLCD|DryerLCD|OpenerLens|RadioDial|Bezel|FanVoid|VentDark|Keys)/

const COMMON = /* glsl */ `
uniform sampler2D uGrunge;
uniform float uWeather;
varying vec3 vWPos;
float wxHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wxNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wxHash(i), wxHash(i + vec3(1,0,0)), f.x), mix(wxHash(i + vec3(0,1,0)), wxHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wxHash(i + vec3(0,0,1)), wxHash(i + vec3(1,0,1)), f.x), mix(wxHash(i + vec3(0,1,1)), wxHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 wxTri(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(uGrunge, p.zy * 1.25).rgb * w.x + texture2D(uGrunge, p.xz * 1.25).rgb * w.y + texture2D(uGrunge, p.xy * 1.25).rgb * w.z;
}
`

const done = new WeakSet<THREE.Material>()

export function applyWeathering(m: THREE.Material, strength = 1) {
  const sm = m as THREE.MeshStandardMaterial
  if (!sm.isMeshStandardMaterial || done.has(sm) || SKIP.test(sm.name) || sm.transparent) return
  done.add(sm)
  const tex = grungeTex()
  sm.onBeforeCompile = (shader) => {
    shader.uniforms.uGrunge = { value: tex }
    shader.uniforms.uWeather = { value: strength }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 wxN = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
        vec3 wxG = wxTri(vWPos, wxN);
        float wxMacro = wxNoise(vWPos * 0.9) * 0.6 + wxNoise(vWPos * 2.7) * 0.4;
        float wxGrime = (1.0 - smoothstep(0.0, 0.32, vWPos.y)) * (1.0 - smoothstep(0.55, 0.85, abs(wxN.y)));
        float wxUp = smoothstep(0.6, 0.95, wxN.y);
        diffuseColor.rgb *= 1.0 - uWeather * (0.12 * wxG.r + 0.08 * (wxMacro - 0.5));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.6, 0.55, 0.48), uWeather * wxGrime * 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.46, 0.44, 0.41), uWeather * wxG.g * wxUp * 0.12);
        #ifdef USE_AOMAP
          float wxAo = texture2D(aoMap, vAoMapUv).r;
          diffuseColor.rgb *= mix(1.0 - 0.28 * uWeather, 1.0, smoothstep(0.25, 0.95, wxAo));
        #endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + uWeather * ((wxG.r - 0.3) * 0.24 + wxG.g * wxUp * 0.1 + wxGrime * 0.15 - wxG.b * 0.12 + (wxMacro - 0.5) * 0.08), 0.03, 1.0);`)
  }
  sm.customProgramCacheKey = () => 'weather-v1'
  sm.needsUpdate = true
}
