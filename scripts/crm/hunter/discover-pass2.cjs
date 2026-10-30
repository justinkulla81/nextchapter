// Round 2: per-buyer-type Discover (free) with name-relevance gate, dedupe vs CRM and round 1, then Domain Search.
// usage: node scripts/crm/hunter/discover-pass2.cjs [perCat=40] [reserve=60]
const fs=require('fs');
const root=process.cwd();
const env=Object.fromEntries(fs.readFileSync(root+'/.env.local','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}));
process.env.DATABASE_URL=env.DATABASE_URL;
const {PrismaClient}=require(root+'/node_modules/@prisma/client');
const db=new PrismaClient(); const KEY=env.HUNTER_API_KEY; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PER=+process.argv[2]||40, RESERVE=+process.argv[3]||60; const ROUND=process.env.ROUND||'round2'; const PERCAT=process.env.PERCAT?JSON.parse(process.env.PERCAT):{};
const R1=process.env.HOME+'/nc-hunter-results/2026-10-30-discover/discover-people.csv';
const CATS={
 provider:{dept:'executive,management,hr,sales,communication',name:/goodwill|urban league|vocational|catholic charities|eckerd|workforce|career|employment|training|jobs|works\b|opportunit|ymca|salvation|lutheran|community action|connects|job corps|seta|ses\b|work\b/i,
   q:['nonprofit that operates American Job Centers and dislocated worker programs under WIOA in the United States','Goodwill or Urban League or Jewish Vocational Service workforce and career services in the United States','workforce development nonprofit employment and training services United States','Goodwill Industries local chapter job training and career services','Easterseals or Catholic Charities or Lutheran Services employment and training programs','career pathways and professional reentry nonprofit for laid-off and unemployed adults in the United States','one-stop career center operator and workforce training contractor United States']},
 college:{dept:'executive,management,education',name:/college|technical|community|polytechnic/i,
   q:['community college workforce development and continuing education division United States','technical college corporate training and dislocated worker services United States','community college career pathways and adult learner reskilling center United States','community college Small Business Development Center and workforce innovation United States']},
 advisers:{dept:'executive,management,legal',name:/law|legal|llp|attorney|restructuring|advis|peo\b|benefit|partners|employer services|hr\b|human/i,
   q:['employment law firm advising employers on layoffs and WARN Act compliance in the United States','restructuring and turnaround advisory firm United States','professional employer organization PEO and HR outsourcing United States','employee benefits broker and consultant United States','WARN Act and mass layoff legal counsel for employers United States','severance and reduction in force employment attorneys United States','HR consulting firm that advises on workforce reductions and restructuring United States']},
 assoc:{dept:'executive,management,communication,sales',name:/association|society|institute|union|council|chapter|afl|federation|guild|alliance|network|forum/i,
   q:['professional association member benefits and career services for engineers accountants nurses United States','labor union and trade association member services United States','HR professional association SHRM chapter United States','federal employee and white collar professional union member services United States','alumni and professional society offering career transition services to members United States']},
 gov:{dept:'executive,management,hr',name:/state of|department|county|city of|commission|economic development|authority|workforce|labor|board|council/i,
   q:['state economic development agency and labor department United States','county workforce and economic development office United States']},
 eap:{dept:'executive,management,sales,hr',name:/eap|employee assistance|assistance|insur|benefit|wellness|health|lyra|spring|workplace|resilien|mental|life/i,
   q:['employee assistance program EAP provider United States','employee benefits platform offering career transition and mental health support United States','employee assistance program provider serving large employers United States','PEO and HR outsourcing firm serving mid-size employers United States']},
}
const COMPETITORS=/(^|\.)(right|lhh|risesmart|randstadrisesmart|intoo|careerminds|kornferry|challengergray|manpower(group)?|adeccogroup|ajilon|hudson|orionhr|ivyexec|ipeccoaching)\./i;
const COACH=/coach|resume|resumé|cv\b|career counsel|job search|interview/i;
const BADTLD=/\.(fr|uk|ca|au|nz|de|es|it|in|ch|nl|be|se|no|dk|ie|za|br|mx|ar|cl|jp|cn|kr|sg|hk|ph|pk|ng|ke|eu|int|ru|pl)$/i;
const norm=s=>String(s||'').toLowerCase().replace(/&/g,' and ').replace(/\b(inc|llc|llp|ltd|corp|corporation|co|company|the|of)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
(async()=>{
  const orgs=await db.$queryRawUnsafe(`select name, lower(coalesce("emailDomain", nullif(regexp_replace(coalesce(website,''),'^https?://(www\\\\.)?([^/]+).*$','\\\\2'),''))) d from "CrmOrganization"`);
  const haveD=new Set(orgs.map(o=>o.d).filter(Boolean)), haveN=new Set(orgs.map(o=>norm(o.name)));
  (await db.$queryRawUnsafe(`select distinct lower(split_part(email,'@',2)) d from "CrmPerson" where email is not null`)).forEach(r=>haveD.add(r.d));
  const emails=new Set((await db.$queryRawUnsafe(`select lower(e) e from (select unnest(emails) e from "CrmPerson" union select email from "CrmPerson" where email is not null) x`)).map(r=>r.e));
  try{fs.readFileSync(R1,'utf8').split('\n').forEach(l=>{const m=l.match(/,"([a-z0-9.-]+\.[a-z]+)","/);if(m)haveD.add(m[1])})}catch{}
  const acct=(await (await fetch(`https://api.hunter.io/v2/account?api_key=${KEY}`)).json()).data.requests.searches;
  let avail=acct.available-acct.used-RESERVE; console.log('searches available',avail);
  const hdr=['category','org','domain','first','last','position','department','seniority','email','confidence','verification','alreadyInCRM'];
  fs.writeFileSync(`${ROUND}-people.csv`,hdr.map(q).join(',')+'\n');
  const summary={};
  for(const [cat,cfg] of Object.entries(CATS)){
    const cand=new Map();
    for(const query of cfg.q) for(const off of [0,100,200,300]){
      const r=await fetch(`https://api.hunter.io/v2/discover?api_key=${KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,limit:100,offset:off})}).then(r=>r.json()).catch(()=>({}));
      for(const x of r.data||[]){const d=String(x.domain).toLowerCase(); if(!cand.has(d))cand.set(d,{domain:d,name:x.organization,personal:(x.emails_count||{}).personal||0})}
      if(!(r.data||[]).length)break;
    }
    const all=[...cand.values()];
    const keep=all.filter(c=>!COMPETITORS.test(c.domain+'.')&&!BADTLD.test(c.domain)&&!COACH.test(c.name)&&cfg.name.test(c.name+' '+c.domain)&&!haveD.has(c.domain)&&!haveN.has(norm(c.name))&&c.personal>=3)
      .sort((a,b)=>b.personal-a.personal);
    const list=keep.slice(0,Math.min(PERCAT[cat]??PER,avail)); avail-=list.length;
    summary[cat]={discovered:all.length,keepers:keep.length,searched:list.length,people:0};
    let i=0; async function worker(){while(true){const o=list[i++];if(!o)return;
      const qp=new URLSearchParams({domain:o.domain,limit:'6',seniority:'senior,executive',department:cfg.dept,type:'personal',api_key:KEY});
      let j=null;for(let a=0;a<5;a++){const res=await fetch('https://api.hunter.io/v2/domain-search?'+qp);const t=await res.text();if(/too_many/.test(t)||res.status===202){await sleep(6000);continue}try{j=JSON.parse(t)}catch{}break}
      for(const e of (j&&j.data&&j.data.emails)||[]){summary[cat].people++;fs.appendFileSync(`${ROUND}-people.csv`,[cat,o.name,o.domain,e.first_name,e.last_name,e.position,e.department,e.seniority,e.value,e.confidence,e.verification&&e.verification.status||'',emails.has((e.value||'').toLowerCase())?'yes':''].map(q).join(',')+'\n')}
    }} await Promise.all(Array.from({length:3},worker));
    fs.writeFileSync(`${ROUND}-${cat}-keepers.json`,JSON.stringify(list,null,1));
    console.log(cat,JSON.stringify(summary[cat]));
  }
  await db.$disconnect();
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
