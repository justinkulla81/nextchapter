import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SignupForm } from '@/components/auth/SignupForm'
import { NOINDEX } from '@/lib/seo/canonical'

export const metadata = NOINDEX

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join NextChapter free as a Member</CardTitle>
          <CardDescription>Free to join, always.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
    </div>
  )
}
