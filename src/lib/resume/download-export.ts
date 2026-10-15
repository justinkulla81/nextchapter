'use client'

export type ResumeExportFormat = 'docx' | 'pdf'

/**
 * Asks /api/resume/export for a resume file and saves it from the browser. With a
 * `document` it exports exactly that (the editor's current text); without one the
 * server builds the resume from the candidate's profile. Throws an Error whose
 * message is safe to show.
 */
export async function downloadResumeExport(params: { templateId: string; format: ResumeExportFormat; document?: unknown }): Promise<void> {
  const response = await fetch('/api/resume/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error ?? 'Something went wrong generating your resume. Please try again.')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `resume.${params.format}`

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
