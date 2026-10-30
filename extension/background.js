// A Write email link from the CRM opens Gmail's full-page compose (the only
// thing Gmail lets a prefilled link open). If Gmail is already open in another
// tab for the same account, move the message into that tab's small "New
// Message" window and close the full-page tab. With no Gmail tab open, or on
// any failure, the full-page compose stays as it is.
const handled = new Set()

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url || handled.has(tabId)) return
  let url
  try { url = new URL(tab.url) } catch { return }
  if (url.hostname !== 'mail.google.com' || url.searchParams.get('nc') !== 'dock') return
  handled.add(tabId)
  try {
    const account = url.pathname.match(/^\/mail\/u\/(\d+)\//)?.[1]
    const message = { to: url.searchParams.get('to') || '', subject: url.searchParams.get('su') || '', body: url.searchParams.get('body') || '' }
    const gmailTabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' })
    const target = gmailTabs.find((t) => {
      if (t.id === tabId || !t.url) return false
      const u = new URL(t.url)
      return u.searchParams.get('tf') !== 'cm' && u.pathname.match(/^\/mail\/u\/(\d+)\//)?.[1] === account
    })
    if (!target) return
    const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId: target.id }, func: openDockedCompose, args: [message] })
    if (!result) return
    await chrome.tabs.update(target.id, { active: true })
    await chrome.windows.update(target.windowId, { focused: true })
    await chrome.tabs.remove(tabId)
  } catch (error) {
    console.error('Docked compose failed; leaving the full-page compose open:', error)
  } finally {
    handled.delete(tabId)
  }
})

// Runs inside the Gmail tab, so it can't use anything from this file.
async function openDockedCompose({ to, subject, body }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const poll = async (get) => {
    for (let i = 0; i < 40; i++) {
      const found = get()
      if (found) return found
      await wait(250)
    }
    return null
  }
  const dialogs = () => [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.querySelector('div[aria-label="Message Body"][contenteditable="true"]'))
  const before = new Set(dialogs())

  const compose = [...document.querySelectorAll('div[role="button"], button')].find((e) => e.textContent.trim() === 'Compose')
  if (compose) compose.click()
  else location.hash = '#inbox?compose=new'

  const dialog = await poll(() => dialogs().find((d) => !before.has(d)))
  if (!dialog) return false
  const toField = dialog.querySelector('input[aria-label="To recipients"]')
  const subjectField = dialog.querySelector('input[aria-label="Subject"]')
  const bodyField = dialog.querySelector('div[aria-label="Message Body"][contenteditable="true"]')
  if (!toField || !subjectField || !bodyField) return false

  toField.focus()
  document.execCommand('insertText', false, to)
  // Enter turns the typed address into a recipient chip.
  for (const type of ['keydown', 'keyup']) toField.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
  subjectField.focus()
  document.execCommand('insertText', false, subject)
  bodyField.focus()
  // Gmail puts the signature below the cursor, so the note goes in above it.
  getSelection().collapse(bodyField, 0)
  body.split('\n').forEach((line, i) => {
    if (i > 0) document.execCommand('insertParagraph')
    if (line) document.execCommand('insertText', false, line)
  })
  return true
}
