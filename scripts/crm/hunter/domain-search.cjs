const fs=require('fs');
const root=process.cwd(); // run from the repo root
const env=Object.fromEntries(fs.readFileSync(root+'/.env.local','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}));
process.env.DATABASE_URL=env.DATABASE_URL;
const {PrismaClient}=require(root+'/node_modules/@prisma/client');
const db=new PrismaClient(); const KEY=env.HUNTER_API_KEY; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MAXORGS=+process.argv[2]||250, RESERVE=+process.argv[3]||30;
(async()=>{
  const acct=(await (await fetch(`https://api.hunter.io/v2/account?api_key=${KEY}`)).json()).data.requests.searches;
  const budget=Math.min(MAXORGS, acct.available-acct.used-RESERVE); console.log('budget',budget);
  const orgs=await db.$queryRawUnsafe(`select o.id,o.name,o."orgTypes"::text[] ot, coalesce(o."emailDomain", nullif(regexp_replace(coalesce(o.website,''),'^https?://(www\\\\.)?([^/]+).*$','\\\\2'),'')) dom,
    case when o."orgTypes"::text[] && array['OUTPLACEMENT_LEAD'] then 1 when o."orgTypes"::text[] && array['FUNDER_GRANT','VC_FUND'] then 2 when o."orgTypes"::text[] && array['EMPLOYER'] then 3 else 9 end b
    from "CrmOrganization" o where o."orgTypes"::text[] && array['OUTPLACEMENT_LEAD','FUNDER_GRANT','VC_FUND','EMPLOYER']
    order by b, (select count(*) from "CrmAffiliation" a where a."orgId"=o.id and a."isCurrent") desc`);
  const have=new Set((await db.$queryRawUnsafe(`select lower(e) e from (select unnest(emails) e from "CrmPerson" union select email from "CrmPerson" where email is not null) x`)).map(r=>r.e));
  const list=orgs.filter(o=>o.dom).slice(0,budget);
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const hdr=['orgId','org','orgTypes','domain','first','last','position','department','seniority','email','confidence','verification','alreadyInCRM'];
  fs.writeFileSync('crm-domain-search.csv',hdr.map(q).join(',')+'\n');
  let i=0,n=0,people=0,fresh=0;
  async function worker(){ while(true){ const o=list[i++]; if(!o)return;
    const qs=new URLSearchParams({domain:o.dom,limit:'10',seniority:'senior,executive',department:'executive,hr,management',type:'personal',api_key:KEY});
    let j=null; for(let a=0;a<5;a++){const res=await fetch('https://api.hunter.io/v2/domain-search?'+qs);const t=await res.text();if(/too_many/.test(t)||res.status===202){await sleep(6000);continue}try{j=JSON.parse(t)}catch{} break}
    const em=(j&&j.data&&j.data.emails)||[]; n++;
    for(const e of em){const dup=have.has((e.value||'').toLowerCase()); people++; if(!dup)fresh++;
      fs.appendFileSync('crm-domain-search.csv',[o.id,o.name,o.ot.join('|'),o.dom,e.first_name,e.last_name,e.position,e.department,e.seniority,e.value,e.confidence,e.verification&&e.verification.status||'',dup?'yes':''].map(q).join(',')+'\n');}
  }}
  await Promise.all(Array.from({length:3},worker));
  console.log('orgs searched',n,'people returned',people,'new to CRM',fresh);
  await db.$disconnect();
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
