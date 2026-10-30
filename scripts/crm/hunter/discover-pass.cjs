// Discover (free) -> filter -> dedupe against CRM -> Domain Search on keepers. Writes CSVs into cwd.
// usage: node scripts/crm/hunter/discover-pass.cjs [maxOrgs=300] [reserve=60]
const fs=require('fs');
const root=process.cwd();
const env=Object.fromEntries(fs.readFileSync(root+'/.env.local','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}));
process.env.DATABASE_URL=env.DATABASE_URL;
const {PrismaClient}=require(root+'/node_modules/@prisma/client');
const db=new PrismaClient(); const KEY=env.HUNTER_API_KEY; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MAX=+process.argv[2]||300, RESERVE=+process.argv[3]||60;
const QUERIES={
 outplacement:['outplacement and career transition services for laid-off professionals in the United States','executive outplacement and career coaching firm in the United States','career transition consulting for displaced managers and white collar workers United States'],
 workforce:['nonprofit workforce development organization providing career services to dislocated workers in the United States','workforce development board contractor WIOA career services provider United States','community college dislocated worker program and career services United States','American Job Center operator workforce services United States'],
 coaching:['career coaching service for mid-career and senior professionals in the United States','job search coaching and resume services for professionals United States'],
}
const COMPETITORS=/(^|\.)(right|lhh|risesmart|randstadrisesmart|intoo|careerminds|kornferry|challengergray|manpower(group)?|adeccogroup|careerarc|ajilon|hudson|orionhr|gethiredcoach)\./i;
const NOISE=/staffing|recruit|military|usmc|mccs|army|navy|veteran|software|tech(nolog)?|solutions|pharma|bank|insurance|construction|environmental|consulting group/i;
const BADTLD=/\.(fr|uk|ca|au|nz|de|es|it|in|ch|nl|be|se|no|dk|ie|za|br|mx|ar|cl|jp|cn|kr|sg|hk|ph|pk|ng|ke|eu|int|ru|pl)$/i;
const norm=s=>String(s||'').toLowerCase().replace(/&/g,' and ').replace(/\b(inc|llc|llp|ltd|corp|corporation|co|company|the|of)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
(async()=>{
  const orgs=await db.$queryRawUnsafe(`select name, lower(coalesce("emailDomain", nullif(regexp_replace(coalesce(website,''),'^https?://(www\\\\.)?([^/]+).*$','\\\\2'),''))) d from "CrmOrganization"`);
  const haveD=new Set(orgs.map(o=>o.d).filter(Boolean)), haveN=new Set(orgs.map(o=>norm(o.name)));
  (await db.$queryRawUnsafe(`select distinct lower(split_part(email,'@',2)) d from "CrmPerson" where email is not null`)).forEach(r=>haveD.add(r.d));
  const peopleEmails=new Set((await db.$queryRawUnsafe(`select lower(e) e from (select unnest(emails) e from "CrmPerson" union select email from "CrmPerson" where email is not null) x`)).map(r=>r.e));
  const cand=new Map();
  for(const [cat,qs] of Object.entries(QUERIES)) for(const query of qs) for(const off of [0,100,200]){
    const r=await fetch(`https://api.hunter.io/v2/discover?api_key=${KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,limit:100,offset:off})}).then(r=>r.json()).catch(()=>({}));
    for(const x of r.data||[]){ const d=String(x.domain).toLowerCase(); if(!cand.has(d)) cand.set(d,{domain:d,name:x.organization,cat,personal:(x.emails_count||{}).personal||0}); }
    if(!(r.data||[]).length) break;
  }
  const rows=[...cand.values()]; const why={comp:0,tld:0,noise:0,inCRM:0,tiny:0};
  const keep=rows.filter(c=>{
    if(COMPETITORS.test(c.domain+'.')) {why.comp++;return false}
    if(BADTLD.test(c.domain)){why.tld++;return false}
    if(c.cat!=='workforce' && NOISE.test(c.name)){why.noise++;return false}
    if(haveD.has(c.domain)||haveN.has(norm(c.name))){why.inCRM++;return false}
    if(c.personal<3){why.tiny++;return false}
    return true;
  });
  console.log('discovered',rows.length,'dropped',JSON.stringify(why),'keepers',keep.length);
  fs.writeFileSync('discover-candidates.json',JSON.stringify(keep,null,1));
  const acct=(await (await fetch(`https://api.hunter.io/v2/account?api_key=${KEY}`)).json()).data.requests.searches;
  const budget=Math.min(MAX,acct.available-acct.used-RESERVE);
  // balance categories, then biggest email footprint first
  const by={}; keep.forEach(k=>(by[k.cat]??=[]).push(k)); Object.values(by).forEach(a=>a.sort((a,b)=>b.personal-a.personal));
  const list=[]; for(let i=0;list.length<budget&&i<500;i++) for(const c of Object.keys(by)) if(by[c][i]&&list.length<budget) list.push(by[c][i]);
  console.log('domain searches to run',list.length);
  const hdr=['category','org','domain','first','last','position','department','seniority','email','confidence','verification','alreadyInCRM'];
  fs.writeFileSync('discover-people.csv',hdr.map(q).join(',')+'\n');
  let i=0,n=0,people=0,fresh=0;
  async function worker(){ while(true){ const o=list[i++]; if(!o)return;
    const qp=new URLSearchParams({domain:o.domain,limit:'8',seniority:'senior,executive',department:'executive,hr,management,communication,sales',type:'personal',api_key:KEY});
    let j=null; for(let a=0;a<5;a++){const res=await fetch('https://api.hunter.io/v2/domain-search?'+qp);const t=await res.text();if(/too_many/.test(t)||res.status===202){await sleep(6000);continue}try{j=JSON.parse(t)}catch{} break}
    n++; for(const e of (j&&j.data&&j.data.emails)||[]){const dup=peopleEmails.has((e.value||'').toLowerCase());people++;if(!dup)fresh++;
      fs.appendFileSync('discover-people.csv',[o.cat,o.name,o.domain,e.first_name,e.last_name,e.position,e.department,e.seniority,e.value,e.confidence,e.verification&&e.verification.status||'',dup?'yes':''].map(q).join(',')+'\n');}
  }}
  await Promise.all(Array.from({length:3},worker));
  console.log('orgs searched',n,'people',people,'new emails',fresh);
  await db.$disconnect();
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
