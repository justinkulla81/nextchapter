/** Splits CSV text into rows, honoring quoted fields and embedded commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false }
      } else field += c
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === ',') { row.push(field.trim()); field = ''; continue }
    if (c === '\n') { row.push(field.trim()); rows.push(row); row = []; field = ''; continue }
    if (c === '\r') continue
    field += c
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row) }
  return rows.filter((r) => r.some((c) => c !== ''))
}
