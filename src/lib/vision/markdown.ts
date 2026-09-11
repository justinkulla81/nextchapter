/**
 * Minimal Markdown renderer for the vision document.
 *
 * A dependency-free renderer rather than react-markdown: this displays ONE
 * document that you write yourself, so the input is trusted and the feature
 * surface needed is small. Adding a parser plus its plugin chain for that is
 * weight the repo does not need.
 *
 * Everything is HTML-escaped before any formatting is applied, so the output
 * cannot inject markup even though the source is trusted today.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[0.9em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    // Links: only http(s), so a javascript: URL cannot slip through.
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="underline">$1</a>')
}

/** Returns HTML. Headings get ids so the roadmap can link to a section. */
export function renderMarkdown(md: string): string {
  const out: string[] = []
  let inList = false
  let inCode = false

  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }

  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd()

    if (line.startsWith('```')) {
      closeList()
      out.push(inCode ? '</pre>' : '<pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs">')
      inCode = !inCode
      continue
    }
    if (inCode) { out.push(escapeHtml(raw)); continue }

    if (!line.trim()) { closeList(); continue }

    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      closeList()
      const level = h[1].length
      const text = h[2]
      const id = slugify(text)
      const size = ['text-2xl', 'text-xl', 'text-lg', 'text-base'][level - 1]
      out.push(`<h${level} id="${id}" class="${size} mt-6 mb-2 font-semibold scroll-mt-4">${inline(text)}</h${level}>`)
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul class="my-2 list-disc space-y-1 pl-6">'); inList = true }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
      continue
    }

    if (/^---+$/.test(line.trim())) { closeList(); out.push('<hr class="my-6 border-border">'); continue }

    closeList()
    out.push(`<p class="my-2 leading-relaxed">${inline(line)}</p>`)
  }
  closeList()
  if (inCode) out.push('</pre>')
  return out.join('\n')
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60)
}

/** Top-level headings, for linking a roadmap item to a section of the vision. */
export function extractSections(md: string): { id: string; title: string; level: number }[] {
  const out: { id: string; title: string; level: number }[] = []
  for (const line of md.split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) out.push({ id: slugify(h[2]), title: h[2].trim(), level: h[1].length })
  }
  return out
}
