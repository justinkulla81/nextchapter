// Prompt 76 — static, curated Victoria copy for detected rejections and
// offers, matching the existing voice guide (src/lib/victoria.ts): warm but
// direct for hard truths, first person, no generic motivational filler.
// Static rather than LLM-generated — a rejection reframe needs to land
// exactly right every time, not vary with model sampling, and this is cheap
// enough to just write well once.

const REJECTION_REFRAMES = [
  "I saw this one came back a no. That's a real loss of momentum, and I'm not going to pretend otherwise — but one company's decision isn't a verdict on you. Log what you can learn from it, then keep moving. I'm still in your corner. — Victoria",
  "This is a rejection, and it's okay to feel it. It doesn't erase the work you've put in or what you bring to the table — it means this particular fit wasn't right, for reasons that are usually more about them than you. Take the sting seriously, then get back to the actions that are actually in your control. — Victoria",
  "Not the outcome you wanted. I won't tell you it doesn't matter, because it does — but one closed door doesn't change your trajectory unless you let it stall you. What's next on your list this week? — Victoria",
]

const OFFER_CONGRATS = [
  "Wait — is this what I think it is?! An offer?! This is huge and you earned every bit of it. Take a minute to actually feel this before we talk next steps. — Vic",
  "YES. An offer! I've watched you put in the work for this, and it paid off. Congratulations — genuinely. Let's talk about negotiating it when you're ready. — Vic",
  "This is the moment. An offer, real and in your hands. However this next part goes, take today to actually celebrate it. — Vic",
]

export function getRejectionReframe(seed: number): string {
  return REJECTION_REFRAMES[seed % REJECTION_REFRAMES.length]
}

export function getOfferCongrats(seed: number): string {
  return OFFER_CONGRATS[seed % OFFER_CONGRATS.length]
}
