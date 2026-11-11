import { CLOUD_PROVIDER_V4_CIDRS, CLOUD_PROVIDER_V6_CIDRS } from './cloud-provider-cidrs'

// True for an address inside an Amazon Web Services or Google Cloud block (see cloud-provider-cidrs.ts). Kept apart from
// isDatacenterIp, which the visitor pages use, so adding these ranges changes only the click rule that asks for them.
//
// An address becomes a fixed-width hex string (8 digits for IPv4, 32 for IPv6): such strings sort the same as the numbers,
// so a block is a [start, end] pair of strings and a lookup is a binary search with plain string comparison.

const pad = (n: number, width: number) => n.toString(16).padStart(width, '0')

function v4Groups(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null
    out.push(Number(p))
  }
  return out
}

function v6Groups(ip: string): number[] | null {
  const zone = ip.indexOf('%')
  const text = zone === -1 ? ip : ip.slice(0, zone)
  if (!text.includes(':') || (text.match(/::/g) ?? []).length > 1) return null
  const compressed = text.includes('::')
  const [head, tail] = text.split('::')
  const split = (s: string | undefined) => (s ? s.split(':') : [])
  const left = split(head)
  const right = compressed ? split(tail) : []
  const fill = 8 - left.length - right.length
  if (compressed ? fill < 1 : left.length !== 8) return null
  const groups = [...left, ...(compressed ? Array<string>(fill).fill('0') : []), ...right]
  if (groups.length !== 8) return null
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out
}

/** Hex key of an address: 8 digits for IPv4, 32 for IPv6. */
function keyOf(groups: number[], width: number): string {
  return groups.map((g) => pad(g, width)).join('')
}

interface Block { start: string; end: string }

function toBlocks(cidrs: string[], groupOf: (ip: string) => number[] | null, groupBits: number): Block[] {
  const width = groupBits / 4
  const max = 2 ** groupBits - 1
  const blocks: Block[] = []
  for (const cidr of cidrs) {
    const [base, lenText] = cidr.split('/')
    const groups = groupOf(base)
    if (!groups) continue
    const len = Number(lenText)
    const whole = Math.floor(len / groupBits)
    const rest = len % groupBits
    const start: number[] = []
    const end: number[] = []
    groups.forEach((g, i) => {
      if (i < whole) { start.push(g); end.push(g) }
      else if (i === whole && rest > 0) {
        const hostBits = groupBits - rest
        const low = Math.floor(g / 2 ** hostBits) * 2 ** hostBits
        start.push(low)
        end.push(low + 2 ** hostBits - 1)
      } else { start.push(0); end.push(max) }
    })
    blocks.push({ start: keyOf(start, width), end: keyOf(end, width) })
  }
  return blocks.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

const V4 = toBlocks(CLOUD_PROVIDER_V4_CIDRS, v4Groups, 8)
const V6 = toBlocks(CLOUD_PROVIDER_V6_CIDRS, v6Groups, 16)

function inBlocks(blocks: Block[], key: string): boolean {
  let lo = 0
  let hi = blocks.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const b = blocks[mid]
    if (key < b.start) hi = mid - 1
    else if (key > b.end) lo = mid + 1
    else return true
  }
  return false
}

export function isCloudProviderIp(ip: string | null | undefined): boolean {
  if (!ip) return false
  const text = ip.trim()
  if (text.includes(':')) {
    const groups = v6Groups(text)
    return groups !== null && inBlocks(V6, keyOf(groups, 4))
  }
  const groups = v4Groups(text)
  return groups !== null && inBlocks(V4, keyOf(groups, 2))
}
