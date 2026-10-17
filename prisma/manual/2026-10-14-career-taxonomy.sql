-- Career taxonomy: O*NET occupations/skills + BLS pay and projections, and the
-- per-candidate occupation match. Additive and re-runnable (IF NOT EXISTS). No
-- existing table is altered; CandidateOccupation only references CandidateProfile.
--
-- RUN BEFORE the deploy that reads it, then load data with `npm run careers:import-onet`
-- and `npm run careers:import-bls` (see docs/CAREER_TAXONOMY.md). Until the data is
-- loaded the Pivot Tool shows an honest "not available yet" state, nothing breaks.

CREATE TABLE IF NOT EXISTS "Occupation" (
    "socCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "jobZone" INTEGER,
    "medianWage" INTEGER,
    "employment" INTEGER,
    "wageYear" INTEGER,
    "growthPct" DOUBLE PRECISION,
    "annualOpenings" INTEGER,
    "projectionPeriod" TEXT,
    "typicalEducation" TEXT,
    "onetVersion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Occupation_pkey" PRIMARY KEY ("socCode")
);
CREATE INDEX IF NOT EXISTS "Occupation_title_idx" ON "Occupation"("title");

CREATE TABLE IF NOT EXISTS "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Skill_kind_idx" ON "Skill"("kind");

CREATE TABLE IF NOT EXISTS "OccupationSkill" (
    "socCode" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL,
    "level" DOUBLE PRECISION,
    "hotTech" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OccupationSkill_pkey" PRIMARY KEY ("socCode","skillId"),
    CONSTRAINT "OccupationSkill_socCode_fkey" FOREIGN KEY ("socCode") REFERENCES "Occupation"("socCode") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OccupationSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OccupationSkill_skillId_idx" ON "OccupationSkill"("skillId");

CREATE TABLE IF NOT EXISTS "OccupationAltTitle" (
    "id" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleNormalized" TEXT NOT NULL,
    CONSTRAINT "OccupationAltTitle_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OccupationAltTitle_socCode_fkey" FOREIGN KEY ("socCode") REFERENCES "Occupation"("socCode") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OccupationAltTitle_socCode_titleNormalized_key" ON "OccupationAltTitle"("socCode","titleNormalized");
CREATE INDEX IF NOT EXISTS "OccupationAltTitle_titleNormalized_idx" ON "OccupationAltTitle"("titleNormalized");

CREATE TABLE IF NOT EXISTS "OccupationRelated" (
    "socCode" TEXT NOT NULL,
    "relatedSocCode" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    CONSTRAINT "OccupationRelated_pkey" PRIMARY KEY ("socCode","relatedSocCode"),
    CONSTRAINT "OccupationRelated_socCode_fkey" FOREIGN KEY ("socCode") REFERENCES "Occupation"("socCode") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OccupationRelated_relatedSocCode_fkey" FOREIGN KEY ("relatedSocCode") REFERENCES "Occupation"("socCode") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CandidateOccupation" (
    "candidateId" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "matchedFrom" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateOccupation_pkey" PRIMARY KEY ("candidateId"),
    CONSTRAINT "CandidateOccupation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateOccupation_socCode_fkey" FOREIGN KEY ("socCode") REFERENCES "Occupation"("socCode") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CandidateOccupation_socCode_idx" ON "CandidateOccupation"("socCode");

-- Match the rest of the app: tables are reached through Prisma only, never PostgREST.
ALTER TABLE "Occupation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Skill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OccupationSkill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OccupationAltTitle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OccupationRelated" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CandidateOccupation" ENABLE ROW LEVEL SECURITY;
