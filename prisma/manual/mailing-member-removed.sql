-- A removal by hand (or by the daily list clean-up) is now a status, not a deleted row, so the auto-assign job never re-adds the person.
ALTER TYPE "MailingMemberStatus" ADD VALUE IF NOT EXISTS 'REMOVED';
