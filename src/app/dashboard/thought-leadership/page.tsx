import { ThoughtLeadershipStudio } from '@/components/dashboard/ThoughtLeadershipStudio'

export default function ThoughtLeadershipPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Thought Leadership Studio</h1>
        <p className="mt-1 text-muted-foreground">
          Post ideas grounded in your actual background — pick one, get a draft, edit it so it sounds like you,
          and post.
        </p>
      </div>
      <ThoughtLeadershipStudio />
    </div>
  )
}
