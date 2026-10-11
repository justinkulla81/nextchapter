const fs=require('fs');const root=process.cwd(); // run from the repo root
const env=Object.fromEntries(fs.readFileSync(root+'/.env.local','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}));
process.env.DATABASE_URL=env.DATABASE_URL;
const {PrismaClient}=require(root+'/node_modules/@prisma/client');const db=new PrismaClient();const KEY=env.HUNTER_API_KEY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MAX_SEARCHES=+process.argv[2]||400, MAX_PEOPLE=+process.argv[3]||300;
const TITLE=/chief (people|human|talent|hr)|chro|human resources|\bhr\b|people (&|and )?culture|people operations|talent|workforce|employee relations|labor relations|total rewards|learning|organizational development|head of people|vp.*people/i;
(async()=>{
  const have=new Set((await db.$queryRawUnsafe(`select lower(e) e from (select unnest(emails) e from "CrmPerson" union select email from "CrmPerson" where email is not null) x`)).map(r=>r.e));
  const emp=await db.$queryRawUnsafe(`
   select distinct on (lower(n."normalizedEmployer")) n.id, n.employer, n.state, n.employees, n."noticeDate", n."promotedOrgId",
     coalesce(org."emailDomain", nullif(regexp_replace(coalesce(org.website,''),'^https?://(www\\\\.)?([^/]+).*$','\\\\2'),'')) dom
   from "WarnNotice" n left join "CrmOrganization" org on org.id=n."promotedOrgId"
   where n."noticeDate" >= now() - interval '90 days' and n."dismissedAt" is null and coalesce(n.employees,0)>=100
   order by lower(n."normalizedEmployer"), n.employees desc nulls last`);
  emp.sort((a,b)=>(b.employees||0)-(a.employees||0));
  const list=emp.slice(0,MAX_SEARCHES);
  console.log('employers queued',list.length);
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  fs.writeFileSync('warn-hr.csv',['warnNoticeId','employer','state','employees','noticeDate','domain','first','last','position','department','seniority','email','confidence','verification','tag'].map(q).join(',')+'\n');
  let i=0,searches=0,people=0,stop=false;
  async function worker(){ while(!stop){ const e=list[i++]; if(!e) return;
    const qs=new URLSearchParams({limit:'10',seniority:'senior,executive',department:'hr,executive,management',type:'personal',api_key:KEY});
    e.dom?qs.set('domain',e.dom):qs.set('company',e.employer);
    let j=null; for(let a=0;a<5;a++){const res=await fetch('https://api.hunter.io/v2/domain-search?'+qs);const t=await res.text();if(/too_many/.test(t)||res.status===202){await sleep(6000);continue}try{j=JSON.parse(t)}catch{}break}
    searches++;
    const em=((j&&j.data&&j.data.emails)||[]).filter(x=>TITLE.test(x.position||'')&&!have.has((x.value||'').toLowerCase()));
    for(const x of em){ if(people>=MAX_PEOPLE){stop=true;break} people++;
      fs.appendFileSync('warn-hr.csv',[e.id,e.employer,e.state,e.employees,e.noticeDate&&new Date(e.noticeDate).toISOString().slice(0,10),(j.data.domain||e.dom||''),x.first_name,x.last_name,x.position,x.department,x.seniority,x.value,x.confidence,x.verification&&x.verification.status||'','warn-hr'].map(q).join(',')+'\n') }
  }}
  await Promise.all(Array.from({length:3},worker));
  console.log('searches',searches,'people',people);
  await db.$disconnect();
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
