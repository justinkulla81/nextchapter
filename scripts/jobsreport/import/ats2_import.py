import json, os, sys, time, re, html, urllib.request, urllib.error, concurrent.futures as cf, datetime, threading
R="/home/user/nextchapter/scripts/jobsreport/sources/"
KEY=os.environ["K"]; URL="https://launchyournextchapter.com/api/admin/jobs/import"
UA="Mozilla/5.0 (compatible; NextChapterJobs/1.0)"
def get(url, data=None, headers=None, timeout=40):
    for a in range(3):
        try:
            h={"User-Agent":UA,"Accept":"application/json"}; h.update(headers or {})
            r=urllib.request.Request(url,data=data,headers=h,method="POST" if data is not None else "GET")
            return json.load(urllib.request.urlopen(r,timeout=timeout))
        except urllib.error.HTTPError as e:
            if e.code in (429,503): time.sleep(4*(a+1)); continue
            return None
        except Exception: time.sleep(2)
    return None
def post(jobs):
    body=json.dumps({"jobs":jobs}).encode()
    for a in range(4):
        try:
            r=urllib.request.Request(URL,data=body,method="POST",headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
            return json.load(urllib.request.urlopen(r,timeout=280))
        except Exception as e: time.sleep(5*(a+1))
    return {}
now=lambda: datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
def J(title,emp,loc,url,desc,posted,src):
    return {"title":title,"companyName":emp,"location":loc,"url":url,"description":desc,"postedAt":posted,"sourceCategory":"employer","sourceName":src,"directListing":True,"lastVerifiedAt":now()}
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
AD={"smartrecruiters":smartrecruiters,"recruitee":recruitee,"breezy":breezy,"bamboohr":bamboohr,"greenhouse":greenhouse,"lever":lever,"ashby":ashby,"workday":workday}
files=sys.argv[1].split(","); only=sys.argv[2] if len(sys.argv)>2 else None
srcs=[];seen=set()
for f in files:
    for s in json.load(open(R+f)):
        if s.get("adapter") in AD and (not only or s["adapter"]==only):
            k=(s["adapter"],s.get("token") or s.get("slug") or (s.get("tenant"),s.get("site")))
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
    if tot["sources"]%20==0: print(tot,flush=True)
with cf.ThreadPoolExecutor(int(os.environ.get("T","12"))) as ex: list(ex.map(work,srcs))
print("DONE",tot,flush=True)
