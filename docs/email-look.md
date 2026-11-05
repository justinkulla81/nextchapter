# Email look

Every email built on `src/lib/email/card-layout.tsx` shares one look: a warm paper card (`PAPER`) with a faint edge, the bookmark mark beside the NextChapter name, and bold navy headlines in the display font.

Parts in the layout file:

- `Wordmark`: bookmark image plus the name as text, so it survives blocked images.
- `Signoff`: Victoria's handwritten sign-off. `name` is `Victoria`, `Vicki` or `Vic` and picks the image in `public/email/`. Use it on conversational emails (check-ins, nudges, the newsletter). Leave it off verification, receipt and invite emails.
- `Mark`: orange highlighter for a count or number. Never on something clickable. Green stays the only button color.
- `MarginNote`: a short handwritten aside. Falls back to a cursive system font outside Apple Mail.

Gmail ignores web fonts, so the display and hand fonts only show in Apple Mail and similar clients. The signature and bookmark are PNGs for that reason. They load from `NEXT_PUBLIC_APP_URL` (default `https://launchyournextchapter.com`), so they only appear once a build that contains `public/email/` is live.

Not yet on this look: emails that do not use the shared layout (reference requests, employer and company invites, lead lifecycle, admin alerts, the employer digest).
