export function Greeting({ firstName }: { firstName: string | null }) {
  if (!firstName) return null
  return <p className="text-sm font-medium text-brand">Hi {firstName}</p>
}
