import json, os, sys, time, re, html, urllib.request, urllib.error, concurrent.futures as cf, datetime, threading
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","sources")+os.sep
KEY=os.environ["K"]; URL="https://launchyournextchapter.com/api/admin/jobs/import"

def _confirm(urls):
    body=json.dumps({"confirmUrls":urls,"dryRun":os.environ.get("DRY")=="1"}).encode()
    for a in range(4):
        try:
            r=urllib.request.Request(URL,data=body,method="POST",headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
            return json.load(urllib.request.urlopen(r,timeout=120))
        except Exception: time.sleep(3*(a+1))
    return {}
def post(jobs,*a):
    # REFRESH=1: confirm the jobs we already hold with one narrow update; send only the rest in full.
    if os.environ.get("DRY")=="1":
        got=_confirm([j["url"] for j in jobs]).get("confirmedUrls",[]); out={"updated":len(got)}; out["skipped"]=[]; return out
    if os.environ.get("REFRESH")=="1" and not (a and a[0]):
        got=set(_confirm([j["url"] for j in jobs]).get("confirmedUrls",[]))
        rest=[j for j in jobs if j["url"] not in got]
        for j in rest:
            d=j.pop("_d",None)
            if d:
                info=((get(d) or {}).get("jobPostingInfo")) or {}
                j["description"]=info.get("jobDescription"); j["postedAt"]=info.get("startDate")
                loc=j.pop("_loc","")
                if info.get("location") and re.match(r"^\d+ Locations?$",loc): loc=info["location"]
                if isinstance(info.get("country"),dict) and "," not in loc: loc=loc+", "+info["country"]["descriptor"]
                j["location"]=loc
        out=dict(_post(rest,*a)) if rest else {}
        out["updated"]=(out.get("updated",0) or 0)+len(got); return out
    return _post(jobs,*a)

UA="Mozilla/5.0 (compatible; NextChapterJobs/1.0)"
def _paused():
    f=os.environ.get("BACKOFF_FILE")
    if not f or not os.path.exists(f): return set()
    d=json.load(open(f)); ks=d.keys() if isinstance(d,dict) else d
    return {str(k).lower() for k in ks}
PAUSED=_paused(); STOPPED=set(); SKIPPED_PAUSED=[]
_rl=__import__('threading').Lock(); _last=[0.0]
def _pace(url):
    if 'myworkdayjobs' not in url: return
    with _rl:
        w=_last[0]+float(os.environ.get('WD_GAP','0.9'))-time.time()
        if w>0: time.sleep(w)
        _last[0]=time.time()
def get(url, data=None, headers=None, timeout=40):
    if 'myworkdayjobs' in url and url.split('/')[2].lower() in STOPPED: return None  # a host that challenged us stays left alone
    _pace(url)
    for a in range(6):
        try:
            h={"User-Agent":UA,"Accept":"application/json"}; h.update(headers or {})
            r=urllib.request.Request(url,data=data,headers=h,method="POST" if data is not None else "GET")
            return json.load(urllib.request.urlopen(r,timeout=timeout))
        except urllib.error.HTTPError as e:
            if e.code in (429,403) and 'myworkdayjobs' in url:
                STOPPED.add(url.split('/')[2].lower()); return None  # a host that challenges us is left alone, not retried
            if e.code in (429,503): time.sleep(10*(a+1)); _pace(url); continue
            return None
        except Exception: time.sleep(2)
    return None
def _post(jobs):
    body=json.dumps({"jobs":jobs}).encode()
    for a in range(4):
        try:
            r=urllib.request.Request(URL,data=body,method="POST",headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
            return json.load(urllib.request.urlopen(r,timeout=280))
        except Exception as e: time.sleep(5*(a+1))
    return {}
now=lambda: datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
def J(title,emp,loc,url,desc,posted,src):
    return {"title":title,"companyName":emp,"location":loc,"url":url,"description":desc,"postedAt":posted,"sourceCategory":"employer","sourceName":src,"directListing":True,"addedBy":"bulk_import","lastVerifiedAt":now()}
def greenhouse(s):
    d=get(f"https://boards-api.greenhouse.io/v1/boards/{s['token']}/jobs?content=true")
    for j in (d or {}).get("jobs",[]):
        yield J(j["title"],s["employer"],(j.get("location") or {}).get("name"),j["absolute_url"],html.unescape(j.get("content") or ""),j.get("first_published") or j.get("updated_at"),"Greenhouse")
def lever(s):
    d=get(f"https://api.lever.co/v0/postings/{s['token']}?mode=json")
    for j in d or []:
        c=j.get("categories") or {}
        yield J(j["text"],s["employer"],c.get("location"),j["hostedUrl"],j.get("description") or j.get("descriptionPlain"),
          datetime.datetime.fromtimestamp(j["createdAt"]/1000,datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if j.get("createdAt") else None,"Lever")
def ashby(s):
    d=get(f"https://api.ashbyhq.com/posting-api/job-board/{s['token']}?includeCompensation=true")
    for j in (d or {}).get("jobs",[]):
        yield J(j["title"],s["employer"],j.get("location") or ("Remote" if j.get("isRemote") else None),j["jobUrl"],j.get("descriptionHtml") or j.get("descriptionPlain"),j.get("publishedAt"),"Ashby")
def workday(s):
    if f"{s['tenant']}.{s['wd']}.myworkdayjobs.com".lower() in PAUSED:
        SKIPPED_PAUSED.append(s['tenant']); return
    base=f"https://{s['tenant']}.{s['wd']}.myworkdayjobs.com"; api=f"{base}/wday/cxs/{s['tenant']}/{s['site']}"
    off=0; tot=None
    while True:
        d=get(api+"/jobs",data=json.dumps({"limit":20,"offset":off,"searchText":"","appliedFacets":{}}).encode(),headers={"Content-Type":"application/json"})
        if not d or not d.get("jobPostings"): break
        tot=d.get("total",tot)
        for j in d["jobPostings"]:
            p=j.get("externalPath")
            if not p: continue
            loc=j.get("locationsText") or ""
            desc=None
            if os.environ.get("REFRESH")=="1":
                jj=J(j["title"],s["employer"],loc,base+"/"+s["site"]+p,None,None,"Workday"); jj["_d"]=api+p; jj["_loc"]=loc; yield jj; continue
            if re.match(r"^\d+ Locations?$",loc) or True:
                det=get(api+p)
                info=(det or {}).get("jobPostingInfo") or {}
                desc=info.get("jobDescription"); 
                if info.get("location") and re.match(r"^\d+ Locations?$",loc): loc=info["location"]+(", "+info["country"]["descriptor"] if isinstance(info.get("country"),dict) else "")
                elif isinstance(info.get("country"),dict) and "," not in loc: loc=loc+", "+info["country"]["descriptor"]
            yield J(j["title"],s["employer"],loc,base+"/"+s["site"]+p,desc,(info.get("startDate") if desc else None),"Workday")
        off+=20
        if tot is not None and off>=tot: break
        if off>=2000: break

def smartrecruiters(s):
    off=0
    while True:
        d=get(f"https://api.smartrecruiters.com/v1/companies/{s['slug']}/postings?limit=100&offset={off}")
        c=(d or {}).get("content") or []
        for j in c:
            l=j.get("location") or {}
            loc=", ".join(p for p in (l.get("city"),(l.get("region") or "").upper() if len(l.get("region") or "")==2 else l.get("region"),(l.get("country") or "").upper()) if p)
            if (l.get("country") or "").lower() not in ("us","usa",""): continue
            yield J(j["name"],s["employer"],loc+(", United States" if loc else ""),f"https://jobs.smartrecruiters.com/{s['slug']}/{j['id']}",None,j.get("releasedDate"),"SmartRecruiters")
        off+=100
        if len(c)<100 or off>=1000: break
def recruitee(s):
    d=get(f"https://{s['slug']}.recruitee.com/api/offers/")
    for j in (d or {}).get("offers",[]):
        yield J(j["title"],s["employer"],j.get("location") or j.get("city"),j.get("careers_url"),j.get("description"),j.get("published_at"),"Recruitee")
def breezy(s):
    d=get(f"https://{s['slug']}.breezy.hr/json")
    for j in d or []:
        l=j.get("location") or {}
        yield J(j["name"],s["employer"],l.get("name") if isinstance(l,dict) else l,j["url"],j.get("description"),j.get("published_date"),"Breezy")
def bamboohr(s):
    d=get(f"https://{s['slug']}.bamboohr.com/careers/list")
    for j in (d or {}).get("result",[]):
        l=j.get("location") or {}
        loc=", ".join(p for p in (l.get("city"),l.get("state")) if p)
        yield J(j["jobOpeningName"],s["employer"],loc+(", United States" if loc else ""),f"https://{s['slug']}.bamboohr.com/careers/{j['id']}",None,None,"BambooHR")

def oracle(s):
    off=0
    while True:
        u=f"https://{s['host']}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber={s['site']},limit=50,offset={off},sortBy=POSTING_DATES_DESC"
        d=get(u); it=((d or {}).get("items") or [{}])[0]; rl=it.get("requisitionList") or []
        for j in rl:
            loc=j.get("PrimaryLocation") or ""
            yield J(j["Title"],s["employer"],loc,f"https://{s['host']}/hcmUI/CandidateExperience/en/sites/{s['site']}/job/{j['Id']}",j.get("ShortDescriptionStr"),j.get("PostedDate"),"Oracle")
        off+=50
        if len(rl)<50 or off>=3000: break
def eightfold(s):
    st=0
    while True:
        d=get(f"https://{s['tenant']}.eightfold.ai/api/apply/v2/jobs?domain={s['domain']}&start={st}&num=100")
        ps=(d or {}).get("positions") or []
        for j in ps:
            yield J(j["name"],s["employer"],j.get("location"),j.get("canonicalPositionUrl") or f"https://{s['tenant']}.eightfold.ai/careers?pid={j['id']}",j.get("job_description"),datetime.datetime.fromtimestamp(j["t_create"],datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if j.get("t_create") else None,"Eightfold")
        st+=100
        if len(ps)<100 or st>=3000: break
AD={"oracle":oracle,"eightfold":eightfold,"smartrecruiters":smartrecruiters,"recruitee":recruitee,"breezy":breezy,"bamboohr":bamboohr,"greenhouse":greenhouse,"lever":lever,"ashby":ashby,"workday":workday}
files=sys.argv[1].split(","); only=sys.argv[2] if len(sys.argv)>2 else None
srcs=[];seen=set()
for f in files:
    raw=json.load(open(R+f))
    if isinstance(raw,dict):
        raw=[dict(x,adapter=k) for k,v in raw.items() for x in v]
    for s in raw:
        if s.get("adapter") in AD and (not only or s["adapter"]==only):
            k=(s["adapter"],s.get("token") or s.get("slug") or (s.get("tenant") or s.get("host"),s.get("site")))
            if k in seen: continue
            if s.get("nameMatch") in ("weak",): continue
            seen.add(k); srcs.append(s)
print("sources",len(srcs),flush=True)
tot={"sources":0,"fetched":0,"created":0,"updated":0,"skipped":0}; lock=threading.Lock()
def work(s):
    buf=[]
    def flush():
        nonlocal buf
        if not buf: return
        r=post(buf)
        with lock:
            tot["created"]+=r.get("created",0) or 0; tot["updated"]+=r.get("updated",0) or 0; tot["skipped"]+=len(r.get("skipped",[]) or [])
        buf=[]
    try:
        for j in AD[s["adapter"]](s):
            buf.append(j)
            with lock: tot["fetched"]+=1
            if len(buf)>=100: flush()
    except Exception as e: print("ERR",s.get("name"),str(e)[:100],flush=True)
    flush()
    with lock: tot["sources"]+=1
    if tot["sources"]%5==0: print(tot,flush=True)
with cf.ThreadPoolExecutor(int(os.environ.get("T","12"))) as ex: list(ex.map(work,srcs))
print("DONE",tot,flush=True)
print("skipped as paused:",len(SKIPPED_PAUSED),"sites; stopped this run (429/403):",sorted(STOPPED),flush=True)
