// "Cite or link to this report": the exact citation line and the link snippet, on a monthly report page, so the people who quote its
// numbers (reporters, HR and workforce newsletters, college career offices) have one line to paste and a reason to link back.
export function CiteThisReport({ title, url, published }: { title: string; url: string; published: string }) {
  const citation = `NextChapter. ${title}. Published ${published}. ${url}`
  const link = `<a href="${url}">${title}, NextChapter</a>`
  return (
    <section aria-labelledby="cite-report" className="mb-6 rounded-xl border border-border bg-white p-5">
      <h2 id="cite-report" className="text-base font-semibold tracking-tight text-navy">Cite or link to this report</h2>
      <p className="mt-1 text-sm text-muted-foreground">Free to quote with a link back. Questions or corrections: see the press page.</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Citation</p>
      <p className="mt-1 select-all rounded-lg bg-off-white p-3 text-sm text-navy">{citation}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link for a web page or newsletter</p>
      <p className="mt-1 select-all break-all rounded-lg bg-off-white p-3 font-mono text-xs text-navy">{link}</p>
    </section>
  )
}
