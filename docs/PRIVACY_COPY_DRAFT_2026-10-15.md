# Privacy copy to review (draft for counsel, not published)

The privacy policy was not edited. These are the new data flows from this release that its wording should be checked against. Suggested plain-language text follows each; have it reviewed before use.

1. **Coach session notes are sent to an AI service.** When a coach asks for a summary, the notes they wrote for that client are sent to Anthropic's API to write the summary. Only that coach's own notes are used, only when they click the button, and the summary is shown only to that coach.
   *Suggested:* "If a coach asks for a summary of their session notes, we send those notes to our AI provider to write it. We use only that coach's own notes, and the summary is visible only to the coach."

2. **Documents a coach requests.** A coach can ask a client for a file; the client chooses whether to upload it; it is stored privately and visible only to the client and the coach who asked, through short-lived links.
   *Suggested:* "If your coach asks you for a document, you decide whether to upload it. Only you and that coach can open it."

3. **Occupation matching and local pay.** To show where a member's skills point next, we match their latest job title (from their resume) to a government occupation list (O*NET, from the US Department of Labor), compare the skills on their resume with each occupation's, and look up public pay data (BLS) for their metro area or state. We save only the occupation they pick themselves and the target role they set; the automatic match is worked out again on each visit and not stored. This is plain database matching: no member data goes to an outside service for it. Two things sit beside it:
   - The count of advertised openings shown for a role (when switched on) sends only the occupation's name and the member's state, not anything about the member, to the job-ad data provider (Adzuna).
   - Usage analytics record which occupations a member looked at (for example the occupation codes of the roles opened), tied to their account, the same as other product analytics.

   *Suggested:* "To show where your skills could take you next, we match your latest job title to a US Department of Labor occupation list and compare your resume skills with it. We use your city and state to show typical pay for your area from the US Bureau of Labor Statistics. We save the occupation if you pick one yourself, and any target role you set, so you don't have to enter them again. You can change them, or clear them with one button, any time on the Pivot paths page. This matching runs on our own systems; we don't send your details to another company to do it."

   *Check before publishing:* the skill suggestions on the Skills page do call our AI provider with the member's resume keywords, confirmed skills, target role, industries and self-described strengths. That predates this release (it now also includes the target occupation's O*NET skills), but the policy should cover it in its own sentence, not be implied by the matching wording above. Also confirm the retention rule for the saved occupation and target role (the clear button on Pivot paths deletes both, leaves the resume and skills alone, and the automatic match is not stored at all).

4. **Coach session booking.** Booked sessions create an event on NextChapter's Google Calendar and invite the coach and the client by email address.
   *Suggested:* "If you book a session, we add it to a calendar we manage and send a calendar invitation to you and your coach."

5. **Outplacement program branding.** An employer can show its logo and colors to the people it enrolls. It does not receive their personal data.

Not covered: anything about agencies sharing participant data. If outcome reports for workforce boards are built, they need their own review.
