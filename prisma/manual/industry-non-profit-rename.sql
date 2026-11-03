-- Rename the industry bucket "Nonprofit & Social Impact" to "Non-profit & Social Impact".
-- Run just before the deploy of the code that reads the new name. Idempotent: safe to re-run.
-- One statement per column so a timeout on a large table can be retried alone.
UPDATE "MarketTargetStat" SET industry = 'Non-profit & Social Impact' WHERE industry = 'Nonprofit & Social Impact';
UPDATE "CompanyIndustryLookup" SET "industryBucket" = 'Non-profit & Social Impact' WHERE "industryBucket" = 'Nonprofit & Social Impact';
UPDATE "CompanyHiringProfile" SET industry = 'Non-profit & Social Impact' WHERE industry = 'Nonprofit & Social Impact';
UPDATE "Company" SET industry = 'Non-profit & Social Impact' WHERE industry = 'Nonprofit & Social Impact';
UPDATE "CandidateProfile" SET "industryBucket" = 'Non-profit & Social Impact' WHERE "industryBucket" = 'Nonprofit & Social Impact';
UPDATE "ConferenceEvent" SET industries = array_replace(industries, 'Nonprofit & Social Impact', 'Non-profit & Social Impact') WHERE 'Nonprofit & Social Impact' = ANY(industries);
-- Zero rows when checked, kept so a later re-run catches any that appear:
UPDATE "CandidateProfile" SET "industryBuckets" = array_replace("industryBuckets", 'Nonprofit & Social Impact', 'Non-profit & Social Impact') WHERE 'Nonprofit & Social Impact' = ANY("industryBuckets");
UPDATE "CandidateProfile" SET "targetIndustries" = array_replace("targetIndustries", 'Nonprofit & Social Impact', 'Non-profit & Social Impact') WHERE 'Nonprofit & Social Impact' = ANY("targetIndustries");
UPDATE "Coach" SET industries = array_replace(industries, 'Nonprofit & Social Impact', 'Non-profit & Social Impact') WHERE 'Nonprofit & Social Impact' = ANY(industries);
UPDATE "Course" SET industries = array_replace(industries, 'Nonprofit & Social Impact', 'Non-profit & Social Impact') WHERE 'Nonprofit & Social Impact' = ANY(industries);
UPDATE "CrmPerson" SET "coverageIndustries" = array_replace("coverageIndustries", 'Nonprofit & Social Impact', 'Non-profit & Social Impact') WHERE 'Nonprofit & Social Impact' = ANY("coverageIndustries");
UPDATE "MentoringSignup" SET industries = array_replace(industries, 'Nonprofit & Social Impact', 'Non-profit & Social Impact') WHERE 'Nonprofit & Social Impact' = ANY(industries);
UPDATE "InstitutionMentor" SET industries = array_replace(industries, 'Nonprofit & Social Impact', 'Non-profit & Social Impact') WHERE 'Nonprofit & Social Impact' = ANY(industries);
UPDATE "CommunityPost" SET "postIndustryBucket" = 'Non-profit & Social Impact' WHERE "postIndustryBucket" = 'Nonprofit & Social Impact';
UPDATE "WarnNotice" SET industry = 'Non-profit & Social Impact' WHERE industry = 'Nonprofit & Social Impact';
