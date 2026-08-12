// Server-side backstop for capped MultiChoiceButtons fields — the client
// component already enforces the max, but that's client-only (a direct
// POST or a tampered request isn't stopped by it), so any action reading a
// capped multi-select should clamp here too.
export function clampMulti(formData: FormData, name: string, max: number): string[] {
  return formData.getAll(name).map(String).slice(0, max)
}
