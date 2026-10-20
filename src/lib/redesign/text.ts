// Small text rules for the redesigned pages (design-principles.md: sentence case for all UI text).

/**
 * Title Case to sentence case: the first word keeps its capital, every other word is lowercased, except acronyms
 * (two or more capitals, like "AI" or "BLS") and words that contain a digit, which stay as written.
 */
export function sentenceCase(text: string): string {
  let first = true
  return text.replace(/[^\s]+/g, (word) => {
    const isAcronym = word.replace(/[^A-Za-z]/g, '').length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)
    const hasDigit = /\d/.test(word)
    if (first) {
      first = false
      return word.charAt(0).toUpperCase() + (isAcronym || hasDigit ? word.slice(1) : word.slice(1).toLowerCase())
    }
    return isAcronym || hasDigit ? word : word.toLowerCase()
  })
}
