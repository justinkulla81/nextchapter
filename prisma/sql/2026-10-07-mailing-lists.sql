-- Mailing lists, list updates (editions) and report-send tracking.
-- Additive only. Generated with prisma migrate diff against origin/main,
-- then the seeds and RLS lines at the bottom added by hand.

-- CreateEnum
CREATE TYPE "MailingMemberStatus" AS ENUM ('ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "MailingAddedVia" AS ENUM ('WEBSITE_SIGNUP', 'ADDED_BY_ADMIN', 'REPLIED_YES', 'IMPORT');

-- CreateEnum
CREATE TYPE "MailingEditionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT');

-- CreateEnum
CREATE TYPE "MailingRecipientSource" AS ENUM ('BASE', 'ADDED_THIS_EDITION');

-- CreateEnum
CREATE TYPE "CrmReportSendMethod" AS ENUM ('AUTOMATED', 'MANUAL');

-- CreateEnum
CREATE TYPE "CrmReportSendChannel" AS ENUM ('EMAIL', 'LINKEDIN', 'IN_PERSON', 'OTHER');

-- CreateTable
CREATE TABLE "MailingList" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "audience" TEXT,
    "defaultFromName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailingListMember" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "personId" TEXT,
    "email" TEXT NOT NULL,
    "status" "MailingMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "addedVia" "MailingAddedVia" NOT NULL,
    "consentNote" TEXT,
    "addedByEmail" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusAt" TIMESTAMP(3),

    CONSTRAINT "MailingListMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailingSuppression" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailingSuppression_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "MailingListPrompt" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "snoozedUntil" TIMESTAMP(3),
    "suggestedKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastActivityId" TEXT,
    "lastEmailedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "answeredByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailingListPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailingSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "fromName" TEXT NOT NULL DEFAULT 'Justin Kulla',
    "fromEmail" TEXT NOT NULL DEFAULT 'justin@updates.launchyournextchapter.com',
    "replyTo" TEXT NOT NULL DEFAULT 'justin@launchyournextchapter.com',
    "testEmail" TEXT NOT NULL DEFAULT 'justin@launchyournextchapter.com',
    "ratePerHour" INTEGER NOT NULL DEFAULT 50,
    "footerText" TEXT NOT NULL DEFAULT 'Not useful? Reply ''unsubscribe'' or [click here] and I''ll take you off. NextChapter · {{postalAddress}}',
    "postalAddress" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailingEdition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isReport" BOOLEAN NOT NULL DEFAULT false,
    "reportKey" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "previewText" TEXT,
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "attachmentPath" TEXT,
    "attachmentName" TEXT,
    "attachmentBytes" INTEGER,
    "attachFile" BOOLEAN NOT NULL DEFAULT false,
    "reportUrl" TEXT,
    "status" "MailingEditionStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sendStartedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailingEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailingEditionList" (
    "editionId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,

    CONSTRAINT "MailingEditionList_pkey" PRIMARY KEY ("editionId","listId")
);

-- CreateTable
CREATE TABLE "MailingEditionRecipient" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "personId" TEXT,
    "email" TEXT NOT NULL,
    "source" "MailingRecipientSource" NOT NULL DEFAULT 'BASE',
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedReason" TEXT,
    "fromListKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alsoAddToListIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "resendEmailId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "delayedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "bouncedAt" TIMESTAMP(3),
    "bounceDetail" TEXT,
    "complainedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),

    CONSTRAINT "MailingEditionRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmReportSend" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "editionKey" TEXT NOT NULL,
    "method" "CrmReportSendMethod" NOT NULL,
    "channel" "CrmReportSendChannel" NOT NULL DEFAULT 'EMAIL',
    "sentAt" TIMESTAMP(3) NOT NULL,
    "activityId" TEXT,
    "editionRecipientId" TEXT,
    "subject" TEXT,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "markedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmReportSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailingUnsubscribeRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "personId" TEXT,
    "gmailMessageId" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailingUnsubscribeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailingList_key_key" ON "MailingList"("key");

-- CreateIndex
CREATE INDEX "MailingListMember_email_idx" ON "MailingListMember"("email");

-- CreateIndex
CREATE INDEX "MailingListMember_personId_idx" ON "MailingListMember"("personId");

-- CreateIndex
CREATE INDEX "MailingListMember_listId_status_idx" ON "MailingListMember"("listId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MailingListMember_listId_email_key" ON "MailingListMember"("listId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MailingListPrompt_personId_key" ON "MailingListPrompt"("personId");

-- CreateIndex
CREATE INDEX "MailingListPrompt_status_lastEmailedAt_idx" ON "MailingListPrompt"("status", "lastEmailedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MailingEdition_key_key" ON "MailingEdition"("key");

-- CreateIndex
CREATE INDEX "MailingEdition_status_scheduledAt_idx" ON "MailingEdition"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MailingEdition_reportKey_idx" ON "MailingEdition"("reportKey");

-- CreateIndex
CREATE INDEX "MailingEditionList_listId_idx" ON "MailingEditionList"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "MailingEditionRecipient_resendEmailId_key" ON "MailingEditionRecipient"("resendEmailId");

-- CreateIndex
CREATE INDEX "MailingEditionRecipient_editionId_status_idx" ON "MailingEditionRecipient"("editionId", "status");

-- CreateIndex
CREATE INDEX "MailingEditionRecipient_personId_idx" ON "MailingEditionRecipient"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "MailingEditionRecipient_editionId_email_key" ON "MailingEditionRecipient"("editionId", "email");

-- CreateIndex
CREATE INDEX "CrmReportSend_editionKey_method_idx" ON "CrmReportSend"("editionKey", "method");

-- CreateIndex
CREATE UNIQUE INDEX "CrmReportSend_personId_editionKey_key" ON "CrmReportSend"("personId", "editionKey");

-- CreateIndex
CREATE UNIQUE INDEX "MailingUnsubscribeRequest_gmailMessageId_key" ON "MailingUnsubscribeRequest"("gmailMessageId");

-- CreateIndex
CREATE INDEX "MailingUnsubscribeRequest_processedAt_receivedAt_idx" ON "MailingUnsubscribeRequest"("processedAt", "receivedAt");

-- AddForeignKey
ALTER TABLE "MailingListMember" ADD CONSTRAINT "MailingListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MailingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailingListMember" ADD CONSTRAINT "MailingListMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailingListPrompt" ADD CONSTRAINT "MailingListPrompt_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailingEditionList" ADD CONSTRAINT "MailingEditionList_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "MailingEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailingEditionList" ADD CONSTRAINT "MailingEditionList_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MailingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailingEditionRecipient" ADD CONSTRAINT "MailingEditionRecipient_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "MailingEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailingEditionRecipient" ADD CONSTRAINT "MailingEditionRecipient_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReportSend" ADD CONSTRAINT "CrmReportSend_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReportSend" ADD CONSTRAINT "CrmReportSend_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CrmActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Match the rest of the database: RLS on, no policies, so the anon and
-- authenticated roles see nothing; the app reaches these through Prisma as
-- the table owner, which bypasses RLS.
ALTER TABLE "MailingList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MailingListMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MailingSuppression" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MailingListPrompt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MailingSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MailingEdition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MailingEditionList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MailingEditionRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReportSend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MailingUnsubscribeRequest" ENABLE ROW LEVEL SECURITY;

-- The six starting lists. Editable afterwards in Admin → CRM → Mailing lists.
INSERT INTO "MailingList" ("id", "key", "name", "description", "audience", "defaultFromName", "isActive", "sortOrder", "updatedAt") VALUES
  ('ml_monthly_update', 'monthly_update', 'Monthly Update', 'The Displacement Report, the week the jobs report comes out.', 'Anyone who asked for the report, and people you send it to', 'Justin Kulla', true, 0, now()),
  ('ml_investors', 'investors', 'Investor updates', 'Investor and potential investor updates.', 'Investors and potential investors', 'Justin Kulla', true, 1, now()),
  ('ml_candidates', 'candidates', 'Candidates', 'News for job seekers.', 'Job seekers', 'Justin Kulla', true, 2, now()),
  ('ml_leads', 'leads', 'Leads and prospects', 'Workforce boards (WIOA), higher ed and outplacement buyers.', 'WIOA / workforce boards, higher ed, outplacement', 'Justin Kulla', true, 3, now()),
  ('ml_customers', 'customers', 'Customers', 'Existing customers.', 'Organizations with an active paid contract', 'Justin Kulla', true, 4, now()),
  ('ml_ecosystem', 'ecosystem', 'Coaches, recruiters and partners', 'The people who work alongside NextChapter.', 'Coaches, recruiters and partners', 'Justin Kulla', true, 5, now())
ON CONFLICT ("key") DO NOTHING;

-- Website signups so far join the Monthly Update. Someone who unsubscribed
-- from the newsletter arrives already unsubscribed, so they are never mailed.
INSERT INTO "MailingListMember" ("id", "listId", "email", "status", "addedVia", "consentNote", "addedAt", "statusAt")
SELECT 'mlm_' || ns."id", l."id", lower(ns."email"),
       CASE WHEN ns."unsubscribedAt" IS NULL THEN 'ACTIVE'::"MailingMemberStatus" ELSE 'UNSUBSCRIBED'::"MailingMemberStatus" END,
       'WEBSITE_SIGNUP', 'Signed up on the site (' || coalesce(ns."source", 'unknown page') || ')', ns."createdAt", ns."unsubscribedAt"
FROM "NewsletterSubscriber" ns CROSS JOIN "MailingList" l
WHERE l."key" = 'monthly_update'
ON CONFLICT ("listId", "email") DO NOTHING;

-- Tie each migrated signup to its CRM person where the address is known.
UPDATE "MailingListMember" m SET "personId" = p."id"
FROM "CrmPerson" p
WHERE m."personId" IS NULL AND p."deletedAt" IS NULL AND lower(p."email") = m."email";
