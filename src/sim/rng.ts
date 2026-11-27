/** Small seeded PRNG (mulberry32) so simulations are reproducible and testable. */
export function nextRandom(seed: number): [value: number, nextSeed: number] {
  const t = (seed + 0x6d2b79f5) | 0
  let r = Math.imul(t ^ (t >>> 15), 1 | t)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t]
}
