import { RoleForm } from '@/components/talent/RoleForm'
import { Squiggle } from '@/components/ui/squiggle'

export default function NewRolePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Post a role</h1>
        <Squiggle className="mt-2" />
        <p className="mt-1 text-muted-foreground">
          Takes about 5 minutes. Candidate matches surface as soon as it&apos;s posted.
        </p>
      </div>
      <RoleForm />
    </div>
  )
}
