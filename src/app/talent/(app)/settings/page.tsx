import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { updateCompanyInfo, uploadMyProfilePicture, removeMyProfilePicture, toggleMyProfilePictureVisible } from './actions'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COMPANY_SIZE_OPTIONS, COMPANY_STAGE_OPTIONS } from '@/lib/constants/onboarding'

export default async function TalentSettingsPage() {
  const employer = await getTalentDashboardData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Your company info, shown on roles you post.</p>
      </div>

      <form action={updateCompanyInfo} className="max-w-md space-y-4 rounded-lg border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company name</Label>
          <Input id="companyName" name="companyName" required defaultValue={employer.companyName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyWebsite">Company website</Label>
          <Input id="companyWebsite" name="companyWebsite" defaultValue={employer.companyWebsite ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companySize">Company size</Label>
          <Select name="companySize" defaultValue={employer.companySize ?? 'Any'}>
            <SelectTrigger id="companySize" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) => value ?? 'Select one'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyStage">Company stage</Label>
          <Select name="companyStage" defaultValue={employer.companyStage ?? 'any'}>
            <SelectTrigger id="companyStage" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) =>
                  COMPANY_STAGE_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select one'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMPANY_STAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SubmitButton>Save changes</SubmitButton>
      </form>

      <div className="max-w-md space-y-3 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Your photo</p>
          <p className="text-sm text-muted-foreground">
            Shown to candidates in messaging only, once they&apos;ve been revealed to you.
          </p>
        </div>
        <AvatarUploadForm
          displayName={employer.contactName || employer.companyName}
          currentUrl={employer.profilePictureUrl}
          visible={employer.profilePictureVisible}
          uploadAction={uploadMyProfilePicture}
          removeAction={removeMyProfilePicture}
          toggleVisibilityAction={toggleMyProfilePictureVisible}
        />
      </div>

      <div className="max-w-md space-y-1 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">No-Ghosting Commitment</p>
        <p className="text-sm text-muted-foreground">
          {employer.noGhostingCommitmentAcceptedAt
            ? `Acknowledged on ${employer.noGhostingCommitmentAcceptedAt.toLocaleDateString()}.`
            : 'Not yet acknowledged.'}
        </p>
      </div>
    </div>
  )
}
