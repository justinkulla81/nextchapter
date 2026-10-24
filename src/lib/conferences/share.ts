/** First http(s) link in a string (a share sheet often puts the link inside a sentence). */
export function firstLinkIn(raw: string | undefined | null): string | null {
  const m = raw?.match(/https?:\/\/[^\s<>"']+/i)
  return m ? m[0].replace(/[.,;)]+$/, '') : null
}
