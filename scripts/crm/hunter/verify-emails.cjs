// Verifies guessed CRM emails with Hunter. Read-only on the DB; writes a CSV. Capped by remaining free verifications.
const fs=require('fs');
const root=process.cwd(); // run from the repo root
const env=Object.fromEntries(fs.readFileSync(root+'/.env.local','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}));
process.env.DATABASE_URL=env.DATABASE_URL;
const {PrismaClient}=require(root+'/node_modules/@prisma/client');
const db=new PrismaClient();
const KEY=env.HUNTER_API_KEY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const acct=(await (await fetch(`https://api.hunter.io/v2/account?api_key=${KEY}`)).json()).data;
  const left=acct.requests.verifications.available-acct.requests.verifications.used;
  const cap=Math.min(left, +process.argv[2]||left);
  console.log('verifications remaining',left,'cap',cap);
  const done=new Set(['first5.csv','part1.csv','crm-email-verification-p2.csv'].flatMap(f=>fs.readFileSync(f,'utf8').split('\n').slice(1).filter(l=>/,"(deliverable|undeliverable|risky|unknown)",/.test(l)).map(l=>(l.match(/^"([^"]+)"/)||[])[1])).filter(Boolean));
  const g=await db.$queryRawUnsafe(`select p.id,p."fullName",p."guessedEmail" as addr,'guessed' as kind,p."guessedEmailBasis" as basis,p.priority::text as priority from "CrmPerson" p where p."guessedEmail" is not null and p."mergedIntoId" is null order by (p.priority is null), p.priority, p."priorityScore" desc`);
  const r2=await db.$queryRawUnsafe(`select p.id,p."fullName",p.email as addr,'real' as kind,'' as basis,p.priority::text as priority from "CrmPerson" p where p.email is not null and p.email<>'' and p."mergedIntoId" is null order by (p.priority is null), p.priority, p."priorityScore" desc`);
  const seen=new Set();
  const rows=[...g,...r2].filter(r=>{const k=r.addr.toLowerCase();if(done.has(r.id)||seen.has(k))return false;seen.add(k);return true}).slice(0,cap).map(r=>({...r,guessedEmail:r.addr,guessedEmailBasis:r.kind+(r.basis?': '+r.basis:'')}));
  console.log('queued',rows.length);
  const hdr=['id','name','priority','email','kind/basis','hunterResult','hunterStatus','score','smtpCheck','acceptAll','disposable','webmail'];
  const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  fs.writeFileSync('crm-email-verification-p3.csv',hdr.map(q).join(',')+'\n');
  const out=[hdr]; const tally={}; let i=0, stop=false, finished=0;
  async function worker(){
    while(!stop){
      const r=rows[i++]; if(!r) return;
      let j=null;
      for(let a=0;a<5;a++){
        const res=await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(r.guessedEmail)}&api_key=${KEY}`);
        if(res.status===202){await sleep(3000);continue}
        if(res.status===429||res.status===403){const t=await res.text();if(/too_many/.test(t)){await sleep(8000);continue}j=JSON.parse(t);break}
        j=await res.json(); break;
      }
      const d=(j&&j.data)||{};
      const key=d.result||('error:'+((j&&j.errors&&j.errors[0]&&j.errors[0].id)||'none'));
      tally[key]=(tally[key]||0)+1;
      const row=[r.id,r.fullName,r.priority||'',r.guessedEmail,r.guessedEmailBasis||'',d.result||'',d.status||'',d.score??'',d.smtp_check??'',d.accept_all??'',d.disposable??'',d.webmail??''];
      fs.appendFileSync('crm-email-verification-p3.csv',row.map(q).join(',')+'\n');
      out.push(row); finished++;
      if(finished%25===0) console.log('done',finished,JSON.stringify(tally));
      if(key.startsWith('error:')&&/credit|quota|insufficient/i.test(JSON.stringify(j))){console.log('stopping:',JSON.stringify(j).slice(0,200));stop=true}
    }
  }
  await Promise.all(Array.from({length:3},worker));
  console.log('rows verified',out.length-1,tally);
  await db.$disconnect();
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
