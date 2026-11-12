-- Open reconcile job (lib/mailing/reconcile-opens.ts): marks a recipient once Resend has been asked about their open.
ALTER TABLE "MailingEditionRecipient" ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMP(3);
