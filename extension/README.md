# NextChapter Capture (Chrome extension)

Saves a person, a layoff story, or an article to the CRM from the page you're on.

## Why it exists

Quick add in the admin resolves a pasted LinkedIn URL against your own data
export, which only contains people you're **already connected to** — so the
person most worth saving, the one you just found, is exactly the one it can't
help with. A server can't fetch the profile either: LinkedIn returns a login
wall to anything that isn't a signed-in browser, and working around that
breaches their terms.

An extension reads a page **you are already looking at**, in your own signed-in
tab, at your explicit instruction. That's a different act, and it closes exactly
that gap.

## Install (unpacked)

1. In the admin, open **CRM → Capture tokens** and create one. The token is
   shown once.
2. Visit `chrome://extensions`, enable **Developer mode**, choose **Load
   unpacked**, and select this `extension/` folder.
3. Click the extension, paste your site URL and the token. Both are stored in
   this browser only, via `chrome.storage.local`.

## What it captures

| Tab          | Writes to                                          |
| ------------ | -------------------------------------------------- |
| Person       | `CrmPerson` + `CrmAffiliation`, flagged for completion |
| Layoff       | `CrmOrganization` + `CrmOutplacementProfile` + an opportunity at stage one |
| Research     | `CrmResearchItem` with stance left unset           |
| To send on   | `ResearchLibraryItem`                              |

Prefill is best-effort and always editable before saving — LinkedIn's markup
changes often, and a wrong guess you can see beats a right one you can't.

## Security

The extension holds a **scoped capture token**, not your admin session. It can
reach one endpoint and do nothing else, it's revocable on its own, and it never
grants access to the admin portal. Tokens are stored server-side as a SHA-256
hash; the plaintext exists only in your browser.

Revoke any token from the same admin page. Revocation takes effect immediately.

## Not published

This is an unpacked developer build. Publishing to the Chrome Web Store means
a review on every update and a developer account — worth doing only once the
capture flow has earned its place in your routine.
