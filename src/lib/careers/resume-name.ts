// Reads a person's name from the top of resume text, so an application form does not ask for it.
// No model call: a resume puts the name in its first lines, on a line of its own. When no line looks
// like a name this returns null, and the caller carries on without one.

const NOT_A_NAME = new Set([
  'resume', 'résumé', 'curriculum vitae', 'cv', 'profile', 'summary', 'professional summary', 'contact',
  'contact information', 'experience', 'work experience', 'education', 'skills', 'objective', 'about me',
])

const SEPARATORS = /\s*[|•·–—]\s*|\s{3,}/

// "Ada", "Lovelace", "O'Neil", "Anne-Marie", "J.", "Jr." (also ALL CAPS, which is common for a name line).
const TOKEN = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*$/

function titleCase(word: string): string {
  if (word.length <= 1 || word !== word.toUpperCase() || /\./.test(word)) return word
  return word.charAt(0) + word.slice(1).toLowerCase()
}

/** The person's name, or null when the first lines of the resume do not hold one. */
export function guessNameFromResumeText(text: string | null | undefined): string | null {
  if (!text) return null
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8)
  for (const line of lines) {
    const first = line.split(SEPARATORS)[0]?.trim() ?? ''
    if (!first || first.length > 60) continue
    if (/[\d@]|https?:|www\.|linkedin/i.test(first)) continue
    if (NOT_A_NAME.has(first.toLowerCase())) continue
    const tokens = first.split(/\s+/)
    if (tokens.length < 2 || tokens.length > 5) continue
    if (!tokens.every((t) => TOKEN.test(t))) continue
    // Real names start every word with a capital (particles like "van" and "de" aside).
    const capitalized = tokens.filter((t) => /^[A-ZÀ-ÖØ-Þ]/.test(t)).length
    if (capitalized < 2) continue
    return tokens.map(titleCase).join(' ')
  }
  return null
}
