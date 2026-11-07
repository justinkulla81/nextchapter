# Email look

Every email built on `src/lib/email/card-layout.tsx` shares one look: a warm paper card (`PAPER`) with a faint edge, the bookmark mark beside the NextChapter name, and bold navy headlines in the display font.

Parts in the layout file:

- `Wordmark`: bookmark image plus the name as text, so it survives blocked images. Pass `label` (for example `label="Weekly nudge"`) and it becomes the masthead: the name on the left, the label on the right. Every email on the shared layout passes a label.
- Cards are always left-aligned; `Card center` is ignored. A test (`src/test/email-look.test.tsx`) fails if an email goes back to a bare wordmark, a centered card or a centered sign-off.
- `Signoff`: Victoria's handwritten sign-off. `name` is `Victoria`, `Vicki` or `Vic` and picks the image in `public/email/`. Use it on conversational emails (check-ins, nudges, the newsletter). Leave it off verification, receipt and invite emails.
- `Mark`: orange highlighter for a count or number. Never on something clickable. Green stays the only button color.
- `MarginNote`: a short handwritten aside. Falls back to a cursive system font outside Apple Mail.

Gmail ignores web fonts, so the display and hand fonts only show in Apple Mail and similar clients. The signature and bookmark are PNGs for that reason. They load from `NEXT_PUBLIC_APP_URL` (default `https://launchyournextchapter.com`), so they only appear once a build that contains `public/email/` is live.

- `Headline` draws the hand-drawn squiggle under every headline (`squiggle={false}` turns it off). The line follows the card's alignment.
- `LinkButton` is the green pill for a signed, one-time link (invite, confirm, sign-in). It leaves the URL exactly as given, with no UTM tags. `Button` adds the tags and is for ordinary links.

Every email except the internal staff ones is now on this look: the invite, reference, verification and digest emails that used a plain layout were moved onto the shared cards. The staff emails (`admin-*`, the visitor digest, the layoff context alert, PR hook and product-positioning alerts) keep their plain layout on purpose.

Signed by Victoria: the conversational candidate emails (newsletter, check-ins, nudges, kickoff, finish line, Saturday check-in, weekly read, journey plan, registration reminder, win-back, lead follow-ups). Not on invites, verification, reference or employer emails.
