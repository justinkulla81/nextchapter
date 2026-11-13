import json, os, sys, time, urllib.request, concurrent.futures as cf, datetime
SRC="/tmp/claude-0/-home-user-nextchapter/b4e83622-3eb6-54e1-83b5-d8fdcae1ab60/scratchpad/workable-us.jsonl"
KEY=os.environ["K"]; URL="https://launchyournextchapter.com/api/admin/jobs/import"
MODE=sys.argv[1]; LIMIT=int(sys.argv[2]) if len(sys.argv)>2 else 10**9
BATCH=100
def post(jobs, dry):
    body=json.dumps({"jobs":jobs,"dryRun":dry}).encode()
    for a in range(4):
        try:
            r=urllib.request.Request(URL,data=body,method="POST",headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
            return json.load(urllib.request.urlopen(r,timeout=280))
        except Exception as e:
            err=str(e)[:200]; time.sleep(5*(a+1))
    return {"error":err}
def mapjob(j):
    if j.get("country") and j["country"]!="United States": return None
    city=(j.get("city") or "").strip(); st=(j.get("state") or "").strip()
    loc=", ".join(p for p in (city,st,"United States") if p)
    if j.get("workplace")=="remote" and not city: loc="Remote, United States"
    now=datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"title":j["title"],"companyName":j["employer"],"location":loc,"url":j["applyUrl"],
      "description":j.get("description"),"postedAt":j.get("posted"),"sourceCategory":"employer",
      "sourceName":"Workable","directListing":True,"lastVerifiedAt":now}
def batches():
    buf=[];n=0
    with open(SRC) as f:
        for line in f:
            try: j=mapjob(json.loads(line))
            except Exception: continue
            if not j or not j["title"] or not j["companyName"] or not j["url"]: continue
            buf.append(j);n+=1
            if len(buf)==BATCH: yield buf;buf=[]
            if n>=LIMIT: break
    if buf: yield buf
tot={"create":0,"update":0,"skipped":0,"sent":0,"errors":0}; reasons={}
dry=(MODE=="dry")
def run(b):
    r=post(b,dry); return b,r
t0=time.time()
with cf.ThreadPoolExecutor(4) as ex:
    futs=[]
    for b in batches():
        futs.append(ex.submit(run,b))
        if len(futs)>=8:
            for f in futs:
                b,r=f.result()
                tot["sent"]+=len(b)
                if "error" in r: tot["errors"]+=1; print("ERR",r["error"],flush=True)
                else:
                    tot["create"]+=r.get("wouldCreate",r.get("created",0)) or 0
                    tot["update"]+=r.get("wouldUpdate",r.get("updated",0)) or 0
                    for s in r.get("skipped",[]) or []: tot["skipped"]+=1; k=s["reason"][:60]; reasons[k]=reasons.get(k,0)+1
            futs=[]
            print(int(time.time()-t0),"s",tot,flush=True)
    for f in futs:
        b,r=f.result(); tot["sent"]+=len(b)
        if "error" in r: tot["errors"]+=1
        else:
            tot["create"]+=r.get("wouldCreate",r.get("created",0)) or 0
            tot["update"]+=r.get("wouldUpdate",r.get("updated",0)) or 0
            for s in r.get("skipped",[]) or []: tot["skipped"]+=1; k=s["reason"][:60]; reasons[k]=reasons.get(k,0)+1
print("DONE",tot); print(sorted(reasons.items(),key=lambda x:-x[1])[:12])
