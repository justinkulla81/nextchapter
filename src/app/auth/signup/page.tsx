import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SignupForm } from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Build your profile — it&apos;s free</CardTitle>
          <CardDescription>Candidates are never charged, ever.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
    </div>
  )
}
