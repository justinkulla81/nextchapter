// The receipt sent back when the owner emails news@ or layoffs@: that it arrived, and what is done with it.
// Pure text, no I/O; the sending is in receipts.ts.

const SITE = 'https://launchyournextchapter.com'
export const NEWS_ADMIN_URL = `${SITE}/support/admin/digest`
export const LAYOFFS_ADMIN_URL = `${SITE}/support/admin/crm/warn`

/** One article from a news@ email and where it went (the row's suggestedAction, which says exactly that). */
export interface NewsReceiptItem {
  title: string | null
  url: string
  used: string
  /** Already in the library from an earlier email: nothing new was filed. */
  alreadyFiled?: boolean
}

export function replySubject(subject: string | null): string {
  const s = (subject ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return 'Received'
  return /^re:/i.test(s) ? s : `Re: ${s}`
}

/** The routing note without its "Sent to news@." lead-in, which the receipt already says. */
function usedLine(used: string): string {
  const rest = used.replace(/^Sent to news@(\.\s*|,\s*but\s+)/, '').trim()
  return rest ? rest[0].toUpperCase() + rest.slice(1) : 'Filed for you to review.'
}

/** A link inside the email is shown as a page name, not the whole tracking-laden URL. */
function label(item: NewsReceiptItem): string {
  if (item.title?.trim()) return item.title.replace(/\s+/g, ' ').trim()
  if (item.url.startsWith('gmail-message:')) return 'The article you pasted'
  try {
    const u = new URL(item.url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.length > 1 ? u.pathname : ''}`.slice(0, 120)
  } catch {
    return item.url.slice(0, 120)
  }
}

export function newsReceiptText(items: NewsReceiptItem[], kind: 'articles' | 'newsletter' | 'empty'): string {
  const lines = ['Received your email to news@.', '']
  if (kind === 'newsletter') {
    lines.push(
      'It is a newsletter with many stories, so no single story was picked out of it. It is filed for you to review.',
      'To have a story used, send that story on its own, one email each.',
    )
  } else if (kind === 'empty') {
    lines.push('It had no article link and no pasted article, so nothing was filed. Send the link to the story, or paste the article in.')
  } else {
    lines.push('Each article was read and judged for three places: the monthly report, website News and the weekly news email. What happened:', '')
    for (const item of items) {
      lines.push(`- ${label(item)}`)
      lines.push(`  ${item.alreadyFiled ? 'Already filed from an earlier email, nothing new added. ' : ''}${usedLine(item.used)}`)
    }
  }
  lines.push('', `Review or change any of it: ${NEWS_ADMIN_URL}`)
  return lines.join('\n')
}

/** One story in a layoffs@ email: its page title when the page could be read, and its link. */
export interface LayoffReceiptArticle { url: string; title: string | null }

/**
 * The layoffs@ receipt names what arrived (owner, 2026-11-20: "tell me what article you are talking about"): each story's title and
 * link, or the email's subject and opening words when there is no link.
 */
export function layoffReceiptText(what: { articles?: LayoffReceiptArticle[]; subject?: string | null; excerpt?: string | null } = {}): string {
  const articles = what.articles ?? []
  const lines = ['Received your email to layoffs@.', '']
  if (articles.length) {
    lines.push(articles.length === 1 ? 'The story:' : 'The stories:')
    for (const a of articles) {
      lines.push(`- ${label({ url: a.url, title: a.title, used: '' })}`)
      if (a.title?.trim()) lines.push(`  ${a.url}`)
    }
  } else {
    const subject = (what.subject ?? '').replace(/\s+/g, ' ').trim()
    const excerpt = (what.excerpt ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)
    lines.push(subject || excerpt ? `It had no link to a story. What it said: "${subject || excerpt}${!subject && (what.excerpt ?? '').trim().length > 160 ? '...' : ''}"` : 'It had no link and no text, so there is nothing to file. Send the link to the story.')
  }
  lines.push(
    '',
    'How it is used:',
    '- The story is read for the employer, jobs cut, date and location.',
    '- It is checked against the layoff tracker. If the layoff is already there, that record is updated (the headcount most sources give, the better source); no second record is added.',
    '- If it is new, it is added as a reported layoff and published to the public layoff tracker and the layoff RSS feed. From there it feeds the jobs report, the layoff alerts and the workforce board for that area.',
    '',
    `The layoff tracker: ${LAYOFFS_ADMIN_URL}`,
  )
  return lines.join('\n')
}
