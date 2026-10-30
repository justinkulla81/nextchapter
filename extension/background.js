// A Write email link from the CRM opens Gmail's full-page compose (the only
// thing Gmail lets a prefilled link open). If Gmail is already open in another
// tab for the same account, move the message into that tab's small "New
// Message" window and close the full-page tab; with none open, the compose tab
// becomes the inbox with the window docked over it. On any failure the
// full-page compose stays as it is.
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
    if (!target) {
      // No Gmail tab for this account: turn the compose tab itself into that account's inbox, then dock the message over it.
      if (account === undefined) return
      await chrome.tabs.update(tabId, { url: `https://mail.google.com/mail/u/${account}/#inbox` })
      await new Promise((resolve) => {
        const done = (id, change) => {
          if (id !== tabId || change.status !== 'complete') return
          chrome.tabs.onUpdated.removeListener(done)
          resolve()
        }
        chrome.tabs.onUpdated.addListener(done)
      })
      await chrome.scripting.executeScript({ target: { tabId }, func: openDockedCompose, args: [message] })
      return
    }
    // Gmail ignores typing into a tab that is not in front, so bring it forward before filling the window.
    await chrome.tabs.update(target.id, { active: true })
    await chrome.windows.update(target.windowId, { focused: true })
    const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId: target.id }, func: openDockedCompose, args: [message] })
    if (!result) {
      await chrome.tabs.update(tabId, { active: true })
      return
    }
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

  // Gmail finishes setting the window up after it appears and can wipe what was typed too early.
  await wait(700)
  const hasRecipient = () => !!dialog.querySelector('[email], [data-hovercard-id]')
  for (let attempt = 0; attempt < 4 && !(hasRecipient() && subjectField.value === subject); attempt++) {
    if (!hasRecipient()) {
      toField.focus()
      document.execCommand('insertText', false, to)
      // Enter turns the typed address into a recipient chip.
      for (const type of ['keydown', 'keyup']) toField.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
    }
    if (subjectField.value !== subject) {
      subjectField.focus()
      subjectField.select()
      document.execCommand('insertText', false, subject)
    }
    await wait(500)
  }
  bodyField.focus()
  // Gmail puts the signature below the cursor, so the note goes in above it.
  getSelection().collapse(bodyField, 0)
  body.split('\n').forEach((line, i) => {
    if (i > 0) document.execCommand('insertParagraph')
    if (line) document.execCommand('insertText', false, line)
  })
  return true
}
