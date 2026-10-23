-- Adds a CRM organization type for groups that run job training and career services. Additive; applied 2026-10-23.
ALTER TYPE "CrmOrgType" ADD VALUE IF NOT EXISTS 'WORKFORCE_PROVIDER';
