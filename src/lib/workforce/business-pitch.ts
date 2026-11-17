// What an organization enters for its employer pitch (Business Hub › Incentives and costs): the incentives a company could
// use and what office space costs, each with its source. The pitch shows only what is entered here plus figures from data
// we hold; nothing is invented. Stored in Institution.enabledFeatures.businessPitch (no schema change).

export type PitchIncentive = { name: string; detail: string; source: string }
export type PitchSettings = {
  incentives: PitchIncentive[]
  officeCost: { perSqFtYear: number | null; note: string; source: string } | null
  pitchLine: string | null
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function readPitchSettings(enabledFeatures: unknown): PitchSettings {
  const raw = (enabledFeatures as { businessPitch?: Record<string, unknown> } | null)?.businessPitch ?? {}
  const incentives = Array.isArray(raw.incentives)
    ? (raw.incentives as Record<string, unknown>[])
        .map((i) => ({ name: str(i.name, 120), detail: str(i.detail, 400), source: str(i.source, 300) }))
        .filter((i) => i.name)
        .slice(0, 8)
    : []
  const oc = raw.officeCost as Record<string, unknown> | undefined
  const per = typeof oc?.perSqFtYear === 'number' && oc.perSqFtYear > 0 && oc.perSqFtYear < 500 ? Math.round(oc.perSqFtYear * 100) / 100 : null
  const officeCost = oc && (per !== null || str(oc.note, 300)) ? { perSqFtYear: per, note: str(oc.note, 300), source: str(oc.source, 300) } : null
  return { incentives, officeCost, pitchLine: str(raw.pitchLine, 200) || null }
}

// Form fields to settings: up to four incentive rows (incentiveName0..3, incentiveDetail0..3, incentiveSource0..3).
export function pitchSettingsFromForm(fd: FormData): PitchSettings {
  const incentives: PitchIncentive[] = []
  for (let k = 0; k < 4; k++) {
    const name = str(fd.get(`incentiveName${k}`), 120)
    if (name) incentives.push({ name, detail: str(fd.get(`incentiveDetail${k}`), 400), source: str(fd.get(`incentiveSource${k}`), 300) })
  }
  const perRaw = Number(str(fd.get('officePerSqFt'), 20))
  const per = Number.isFinite(perRaw) && perRaw > 0 && perRaw < 500 ? Math.round(perRaw * 100) / 100 : null
  const note = str(fd.get('officeNote'), 300)
  return {
    incentives,
    officeCost: per !== null || note ? { perSqFtYear: per, note, source: str(fd.get('officeSource'), 300) } : null,
    pitchLine: str(fd.get('pitchLine'), 200) || null,
  }
}
