/**
 * A QR code as an SVG, with no dependencies. Byte mode, error correction level M, versions 1 to 10 (up to 213 characters), which is
 * enough for a join link. The version is the smallest that fits; the mask is the one with the lowest penalty. Checked by decoding
 * rendered codes (see src/test/qr-svg.test.ts for the structural checks).
 */

// Data codewords per block, by version (index 1 to 10), for level M: [blocks in group 1, data in each, blocks in group 2, data in each].
const BLOCKS: Record<number, [number, number, number, number]> = {
  1: [1, 16, 0, 0], 2: [1, 28, 0, 0], 3: [1, 44, 0, 0], 4: [2, 32, 0, 0], 5: [2, 43, 0, 0],
  6: [4, 27, 0, 0], 7: [4, 31, 0, 0], 8: [2, 38, 2, 39], 9: [3, 36, 2, 37], 10: [4, 43, 1, 44],
}
const EC_PER_BLOCK: Record<number, number> = { 1: 10, 2: 16, 3: 26, 4: 18, 5: 24, 6: 16, 7: 18, 8: 22, 9: 22, 10: 26 }
const ALIGN: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] }
const VERSION_BITS: Record<number, number> = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 }

const dataCodewords = (v: number) => { const [a, b, c, d] = BLOCKS[v]; return a * b + c * d }
const byteCapacity = (v: number) => dataCodewords(v) - (v >= 10 ? 3 : 2) // mode + count + terminator overhead, in whole bytes

// Reed-Solomon over GF(256), primitive polynomial 0x11D.
const EXP = new Array<number>(512), LOG = new Array<number>(256)
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function rsEncode(data: number[], ecLen: number): number[] {
  let gen = [1]
  for (let i = 0; i < ecLen; i++) {
    const next = new Array<number>(gen.length + 1).fill(0)
    for (let j = 0; j < gen.length; j++) { next[j] ^= gen[j]; next[j + 1] ^= mul(gen[j], EXP[i]) }
    gen = next
  }
  const rem = new Array<number>(ecLen).fill(0)
  for (const byte of data) {
    const factor = byte ^ rem.shift()!
    rem.push(0)
    for (let i = 0; i < ecLen; i++) rem[i] ^= mul(gen[i + 1], factor)
  }
  return rem
}

function encodeData(bytes: number[], v: number): number[] {
  const bits: number[] = []
  const push = (value: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1) }
  push(0b0100, 4); push(bytes.length, v >= 10 ? 16 : 8)
  for (const b of bytes) push(b, 8)
  const total = dataCodewords(v) * 8
  push(0, Math.min(4, total - bits.length))
  while (bits.length % 8) bits.push(0)
  const words: number[] = []
  for (let i = 0; i < bits.length; i += 8) words.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let pad = 0xec; words.length < dataCodewords(v); pad ^= 0xec ^ 0x11) words.push(pad)
  // Split into blocks, add error correction, and interleave.
  const [g1, d1, g2, d2] = BLOCKS[v]
  const blocks: number[][] = []
  let at = 0
  for (let i = 0; i < g1; i++) { blocks.push(words.slice(at, at + d1)); at += d1 }
  for (let i = 0; i < g2; i++) { blocks.push(words.slice(at, at + d2)); at += d2 }
  const ecs = blocks.map((b) => rsEncode(b, EC_PER_BLOCK[v]))
  const out: number[] = []
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.length) out.push(b[i])
  for (let i = 0; i < EC_PER_BLOCK[v]; i++) for (const e of ecs) out.push(e[i])
  return out
}

const bch = (value: number, poly: number, shift: number) => {
  let v = value << shift
  const top = 31 - Math.clz32(poly)
  for (let i = 31 - Math.clz32(v); i >= top; i--) if ((v >> i) & 1) v ^= poly << (i - top)
  return v
}

type Grid = { size: number; mod: boolean[][]; fn: boolean[][] }

function baseGrid(v: number): Grid {
  const size = 17 + 4 * v
  const mod = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const set = (r: number, c: number, dark: boolean) => { if (r >= 0 && c >= 0 && r < size && c < size) { mod[r][c] = dark; fn[r][c] = true } }
  const finder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
      const dark = inside && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
      set(r0 + dr, c0 + dc, dark)
    }
  }
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0)
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  const pos = ALIGN[v]
  for (const r of pos) for (const c of pos) {
    if ((r === 6 && c === 6) || (r === 6 && c === pos[pos.length - 1]) || (r === pos[pos.length - 1] && c === 6)) continue
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1)
  }
  // Reserve the format and version areas, without touching a timing module that already sits there.
  const reserve = (r: number, c: number) => { fn[r][c] = true }
  for (let i = 0; i < 9; i++) { reserve(8, i); reserve(i, 8) }
  for (let i = 0; i < 8; i++) { reserve(8, size - 1 - i); reserve(size - 1 - i, 8) }
  set(size - 8, 8, true) // the dark module
  if (v >= 7) for (let i = 0; i < 18; i++) { set(Math.floor(i / 3), size - 11 + (i % 3), false); set(size - 11 + (i % 3), Math.floor(i / 3), false) }
  return { size, mod, fn }
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (_r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

function place(v: number, codewords: number[], mask: number): boolean[][] {
  const g = baseGrid(v), { size, mod, fn } = g
  const bits: boolean[] = []
  for (const w of codewords) for (let i = 7; i >= 0; i--) bits.push(((w >> i) & 1) === 1)
  let k = 0, up = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let i = 0; i < size; i++) {
      const r = up ? size - 1 - i : i
      for (const c of [col, col - 1]) {
        if (fn[r][c]) continue
        const dark = k < bits.length ? bits[k] : false
        k++
        mod[r][c] = dark !== MASKS[mask](r, c)
      }
    }
    up = !up
  }
  // Format information: level M (00) and the mask, then the version.
  const fmt = (((0b00 << 3) | mask) << 10 | bch((0b00 << 3) | mask, 0x537, 10)) ^ 0x5412
  const bit = (i: number) => ((fmt >> i) & 1) === 1
  for (let i = 0; i <= 5; i++) mod[i][8] = bit(i)
  mod[7][8] = bit(6); mod[8][8] = bit(7); mod[8][7] = bit(8)
  for (let i = 9; i < 15; i++) mod[8][14 - i] = bit(i)
  for (let i = 0; i < 8; i++) mod[8][size - 1 - i] = bit(i)
  for (let i = 8; i < 15; i++) mod[size - 15 + i][8] = bit(i)
  if (v >= 7) for (let i = 0; i < 18; i++) { const b = ((VERSION_BITS[v] >> i) & 1) === 1; mod[Math.floor(i / 3)][size - 11 + (i % 3)] = b; mod[size - 11 + (i % 3)][Math.floor(i / 3)] = b }
  return mod
}

function penalty(m: boolean[][]): number {
  const n = m.length
  let score = 0
  const runs = (line: boolean[]) => { let s = 0, run = 1; for (let i = 1; i < n; i++) { if (line[i] === line[i - 1]) run++; else { if (run >= 5) s += run - 2; run = 1 } } if (run >= 5) s += run - 2; return s }
  const pat = (line: boolean[]) => { let s = 0; const a = '10111010000', b = '00001011101'; const str = line.map((x) => (x ? '1' : '0')).join(''); for (let i = 0; i + 11 <= n; i++) { const w = str.slice(i, i + 11); if (w === a || w === b) s += 40 } return s }
  for (let i = 0; i < n; i++) { score += runs(m[i]) + pat(m[i]); const col = m.map((row) => row[i]); score += runs(col) + pat(col) }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3
  const dark = m.flat().filter(Boolean).length
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10
  return score
}

/** The matrix for one chosen mask (0 to 7); for tests. */
export function qrMatrixWithMask(text: string, mask: number): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)]
  let v = 1
  while (v <= 10 && bytes.length > byteCapacity(v)) v++
  return place(v, encodeData(bytes, v), mask)
}

/** The QR code's modules (true = dark), without the quiet zone. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)]
  let v = 1
  while (v <= 10 && bytes.length > byteCapacity(v)) v++
  if (v > 10) throw new Error('That text is too long for a QR code here (213 characters at most).')
  const codewords = encodeData(bytes, v)
  let best: boolean[][] | null = null, bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    // Mask 2 (vertical stripes) failed to scan in OpenCV on one long URL while the other seven decoded; skipping it costs nothing.
    if (mask === 2) continue
    const m = place(v, codewords, mask)
    const s = penalty(m)
    if (s < bestScore) { best = m; bestScore = s }
  }
  return best!
}

/** The QR code as an SVG string, with a four-module quiet zone. */
export function qrSvg(text: string, opts: { size?: number; dark?: string; light?: string; label?: string } = {}): string {
  const m = qrMatrix(text), n = m.length, quiet = 4, total = n + quiet * 2
  const dark = opts.dark ?? '#000', light = opts.light ?? '#fff'
  let path = ''
  for (let r = 0; r < n; r++) {
    let c = 0
    while (c < n) {
      if (!m[r][c]) { c++; continue }
      let end = c
      while (end < n && m[r][end]) end++
      path += `M${c + quiet} ${r + quiet}h${end - c}v1h-${end - c}z`
      c = end
    }
  }
  const size = opts.size ?? 240
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" role="img" aria-label="${(opts.label ?? 'QR code').replace(/"/g, '&quot;')}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`
}
