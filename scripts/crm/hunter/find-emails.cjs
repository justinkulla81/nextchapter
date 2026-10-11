const fs=require('fs');
const root=process.cwd(); // run from the repo root
const env=Object.fromEntries(fs.readFileSync(root+'/.env.local','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}));
process.env.DATABASE_URL=env.DATABASE_URL;
const {PrismaClient}=require(root+'/node_modules/@prisma/client');
const db=new PrismaClient(); const KEY=env.HUNTER_API_KEY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXCL=['INVESTOR_ANGEL','INVESTOR_VC','HIGHER_ED_ADMIN','HIGHER_ED_CAREER','HIGHER_ED_DEVELOPMENT','HIGHER_ED_EXEC_ED','ALUMNI_OFFICE','ADVISOR','RECRUITER_PROSPECT','OUTPLACEMENT_BUYER'];
(async()=>{
  const prior=new Set((fs.readFileSync('crm-email-find.csv','utf8')+fs.readFileSync('crm-email-find-2.csv','utf8')+fs.readFileSync('crm-email-find-3.csv','utf8')+fs.readFileSync('crm-email-find-4.csv','utf8')).split('\n').slice(1).map(l=>(l.match(/^"([^"]+)"/)||[])[1]).filter(Boolean));
  const rows0=await db.$queryRawUnsafe(`
  with aff as (select distinct on (a."personId") a."personId", a.title, o.name org, o."orgTypes"::text[] ot, coalesce(o."emailDomain", nullif(regexp_replace(coalesce(o.website,''),'^https?://(www\\.)?([^/]+).*$','\\2'),'')) dom
    from "CrmAffiliation" a join "CrmOrganization" o on o.id=a."orgId" where a."isCurrent" order by a."personId", a."isPrimary" desc, a."createdAt" desc)
  select p.id,p."fullName",p."firstName",p."lastName",coalesce(p.priority::text,'') pr,p.roles::text[] roles,p."guessedEmail",aff.org,aff.title,aff.dom,
   case when p.roles::text[] && array['HIGHER_ED_ADMIN','HIGHER_ED_CAREER','HIGHER_ED_DEVELOPMENT','HIGHER_ED_EXEC_ED','ALUMNI_OFFICE'] then 1
        when p.roles::text[] && array['OUTPLACEMENT_BUYER'] then 2
        when p.roles::text[] && array['INVESTOR_ANGEL','INVESTOR_VC','GRANTS'] then 3
        when aff.ot && array['UNIVERSITY','OUTPLACEMENT_LEAD','FUNDER_GRANT','VC_FUND','GOVERNMENT'] then 4
        when p.roles::text[] && array['ADVISOR'] then 5
        when p.roles::text[] && array['RECRUITER_PROSPECT'] then 6
        when p.roles::text[] && array['BD_PARTNER','GTM_PARTNER','STRATEGIC','INCUBATOR'] then 7 else 8 end bucket, p."priorityScore" sc
  from "CrmPerson" p left join aff on aff."personId"=p.id
  where (p.email is null or p.email='') and p."guessedEmail" is null and p."mergedIntoId" is null and p."deletedAt" is null and aff.org is not null`);
  const rows=rows0.filter(r=>!prior.has(r.id)).sort((x,y)=>x.bucket-y.bucket||Number(y.sc)-Number(x.sc));
  console.log('candidates',rows.length);
  const FLOOR=+process.argv[2]||280;
  let remaining=1e9; async function refresh(){const a=(await (await fetch(`https://api.hunter.io/v2/account?api_key=${KEY}`)).json()).data.requests.searches;remaining=a.available-a.used;}
  await refresh(); console.log('searches remaining',remaining,'floor',FLOOR);
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const hdr=['id','name','priority','roles','bucket','org','title','domainUsed','foundEmail','confidence','verification','sources','guessedEmail','note'];
  fs.writeFileSync('crm-email-find-5.csv',hdr.map(q).join(',')+'\n');
  const tally={}; let i=0,done=0,stop=false;
  async function worker(){
    while(!stop){
      if(done%20===0) await refresh();
      if(remaining<=FLOOR){stop=true;return}
      const r=rows[i++]; if(!r)return;
      const excluded=r.roles.some(x=>EXCL.includes(x));
      let note='',found=null;
      const fn=r.firstName||(r.fullName||'').split(' ')[0], ln=r.lastName||(r.fullName||'').split(' ').slice(1).join(' ');
      if(!(r.dom||r.org)||!fn||!ln){note=!fn||!ln?'no first/last name':'no organization';}
      else{
        const qs=new URLSearchParams({first_name:fn,last_name:ln,api_key:KEY}); if(r.dom)qs.set('domain',r.dom); else qs.set('company',r.org);
        for(let a=0;a<5;a++){
          const res=await fetch('https://api.hunter.io/v2/email-finder?'+qs);
          const t=await res.text();
          if(res.status===202||/too_many/.test(t)){await sleep(6000);continue}
          try{found=JSON.parse(t)}catch{found=null}; break;
        }
        const d=found&&found.data;
        if(d&&d.email){note='found';remaining--}else{note=(found&&found.errors&&found.errors[0]&&found.errors[0].id)||'not found'}
        if(/credit|quota|insufficient|payment/i.test(JSON.stringify(found&&found.errors||''))){stop=true}
      }
      const d=(found&&found.data)||{};
      tally[note]=(tally[note]||0)+1;
      fs.appendFileSync('crm-email-find-5.csv',[r.id,r.fullName,r.pr,r.roles.join('|'),r.bucket,r.org,r.title,r.dom||'',d.email||'',d.score??'',d.verification&&d.verification.status||'',(d.sources||[]).length||'',r.guessedEmail||'',note].map(q).join(',')+'\n');
      done++;
    }
  }
  await Promise.all(Array.from({length:3},worker));
  console.log('processed',done,'of',rows.length,JSON.stringify(tally));
  await db.$disconnect();
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
