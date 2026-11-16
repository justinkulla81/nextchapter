import json,os,sys,time,datetime,urllib.request,concurrent.futures as cf,threading,html
KEY=os.environ["K"]; URL="https://launchyournextchapter.com/api/admin/jobs/import"

def _confirm(urls):
    body=json.dumps({"confirmUrls":urls}).encode()
    for a in range(4):
        try:
            r=urllib.request.Request(URL,data=body,method="POST",headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
            return json.load(urllib.request.urlopen(r,timeout=120))
        except Exception: time.sleep(3*(a+1))
    return {}
def post(jobs,*a):
    # REFRESH=1: confirm the jobs we already hold with one narrow update; send only the rest in full.
    if os.environ.get("REFRESH")=="1" and not (a and a[0]):
        got=set(_confirm([j["url"] for j in jobs]).get("confirmedUrls",[]))
        rest=[j for j in jobs if j["url"] not in got]
        out=dict(_post(rest,*a)) if rest else {}
        out["updated"]=(out.get("updated",0) or 0)+len(got); return out
    return _post(jobs,*a)

src=json.load(open("/home/user/nextchapter/scripts/jobsreport/sources/phenom-found.json"))
def http(u,data=None):
    r=urllib.request.Request(u,data=data,headers={"User-Agent":"Mozilla/5.0","Content-Type":"application/json","Accept":"application/json"})
    return urllib.request.urlopen(r,timeout=60).read().decode()
def _post(jobs):
    body=json.dumps({"jobs":jobs}).encode()
    for a in range(4):
        try:
            r=urllib.request.Request(URL,data=body,method="POST",headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
            return json.load(urllib.request.urlopen(r,timeout=280))
        except Exception: time.sleep(5*(a+1))
    return {}
tot={"hosts":0,"fetched":0,"created":0,"updated":0,"skipped":0}; lock=threading.Lock()
def work(s):
    host=s["host"]; base=f"https://{host}"; path="us/en"; country,lang=path.split("/")
    frm=0; total=None; buf=[]
    while (total is None or frm<total) and frm<10000:
        body={"lang":f"{lang}_{country}","deviceType":"desktop","country":country,"pageName":"search-results","ddoKey":"refineSearch","sortBy":"","subsearch":"","from":frm,"jobs":True,"counts":True,"all_fields":["category","type","country","state","city"],"pageType":"landingPage","size":50,"clearAll":False,"jdsource":"facets","isSliderEnable":False,"pageId":"page11","siteType":"external","keywords":"","global":True,"selected_fields":{},"locationData":{}}
        try: rs=json.loads(http(base+"/widgets",json.dumps(body).encode()))["refineSearch"]
        except Exception: break
        total=rs.get("totalHits",0); jobs=rs.get("data",{}).get("jobs",[])
        if not jobs: break
        now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        for j in jobs:
            loc=", ".join(x for x in (j.get("city"),j.get("state")) if x)
            if j.get("country") in ("United States","US","USA"): loc+=", United States"
            buf.append({"title":j.get("title",""),"companyName":s["employer"],"location":loc,"url":f"{base}/{path}/job/{j['jobSeqNo']}","description":html.unescape(j.get("descriptionTeaser") or ""),"postedAt":j.get("postedDate") or j.get("dateCreated"),"sourceCategory":"employer","sourceName":"Phenom","directListing":True,"addedBy":"bulk_import","lastVerifiedAt":now})
        frm+=len(jobs)
        if len(buf)>=100:
            r=post(buf); buf=[]
            with lock: tot["created"]+=r.get("created",0) or 0; tot["updated"]+=r.get("updated",0) or 0; tot["skipped"]+=len(r.get("skipped",[]) or [])
        with lock: tot["fetched"]+=len(jobs)
    if buf:
        r=post(buf)
        with lock: tot["created"]+=r.get("created",0) or 0; tot["updated"]+=r.get("updated",0) or 0; tot["skipped"]+=len(r.get("skipped",[]) or [])
    with lock: tot["hosts"]+=1
    print(tot,flush=True)
with cf.ThreadPoolExecutor(10) as ex: list(ex.map(work,src))
print("DONE",tot,flush=True)
