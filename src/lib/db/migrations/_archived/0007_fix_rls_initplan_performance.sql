-- Fix RLS policies to use (select ...) wrapper for current_setting() calls.
-- Without the wrapper, Postgres re-evaluates the function for every row,
-- causing O(n) overhead. With (select ...) it evaluates once per query.
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan

-- ai_user_memory
DROP POLICY IF EXISTS ai_user_memory_user ON public.ai_user_memory;
CREATE POLICY ai_user_memory_user ON public.ai_user_memory
  FOR ALL USING (user_id = (select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')));

-- ai_conversations
DROP POLICY IF EXISTS ai_conversations_user ON public.ai_conversations;
CREATE POLICY ai_conversations_user ON public.ai_conversations
  FOR ALL USING (user_id = (select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')));

-- user_onboarding
DROP POLICY IF EXISTS user_onboarding_user ON public.user_onboarding;
CREATE POLICY user_onboarding_user ON public.user_onboarding
  FOR ALL USING (user_id = (select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')));

-- agent_report_configs
DROP POLICY IF EXISTS "Tenant isolation for agent_report_configs" ON public.agent_report_configs;
CREATE POLICY "Tenant isolation for agent_report_configs" ON public.agent_report_configs
  FOR ALL USING (tenant_id = (select current_setting('app.tenant_id', true)));

-- agent_job_logs
DROP POLICY IF EXISTS "Tenant isolation for agent_job_logs" ON public.agent_job_logs;
CREATE POLICY "Tenant isolation for agent_job_logs" ON public.agent_job_logs
  FOR ALL USING (tenant_id = (select current_setting('app.tenant_id', true)));
