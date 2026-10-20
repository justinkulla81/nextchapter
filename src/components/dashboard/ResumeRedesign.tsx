import type { ResumeFixItem } from '@/lib/reports/market-reality-sections'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { SectionBlock } from '@/components/candidate/Blocks'
import { splitFirstView } from '@/lib/redesign/jobs-pages'
import { ResumeVersionsList, type ResumeVersionItem } from '@/components/dashboard/ResumeVersionsList'
import { ResumeUploadForm } from '@/components/dashboard/ResumeUploadForm'
import { ResumeExportForm } from '@/components/dashboard/ResumeExportForm'
import { ResumeFixCard } from '@/components/dashboard/ResumeFixCard'

// Résumé in the redesign: the versions with one verdict each, the first three fixes with their reasons, and the upload.
// Export and the rest of the fixes sit behind "Show more". Used by the page and by the dev-preview.
export function ResumeRedesign({
  versions,
  fixes,
  narratives,
  resumeBookOptIn,
  fromGap,
}: {
  versions: ResumeVersionItem[]
  fixes: ResumeFixItem[]
  narratives: { id: string; label: string }[]
  resumeBookOptIn: boolean
  fromGap?: string
}) {
  const { shown: firstFixes, rest: moreFixes } = splitFirstView(fixes, 3)
  const upload = <ResumeUploadForm narratives={narratives} resumeBookOptIn={resumeBookOptIn} redesign />
  const fixList = (items: typeof fixes) => (
    <div className="divide-y divide-border rounded-2xl border border-border">
      {items.map((item, i) => (
        <ResumeFixCard key={item.dimension + i} item={item} redesign />
      ))}
    </div>
  )
  return (
    <div className="space-y-8">
      <PageHeader
        title="Résumé"
        intro="Keep a version for each kind of role, and fix what stops a recruiter reading further."
        action={
          <ActionLink href="/dashboard/resume/studio" kind="primary" event="resume_studio_opened" props={{ source: 'resume_page', versions: versions.length, openFixes: fixes.length }}>
            Open resume studio
          </ActionLink>
        }
      />
      {versions.length === 0 && upload}
      {versions.length > 0 && <ResumeVersionsList versions={versions} fromGap={fromGap} redesign />}
      {fixes.length > 0 && (
        <div id="resume-fixes" className="scroll-mt-4">
          <SectionBlock id="fixes-h" title="What to fix first" why={`From your market reality report. ${fixes.length === 1 ? 'It says' : 'Each one says'} what is wrong and how to fix it.`}>
            {fixList(firstFixes)}
          </SectionBlock>
        </div>
      )}
      {versions.length > 0 && upload}
      <ShowMore page="resume" label={moreFixes.length > 0 ? `Show ${moreFixes.length} more ${moreFixes.length === 1 ? 'fix' : 'fixes'}, export and expert help` : 'Show export and expert help'}>
        {moreFixes.length > 0 && (
          <SectionBlock id="more-fixes-h" title="More to fix">
            {fixList(moreFixes)}
          </SectionBlock>
        )}
        <ResumeExportForm />
        <SectionBlock id="expert-h" title="Want a professional set of eyes?" why="On the writing and design, not just this automated read.">
          <div className="flex flex-wrap gap-4">
            <ActionLink href="https://enhancv.com" external kind="text" event="resume_expert_link_clicked" props={{ site: 'enhancv' }}>
              Enhancv
            </ActionLink>
            <ActionLink href="https://findmyprofession.com" external kind="text" event="resume_expert_link_clicked" props={{ site: 'findmyprofession' }}>
              Find My Profession (executive résumé writers)
            </ActionLink>
          </div>
        </SectionBlock>
      </ShowMore>
    </div>
  )
}
