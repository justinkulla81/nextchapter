// §13.1: "Show this line on every guided card (not a help link)." Used on
// every step where the candidate might be tempted to round a number up or
// invent one they can't back up in an interview.
export function InterviewComfortNote() {
  return (
    <p className="text-xs text-muted-foreground italic">
      Everything on your resume should be something you can talk about comfortably in an interview. If
      you&apos;re not sure, leave it out.
    </p>
  )
}
