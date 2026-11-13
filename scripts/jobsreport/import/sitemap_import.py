import sys, os, json, html, time, datetime, threading, concurrent.futures as cf, urllib.request
sys.path.insert(0,"/home/user/nextchapter/scripts/jobsreport")
import sitemap_jsonld_harvest as H
KEY=os.environ["K"]; URL="https://launchyournextchapter.com/api/admin/jobs/import"
sitemap,match,name=sys.argv[1],sys.argv[2],sys.argv[3]
def post(jobs):
    body=json.dumps({"jobs":jobs}).encode()
    for a in range(4):
        try:
            r=urllib.request.Request(URL,data=body,method="POST",headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
            return json.load(urllib.request.urlopen(r,timeout=280))
        except Exception: time.sleep(5*(a+1))
    return {}
urls=H.urls_from(sitemap,match); print(len(urls),"urls",flush=True)
tot={"seen":0,"ok":0,"created":0,"updated":0,"skipped":0}; lock=threading.Lock(); buf=[]
def fl():
    global buf
    b,buf=buf,[]
    if b:
        r=post(b)
        tot["created"]+=r.get("created",0) or 0; tot["updated"]+=r.get("updated",0) or 0; tot["skipped"]+=len(r.get("skipped",[]) or [])
def work(u):
    try: r=H.one(u)
    except Exception: r={"ok":False}
    with lock:
        tot["seen"]+=1
        if r.get("ok") and r.get("title") and r.get("employer"):
            tot["ok"]+=1
            loc=", ".join(p for p in (r.get("city"),r.get("state")) if p)
            if r.get("country") in ("US","USA","United States") and loc: loc+=", United States"
            now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            buf.append({"title":html.unescape(r["title"]),"companyName":html.unescape(r["employer"]),"location":loc,"url":u,"description":html.unescape(r.get("description") or ""),
              "postedAt":r.get("posted"),"sourceCategory":"employer","sourceName":name,"directListing":True,"lastVerifiedAt":now,"schoolContext":("edjoin" in u)})
            if len(buf)>=100: fl()
        if tot["seen"]%500==0: print(tot,flush=True)
with cf.ThreadPoolExecutor(int(os.environ.get("T","24"))) as ex: list(ex.map(work,urls))
with lock: fl()
print("DONE",tot,flush=True)
