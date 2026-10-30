// A Write email link from the CRM opens Gmail's full-page compose (the only
// thing Gmail lets a prefilled link open). If Gmail is already open in another
// tab for the same account, move the message into that tab's small "New
// Message" window and close the full-page tab; with none open, the compose tab
// becomes the inbox with the window docked over it. On any failure the
// full-page compose stays as it is.
// Links to an existing Gmail draft (digest and layoff-watch emails) dock into an open Gmail tab the same way.
const handled = new Set()

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url || handled.has(tabId)) return
  let url
  try { url = new URL(tab.url) } catch { return }
  if (url.hostname !== 'mail.google.com') return
  const draftId = url.hash.match(/compose=([^&]+)/)?.[1]
  if (draftId && draftId !== 'new' && tab.openerTabId !== undefined) {
    handled.add(tabId)
    try { await dockDraft(tabId, tab, url) } catch (error) { console.error('Docking the draft failed; leaving it open in its own tab:', error) } finally { handled.delete(tabId) }
    return
  }
  if (url.searchParams.get('nc') !== 'dock') return
  handled.add(tabId)
  try {
    const account = url.pathname.match(/^\/mail\/u\/(\d+)\//)?.[1]
    const message = { to: url.searchParams.get('to') || '', subject: url.searchParams.get('su') || '', body: url.searchParams.get('body') || '', from: url.searchParams.get('ncfrom') || '' }
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

// A link to an existing Gmail draft (the digest and layoff-watch emails use these) opens in a new tab. If the
// account has another Gmail tab open, open the draft as a New Message window there and close the new tab.
async function dockDraft(tabId, tab, url) {
  const account = url.pathname.match(/^\/mail\/u\/(\d+)\//)?.[1]
  if (!account) return
  const gmailTabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' })
  const sameAccount = gmailTabs.filter((t) => {
    if (t.id === tabId || !t.url) return false
    const u = new URL(t.url)
    return u.searchParams.get('tf') !== 'cm' && u.pathname.match(/^\/mail\/u\/(\d+)\//)?.[1] === account
  })
  const target = sameAccount.find((t) => t.id === tab.openerTabId) ?? sameAccount[0]
  if (!target) return
  await chrome.tabs.update(target.id, { active: true })
  await chrome.windows.update(target.windowId, { focused: true })
  const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId: target.id }, func: openDraftHere, args: [url.hash] })
  if (!result) {
    await chrome.tabs.update(tabId, { active: true })
    return
  }
  await chrome.tabs.remove(tabId)
}

// Runs inside the Gmail tab.
async function openDraftHere(hash) {
  const dialogs = () => [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.querySelector('div[aria-label="Message Body"][contenteditable="true"]'))
  const before = dialogs().length
  location.hash = hash
  for (let i = 0; i < 40; i++) {
    if (dialogs().length > before) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

// Runs inside the Gmail tab, so it can't use anything from this file.
async function openDockedCompose({ to, subject, body, from }) {
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

  // A Gmail tab that just opened is still loading, so wait for its Compose button.
  const compose = await poll(() => [...document.querySelectorAll('div[role="button"], button')].find((e) => e.textContent.trim() === 'Compose'))
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
  // Send from one of the account's other addresses (a Send mail as alias). Gmail swaps the signature when this changes, so it comes first.
  const press = (el) => { for (const type of ['mousedown', 'mouseup', 'click']) el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })) }
  const fromButton = () => [...dialog.querySelectorAll('div[role="button"][aria-haspopup="true"]')].find((e) => /<[^>]+@[^>]+>/.test(e.textContent))
  for (let attempt = 0; from && attempt < 4 && fromButton() && !fromButton().textContent.includes(`<${from}>`); attempt++) {
    press(fromButton())
    const option = await poll(() => [...dialog.querySelectorAll('[role="menuitem"]')].find((e) => e.textContent.includes(`<${from}>`)))
    // Gmail ignores a click on the menu in the instant it opens.
    await wait(600)
    if (option) press(option)
    await wait(600)
  }
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
