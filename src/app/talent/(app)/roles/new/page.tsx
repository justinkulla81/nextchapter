import { RoleForm } from '@/components/talent/RoleForm'

export default function NewRolePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Post a role</h1>
        <p className="mt-1 text-muted-foreground">
          Takes about 5 minutes. Candidate matches surface as soon as it&apos;s posted.
        </p>
      </div>
      <RoleForm />
    </div>
  )
}
