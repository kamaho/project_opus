ALTER TABLE "user_onboarding" ADD COLUMN IF NOT EXISTS "user_type" text;
ALTER TABLE "user_onboarding" ADD COLUMN IF NOT EXISTS "responsibilities" text;
