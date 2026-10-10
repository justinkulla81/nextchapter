// Well-known institutions and the names people write for them. This is the seed for
// the canonical School table — enough to resolve the common spellings and
// abbreviations ("MIT", "Univ. of Michigan", "Wharton") on day one. Anything not here
// is still handled: it becomes its own School and, if it looks like a variant of a
// known one, goes to review rather than being guessed (see school-match.ts).
//
// Format: "Canonical name | alias; alias; ..." — aliases are matched whole, after
// normalisation, so listing "mit" does not make "smith college" match.

const SEED_LINES = `
Massachusetts Institute of Technology | MIT; M.I.T.; MIT Sloan; Sloan School of Management; MIT Sloan School of Management; Sloan
Harvard University | Harvard; Harvard College; Harvard Business School; HBS; Harvard Law School; Harvard Kennedy School; HKS; Harvard Graduate School of Education; Harvard Extension School; Harvard Medical School; Harvard T.H. Chan School of Public Health
Stanford University | Stanford; Stanford GSB; Stanford Graduate School of Business; Stanford Law School
Yale University | Yale; Yale School of Management; Yale SOM; Yale Law School
Princeton University | Princeton
Columbia University | Columbia; Columbia Business School; CBS; Columbia Law School; Columbia University in the City of New York
University of Pennsylvania | Penn; UPenn; U Penn; Wharton; The Wharton School; Wharton School; University of Pennsylvania Wharton School
Cornell University | Cornell; Johnson Graduate School of Management; Cornell Johnson; SC Johnson College of Business
Brown University | Brown
Dartmouth College | Dartmouth; Tuck School of Business; Tuck
Duke University | Duke; Fuqua School of Business; Duke Fuqua; Fuqua
Northwestern University | Northwestern; Kellogg School of Management; Kellogg; Northwestern Kellogg
University of Chicago | UChicago; U Chicago; Chicago Booth; Booth School of Business; University of Chicago Booth School of Business; Booth
Johns Hopkins University | Johns Hopkins; JHU; Hopkins
Carnegie Mellon University | Carnegie Mellon; CMU; Tepper School of Business; Tepper
California Institute of Technology | Caltech; Cal Tech
New York University | NYU; N.Y.U.; NYU Stern; Stern School of Business; Leonard N. Stern School of Business; NYU Law
University of Southern California | USC; U.S.C.; USC Marshall; Marshall School of Business
University of California, Los Angeles | UCLA; U.C.L.A.; UC Los Angeles; University of California Los Angeles; UCLA Anderson; Anderson School of Management
University of California, Berkeley | UC Berkeley; UCB; Cal; Berkeley; University of California Berkeley; Haas School of Business; Berkeley Haas; Haas
University of California, San Diego | UCSD; UC San Diego; University of California San Diego
University of California, Davis | UC Davis; UCD; University of California Davis
University of California, Irvine | UC Irvine; UCI; University of California Irvine
University of California, Santa Barbara | UCSB; UC Santa Barbara; University of California Santa Barbara
University of Michigan | UMich; U of M; U-M; Michigan; University of Michigan Ann Arbor; University of Michigan-Ann Arbor; Univ of Michigan; Ross School of Business; Michigan Ross; Ross
Michigan State University | MSU; Michigan State
The Ohio State University | Ohio State; OSU; Ohio State University; Fisher College of Business
Pennsylvania State University | Penn State; PSU; The Pennsylvania State University
University of Illinois Urbana-Champaign | UIUC; University of Illinois at Urbana-Champaign; University of Illinois; Illinois; U of I
University of Wisconsin-Madison | UW Madison; UW-Madison; University of Wisconsin; University of Wisconsin Madison; Wisconsin
University of Minnesota | UMN; University of Minnesota Twin Cities; Minnesota; Carlson School of Management
Indiana University | IU; Indiana University Bloomington; Kelley School of Business; Kelley
Purdue University | Purdue
University of Texas at Austin | UT Austin; UT-Austin; University of Texas Austin; University of Texas; UT; McCombs School of Business; McCombs
Texas A&M University | Texas A&M; TAMU; A&M
Rice University | Rice; Jones Graduate School of Business
Georgia Institute of Technology | Georgia Tech; GT; Georgia Institute of Technology Atlanta
Emory University | Emory; Goizueta Business School; Goizueta
University of North Carolina at Chapel Hill | UNC; UNC Chapel Hill; UNC-Chapel Hill; University of North Carolina; University of North Carolina Chapel Hill; Kenan-Flagler Business School; Kenan-Flagler
North Carolina State University | NC State; NCSU; North Carolina State
University of Virginia | UVA; U.Va.; University of Virginia Charlottesville; Darden School of Business; Darden
Virginia Tech | Virginia Polytechnic Institute and State University; VT; Virginia Tech University
University of Florida | UF; Florida; Warrington College of Business
Florida State University | FSU; Florida State
University of Washington | UW; U of W; University of Washington Seattle; Foster School of Business
Boston University | BU; B.U.; Questrom School of Business; Questrom
Boston College | BC; Carroll School of Management
Northeastern University | Northeastern; NEU
Tufts University | Tufts; Fletcher School; The Fletcher School
Brandeis University | Brandeis
University of Massachusetts Amherst | UMass Amherst; UMass; UMASS; University of Massachusetts; Isenberg School of Management
University of Notre Dame | Notre Dame; ND; Mendoza College of Business
Vanderbilt University | Vanderbilt; Vandy; Owen Graduate School of Management
Washington University in St. Louis | WashU; Wash U; WUSTL; Washington University; Washington University in Saint Louis; Olin Business School; Olin
Georgetown University | Georgetown; McDonough School of Business; McDonough
George Washington University | GWU; GW; The George Washington University; GWU School of Business
George Mason University | GMU; George Mason
American University | AU; American U; Kogod School of Business
University of Maryland | UMD; University of Maryland College Park; University of Maryland, College Park; Maryland; Smith School of Business
Rutgers University | Rutgers; Rutgers State University of New Jersey; Rutgers New Brunswick
University of Pittsburgh | Pitt; University of Pittsburgh Pittsburgh; Katz Graduate School of Business
Syracuse University | Syracuse; Whitman School of Management
University of Rochester | Rochester; Simon Business School
Case Western Reserve University | Case Western; CWRU; Weatherhead School of Management
University of Connecticut | UConn; U Conn
University of Colorado Boulder | CU Boulder; University of Colorado; Colorado Boulder; Leeds School of Business
University of Arizona | UA; U of A; Arizona; Eller College of Management
Arizona State University | ASU; Arizona State; W. P. Carey School of Business; WP Carey
University of Utah | Utah; U of U; Eccles School of Business
Brigham Young University | BYU; Marriott School of Business
University of Oregon | UO; Oregon
University of Iowa | Iowa; UIowa; Tippie College of Business
University of Wisconsin-Milwaukee | UWM; UW Milwaukee
Wake Forest University | Wake Forest; Wake
Tulane University | Tulane; A. B. Freeman School of Business
Southern Methodist University | SMU; Cox School of Business
Villanova University | Villanova
Fordham University | Fordham; Gabelli School of Business
Babson College | Babson; F. W. Olin Graduate School of Business
Bentley University | Bentley
Seton Hall University | Seton Hall
University of Delaware | UD; Delaware; Lerner College of Business
McGill University | McGill; Desautels Faculty of Management
University of Toronto | UofT; U of T; Toronto; Rotman School of Management; Rotman
University of British Columbia | UBC; Sauder School of Business
Oxford University | University of Oxford; Oxford; Said Business School; Oxford Saïd
Cambridge University | University of Cambridge; Cambridge; Judge Business School
London School of Economics | LSE; London School of Economics and Political Science
London Business School | LBS
INSEAD | Institut Europeen d'Administration des Affaires
`.trim()

export interface SchoolSeed {
  name: string
  aliases: string[]
}

export const SCHOOL_SEEDS: SchoolSeed[] = SEED_LINES.split('\n').map((line) => {
  const [name, aliases = ''] = line.split('|').map((p) => p.trim())
  return { name, aliases: aliases.split(';').map((a) => a.trim()).filter(Boolean) }
})
