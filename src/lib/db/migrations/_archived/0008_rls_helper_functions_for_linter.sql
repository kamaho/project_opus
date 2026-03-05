-- RLS helper functions so policy expressions do not contain current_setting() directly.
-- Supabase Performance Advisor (auth_rls_initplan) may still flag policies that
-- mention current_setting() in the expression; using (select helper()) avoids that
-- and keeps evaluation to once per query (STABLE).

CREATE OR REPLACE FUNCTION public.rls_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub';
$$;

CREATE OR REPLACE FUNCTION public.rls_current_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT current_setting('app.tenant_id', true);
$$;

-- Recreate policies using helpers (no current_setting in policy text)
DROP POLICY IF EXISTS ai_user_memory_user ON public.ai_user_memory;
CREATE POLICY ai_user_memory_user ON public.ai_user_memory
  FOR ALL USING (user_id = (SELECT public.rls_current_user_id()));

DROP POLICY IF EXISTS ai_conversations_user ON public.ai_conversations;
CREATE POLICY ai_conversations_user ON public.ai_conversations
  FOR ALL USING (user_id = (SELECT public.rls_current_user_id()));

DROP POLICY IF EXISTS user_onboarding_user ON public.user_onboarding;
CREATE POLICY user_onboarding_user ON public.user_onboarding
  FOR ALL USING (user_id = (SELECT public.rls_current_user_id()));

DROP POLICY IF EXISTS "Tenant isolation for agent_report_configs" ON public.agent_report_configs;
CREATE POLICY "Tenant isolation for agent_report_configs" ON public.agent_report_configs
  FOR ALL USING (tenant_id = (SELECT public.rls_current_tenant_id()));

DROP POLICY IF EXISTS "Tenant isolation for agent_job_logs" ON public.agent_job_logs;
CREATE POLICY "Tenant isolation for agent_job_logs" ON public.agent_job_logs
  FOR ALL USING (tenant_id = (SELECT public.rls_current_tenant_id()));
