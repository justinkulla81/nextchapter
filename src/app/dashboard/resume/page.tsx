import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResumeUploadForm } from '@/components/dashboard/ResumeUploadForm'
import { WorkHistoryForm } from '@/components/dashboard/WorkHistoryForm'
import { WorkHistoryList } from '@/components/dashboard/WorkHistoryList'
import { Card, CardContent } from '@/components/ui/card'
import { scoreToGrade, GRADE_LABEL } from '@/lib/scoring/grade'

export default async function ResumePage() {
  const profile = await getDashboardData()
  const admin = createAdminClient()

  const resumesWithLinks = await Promise.all(
    profile.resumes.map(async (resume) => {
      const { data } = await admin.storage.from('resumes').createSignedUrl(resume.filePath, 60 * 10)
      return { resume, signedUrl: data?.signedUrl ?? null }
    })
  )

  const latest = resumesWithLinks[0]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resume</h1>
        <p className="mt-1 text-muted-foreground">
          Upload your resume for an honest read on ATS readability and how results-oriented it is.
        </p>
      </div>

      <ResumeUploadForm />

      {latest && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Resume Analysis</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <p className="font-medium">{latest.resume.fileName}</p>
                {latest.signedUrl && (
                  <a
                    href={latest.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    View
                  </a>
                )}
              </div>

              {latest.resume.analysisError && (
                <p className="text-sm text-destructive">{latest.resume.analysisError}</p>
              )}

              {latest.resume.atsScore !== null && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    ATS readability: {scoreToGrade(latest.resume.atsScore)}{' '}
                    <span className="text-muted-foreground">
                      ({GRADE_LABEL[scoreToGrade(latest.resume.atsScore)]})
                    </span>
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {latest.resume.atsFeedback.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {latest.resume.resultsScore !== null && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Results orientation: {scoreToGrade(latest.resume.resultsScore)}{' '}
                    <span className="text-muted-foreground">
                      ({GRADE_LABEL[scoreToGrade(latest.resume.resultsScore)]})
                    </span>
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {latest.resume.resultsFeedback.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {latest.resume.experienceScore !== null && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Experience evaluation: {scoreToGrade(latest.resume.experienceScore)}{' '}
                    <span className="text-muted-foreground">
                      ({GRADE_LABEL[scoreToGrade(latest.resume.experienceScore)]})
                    </span>
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {latest.resume.experienceFeedback.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {latest.resume.actionItems.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-4">
                  <p className="text-sm font-medium">Your action plan</p>
                  <ul className="space-y-1.5 text-sm">
                    {latest.resume.actionItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span aria-hidden className="mt-0.5 text-muted-foreground">
                          ☐
                        </span>
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!latest.resume.atsScore && !latest.resume.analysisError && (
                <p className="text-sm text-muted-foreground">Analyzing…</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {resumesWithLinks.length > 1 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Previous uploads</h2>
          {resumesWithLinks.slice(1).map(({ resume, signedUrl }) => (
            <Card key={resume.id}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-medium">{resume.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {resume.uploadedAt.toLocaleDateString()}
                  </p>
                </div>
                {signedUrl && (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    View
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your work history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Feeds your Recruiter Report and What They See — fractional/interim/consulting roles
            are never labeled as such externally, so add them here without hesitation.
          </p>
        </div>
        <WorkHistoryList entries={profile.workHistory} />
        <WorkHistoryForm />
      </div>
    </div>
  )
}
