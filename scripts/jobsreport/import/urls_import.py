import sys, os, json, html, time, datetime, threading, concurrent.futures as cf, urllib.request
sys.path.insert(0,"/home/user/nextchapter/scripts/jobsreport")
import sitemap_jsonld_harvest as H
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

name=sys.argv[1]
def _post(jobs):
    body=json.dumps({"jobs":jobs}).encode()
    for a in range(4):
        try:
            r=urllib.request.Request(URL,data=body,method="POST",headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
            return json.load(urllib.request.urlopen(r,timeout=280))
        except Exception: time.sleep(5*(a+1))
    return {}
urls=[l.strip() for l in open(sys.argv[2]) if l.strip()]; print(len(urls),"urls",flush=True)
if os.environ.get("REFRESH")=="1":
    conf=set()
    for i in range(0,len(urls),5000): conf|=set(_confirm(urls[i:i+5000]).get("confirmedUrls",[]))
    print("confirmed without fetching",len(conf),"of",len(urls),flush=True); urls=[u for u in urls if u not in conf]
tot={"seen":0,"ok":0,"created":0,"updated":0,"skipped":0}; lock=threading.Lock(); buf=[]
def fl():
    global buf
    b,buf=buf,[]
    if b:
        r=post(b)
        tot["created"]+=r.get("created",0) or 0; tot["updated"]+=r.get("updated",0) or 0; tot["skipped"]+=len(r.get("skipped",[]) or [])
def work(u):
    try: r=H.one(u+"?in_iframe=1")
    except Exception: r={"ok":False}
    with lock:
        tot["seen"]+=1
        if r.get("ok") and r.get("title") and r.get("employer"):
            tot["ok"]+=1
            loc=", ".join(p for p in (r.get("city"),r.get("state")) if p)
            if r.get("country") in ("US","USA","United States") and loc: loc+=", United States"
            now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            buf.append({"title":html.unescape(r["title"]),"companyName":html.unescape(r["employer"]),"location":loc,"url":u,"description":html.unescape(r.get("description") or ""),
              "postedAt":r.get("posted"),"sourceCategory":"employer","sourceName":name,"directListing":True,"addedBy":"bulk_import","lastVerifiedAt":now,"schoolContext":False})
            if len(buf)>=100: fl()
        if tot["seen"]%500==0: print(tot,flush=True)
with cf.ThreadPoolExecutor(int(os.environ.get("T","24"))) as ex: list(ex.map(work,urls))
with lock: fl()
print("DONE",tot,flush=True)
