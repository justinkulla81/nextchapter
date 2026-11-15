import json,re,urllib.request,concurrent.futures as cf,sys
d=json.load(open("/home/user/nextchapter/scripts/jobsreport/sources/icims-found.json"))
def page(a):
    h,pr=a
    try: b=urllib.request.urlopen(urllib.request.Request(f"https://{h}/jobs/search?ss=1&in_iframe=1&pr={pr}",headers={"User-Agent":"Mozilla/5.0"}),timeout=30).read().decode("utf-8","replace")
    except Exception: return []
    return [f"https://{h}/jobs/{m.group(1)}/{m.group(2)}/job" for m in re.finditer(r'href="https://[^"/]+/jobs/(\d+)/([^"/]+)/job',b)]
tasks=[(x["host"],p) for x in d if x.get("host") for p in range(min(x.get("pages",1),150))]
print(len(tasks),"pages",file=sys.stderr)
out=set()
with cf.ThreadPoolExecutor(40) as ex:
    for r in ex.map(page,tasks): out.update(r)
open(sys.argv[1],"w").write("\n".join(sorted(out)))
print(len(out),"urls",file=sys.stderr)
