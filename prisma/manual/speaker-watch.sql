-- Thought leaders whose speaking appearances are tracked. Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS "SpeakerWatch" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameKey" TEXT NOT NULL, "org" TEXT, "title" TEXT, "topics" TEXT,
  "crmPersonId" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "source" TEXT NOT NULL DEFAULT 'ADMIN', "note" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SpeakerWatch_nameKey_key" ON "SpeakerWatch"("nameKey");
CREATE INDEX IF NOT EXISTS "SpeakerWatch_status_idx" ON "SpeakerWatch"("status");

CREATE TABLE IF NOT EXISTS "SpeakerAppearance" (
  "id" TEXT PRIMARY KEY, "speakerId" TEXT NOT NULL REFERENCES "SpeakerWatch"("id") ON DELETE CASCADE,
  "eventName" TEXT NOT NULL, "hostName" TEXT, "url" TEXT, "eventDate" TIMESTAMP(3), "role" TEXT NOT NULL DEFAULT 'PANEL',
  "location" TEXT, "sourceRef" TEXT NOT NULL, "opportunityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SpeakerAppearance_sourceRef_key" ON "SpeakerAppearance"("sourceRef");
CREATE INDEX IF NOT EXISTS "SpeakerAppearance_speakerId_eventDate_idx" ON "SpeakerAppearance"("speakerId","eventDate");
CREATE INDEX IF NOT EXISTS "SpeakerAppearance_hostName_idx" ON "SpeakerAppearance"("hostName");

-- Starter list, part 1: people already in the CRM (linked, so their record shows what they are speaking at).
INSERT INTO "SpeakerWatch" ("id","name","nameKey","org","title","topics","crmPersonId","source")
SELECT 'sw_' || v.pid, p."fullName", lower(p."fullName"), o.name, a.title, v.topics, p.id, 'SEED'
FROM (VALUES
  ('cmu4vuh5y001ll604d0kuanyh','AI and work'),
  ('cmu4ef7a30001i704g7ibh1i2','AI, jobs and shared prosperity'),
  ('cmtx1oaig02fqq2bm1k58k3fo','AI and the economy, automation'),
  ('csc2pjrfntn0h3bzxops2dmf9','Labor economics, automation and work'),
  ('cmtx1oaig02fyq2bm87851xyr','AI and productivity, the future of work'),
  ('cq950jkspryck82smclqfxqwk','AI at work, adoption'),
  ('cyxr9cdywk0ejvqyy3gy9wyq3','Labor market data, hiring'),
  ('cmtx1oaic02dcq2bmttly9kzx','AI and the workforce'),
  ('cmu5xxlo00008jq04ysehywug','AI and the future of work research'),
  ('cmu5j856y0001kt045i7vqqve','Skills, AI and early-career jobs'),
  ('cmu4vxwhc001sl604up19mbld','Technology and work'),
  ('cmvg49cic00f8l509jcuuuon1','Labor market analytics'),
  ('cmvfn2agg003sq223aakop91q','Workforce data'),
  ('c2oz9znbnwse14cayblxkqj4t','Labor policy'),
  ('cmkgjxrtgt8a3y0h2gimv4ucg','Education, skills and the labor market'),
  ('cl2hcgnu3yhaa7g582t5ai48m','Labor economics, remote work'),
  ('cmtx1oaii02h4q2bmgm00c89y','Skills policy, workforce development'),
  ('cmvfn13he0016q22392waxd7r','Workforce research'),
  ('cv7xdyn5yrg9rj37zjuzgpzou','Work, careers and organizational psychology'),
  ('c3hmjr9htedprpqj5eqg4w2m4','Longevity and careers')
) AS v(pid, topics)
JOIN "CrmPerson" p ON p.id = v.pid AND p."deletedAt" IS NULL
LEFT JOIN LATERAL (SELECT "orgId", title FROM "CrmAffiliation" WHERE "personId"=p.id AND "isCurrent" ORDER BY "isPrimary" DESC LIMIT 1) a ON true
LEFT JOIN "CrmOrganization" o ON o.id = a."orgId"
ON CONFLICT ("nameKey") DO NOTHING;

-- Part 2: well-known voices not (yet) in the CRM. Affiliation is left blank; the weekly search fills it from public pages.
INSERT INTO "SpeakerWatch" ("id","name","nameKey","topics","source")
SELECT 'sw_' || md5(lower(n)), n, lower(n), t, 'SEED' FROM (VALUES
  ('Ravin Jesuthasan','Future of work, skills-based organizations'),
  ('Josh Bersin','HR, talent and workforce'),
  ('Matt Sigelman','Labor market data, skills'),
  ('Julia Pollak','Labor economics, hiring'),
  ('Gad Levanon','Labor market research'),
  ('Nela Richardson','Employment and economy'),
  ('Kweilin Ellingrud','Workforce and AI, McKinsey Global Institute'),
  ('Anton Korinek','Economics of AI'),
  ('Lawrence Katz','Labor economics'),
  ('Jed Kolko','Labor and hiring trends')
) AS x(n, t)
ON CONFLICT ("nameKey") DO NOTHING;
