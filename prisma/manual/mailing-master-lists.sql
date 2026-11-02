-- Employers and Higher ed become real master lists (filled from their sub-lists by the daily
-- mailing-autoassign cron), and Candidates is described as registered members. Data only; idempotent.
UPDATE "MailingList" SET "isActive" = true, "name" = 'Employers (all)', "audience" = 'Employers',
  "description" = 'Everyone on the three Employers lists, each address once', "updatedAt" = now() WHERE "key" = 'employers';
UPDATE "MailingList" SET "isActive" = true, "name" = 'Higher ed (all)', "audience" = 'Colleges and universities',
  "description" = 'Everyone on the career services, development and executive education lists, each address once. Alumni offices are not emailed.', "updatedAt" = now() WHERE "key" = 'higher_ed';
UPDATE "MailingList" SET "audience" = 'Registered members', "description" = 'People with a registered NextChapter account', "updatedAt" = now() WHERE "key" = 'candidates';
