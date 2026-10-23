/**
 * Titles that mean "runs HR for the whole company". One definition, two dialects: the
 * nightly job matches in Postgres (word boundary \y) and tests match in JavaScript (\b).
 * Narrow on purpose — talent-acquisition leads, regional HR leads, functional "Head of HR
 * <function>" roles, former and fractional titles and recruiting-practice titles are not CHROs.
 */
const B = '<B>'
const INCLUDE =
  `${B}chro${B}|chief (people|human resources|hr|human capital|talent|culture|employee experience)|head of (people|hr|human resources)${B}|(evp|svp|executive vice president|senior vice president)${B}.{0,40}?${B}(people|human resources|hr)${B}`
const EXCLUDE =
  `former|fractional|practice|${B}rpo${B}|recruitment|managing director|co-head|head of (hr|people|human resources) +(digital|process|services|operations|technology|systems|analytics|enablement|business partner)`

export const CHRO_TITLE_SQL = { include: INCLUDE.replaceAll(B, '\\y'), exclude: EXCLUDE.replaceAll(B, '\\y') }

const JS_INCLUDE = new RegExp(INCLUDE.replaceAll(B, '\\b'), 'i')
const JS_EXCLUDE = new RegExp(EXCLUDE.replaceAll(B, '\\b'), 'i')

export function isChroTitle(title: string | null | undefined): boolean {
  return !!title && JS_INCLUDE.test(title) && !JS_EXCLUDE.test(title)
}
