import { describe, expect, it } from 'vitest'
import { dominantColor, dropSharedDefaults, luminance, normalizeColor, pageHints, usableAccent } from './brand-color'

describe('normalizeColor', () => {
  it('reads hex and rgb', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc')
    expect(normalizeColor('#1d4e89')).toBe('#1d4e89')
    expect(normalizeColor('rgb(29, 78, 137)')).toBe('#1d4e89')
    expect(normalizeColor('rgba(29,78,137,0.5)')).toBe('#1d4e89')
  })
  it('rejects names and nonsense', () => {
    expect(normalizeColor('red')).toBeNull()
    expect(normalizeColor('var(--x)')).toBeNull()
    expect(normalizeColor(null)).toBeNull()
  })
})

describe('usableAccent', () => {
  it('rejects white, black, near-black and grey', () => {
    for (const c of ['#ffffff', '#000000', '#030507', '#777777', '#f5f5f5']) expect(usableAccent(c)).toBeNull()
  })
  it('keeps a dark brand color as it is', () => {
    expect(usableAccent('#142c45')).toBe('#142c45')
  })
  it('darkens a light brand color until white text reads on it, keeping its hue', () => {
    const out = usableAccent('#ffcc00')!
    expect(luminance(out)).toBeLessThanOrEqual(0.18)
    expect(parseInt(out.slice(1, 3), 16)).toBeGreaterThan(parseInt(out.slice(5, 7), 16))
  })
})

describe('pageHints', () => {
  const html = `<head>
    <meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#1d4e89">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/i32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
  </head>`
  it('skips dark-mode theme colors and prefers the apple touch icon', () => {
    const h = pageHints(html, 'https://firm.example/')
    expect(h.themeColor).toBe('#1d4e89')
    expect(h.manifestUrl).toBe('https://firm.example/site.webmanifest')
    expect(h.iconUrl).toBe('https://firm.example/apple.png')
  })
})

describe('dominantColor', () => {
  it('picks the most common saturated color, ignoring white, grey and transparent', () => {
    const px: number[] = []
    for (let i = 0; i < 10; i++) px.push(255, 255, 255, 255) // white
    for (let i = 0; i < 6; i++) px.push(20, 60, 140, 255) // blue
    for (let i = 0; i < 3; i++) px.push(200, 30, 30, 255) // red
    for (let i = 0; i < 20; i++) px.push(0, 0, 0, 0) // transparent
    expect(dominantColor(Uint8Array.from(px))).toBe('#143c8c')
  })
  it('returns null when there is no saturated color', () => {
    expect(dominantColor(Uint8Array.from([255, 255, 255, 255, 128, 128, 128, 255]))).toBeNull()
  })
})

describe('dropSharedDefaults', () => {
  it('drops a color that three or more firms share, keeps pairs', () => {
    const rows = [{ color: '#4e73b7' }, { color: '#4e73b7' }, { color: '#4e73b7' }, { color: '#133c61' }, { color: '#133c61' }, { color: null }]
    expect(dropSharedDefaults(rows).map((r) => r.color)).toEqual([null, null, null, '#133c61', '#133c61', null])
  })
})
