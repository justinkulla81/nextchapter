-- New contact type: CHRO (head of HR for the whole company). Additive; run before deploying.
ALTER TYPE "CrmPersonRole" ADD VALUE IF NOT EXISTS 'CHRO';
