-- New contact type: head of learning and development. Additive; run before deploying.
ALTER TYPE "CrmPersonRole" ADD VALUE IF NOT EXISTS 'LEARNING_DEV_HEAD';
