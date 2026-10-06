// Shared by the portal form, the Help & feedback page and the admin inbox.

export type HelpFormKind = 'help' | 'problem' | 'idea' | 'feedback'

export const HELP_FORM_KINDS: { value: HelpFormKind; label: string; hint: string; prompt: string; placeholder: string }[] = [
  { value: 'help', label: 'Get help', hint: 'Ask a question or get unstuck', prompt: 'What do you need help with?', placeholder: 'Ask us anything about NextChapter or your search.' },
  { value: 'problem', label: 'Report a problem', hint: 'Something isn’t working', prompt: 'What went wrong?', placeholder: 'What happened, and what did you expect to happen?' },
  { value: 'idea', label: 'Share an idea', hint: 'Something we should build', prompt: 'What should we build?', placeholder: 'Describe the idea and what it would help you do.' },
  { value: 'feedback', label: 'Give feedback', hint: 'What’s working, what isn’t', prompt: 'How is NextChapter working for you?', placeholder: 'Tell us what’s working and what isn’t.' },
]

/** Conversation kinds go to the Help inbox; the rest to Vision → Feedback. */
export const isConversationKind = (k: HelpFormKind) => k === 'help' || k === 'problem'

/**
 * Crisis language. Matched on phrases (no model call): shows the 988 note
 * before sending and flags the request for the admin. Never blocks sending.
 */
const CRISIS = /\b(suicid\w*|kill myself|killing myself|end it all|end my life|can'?t go on|cannot go on|want to die|wanna die|self[- ]harm|hurt myself|harm myself|no reason to live|better off dead)\b/i
export const mentionsCrisis = (text: string) => CRISIS.test(text.replace(/[’‘]/g, "'"))

/** How a candidate sees a ProductFeedback status. */
export const FEEDBACK_STATUS_LABEL: Record<'NEW' | 'TRIAGED' | 'ADDRESSED' | 'ARCHIVED', string> = {
  NEW: 'Received',
  TRIAGED: 'Under review',
  ADDRESSED: 'Done',
  ARCHIVED: 'Closed',
}

export const HELP_SCREENSHOT_BUCKET = 'help-screenshots'
export const HELP_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024
export const HELP_MESSAGE_MAX = 5000
