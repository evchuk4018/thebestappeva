CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'auth'
      AND proc.proname = 'uid'
      AND pg_get_function_arguments(proc.oid) = ''
  ) THEN
    EXECUTE $function$
      CREATE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $uid$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $uid$
    $function$;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

CREATE TABLE IF NOT EXISTS app_settings (
  owner_id uuid NOT NULL,
  key text NOT NULL,
  value_json jsonb NOT NULL,
  PRIMARY KEY (owner_id, key)
);

CREATE TABLE IF NOT EXISTS ai_chats (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  title text NOT NULL,
  mode text NOT NULL,
  updated_at timestamptz NOT NULL,
  payload_json jsonb NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS ai_artifacts (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  chat_id text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  schema_version integer NOT NULL,
  content_markdown text NOT NULL,
  context_policy_json jsonb NOT NULL,
  citations_json jsonb NOT NULL,
  linked_doc_id text,
  last_exported_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS ai_artifact_versions (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  artifact_id text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  content_markdown text NOT NULL,
  context_policy_json jsonb NOT NULL,
  citations_json jsonb NOT NULL,
  linked_doc_id text,
  last_exported_at timestamptz,
  actor text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, artifact_id) REFERENCES ai_artifacts(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS docs_documents (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  last_opened_at timestamptz NOT NULL,
  starred boolean NOT NULL,
  trashed_at timestamptz,
  template_id text NOT NULL,
  active_tab_id text NOT NULL,
  layout_mode text NOT NULL,
  zoom double precision NOT NULL,
  page_settings_json jsonb NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS docs_tabs (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  document_id text NOT NULL,
  parent_tab_id text,
  title text NOT NULL,
  tab_order integer NOT NULL,
  outline_visible boolean NOT NULL,
  content text NOT NULL,
  content_format text NOT NULL,
  text_content text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, document_id) REFERENCES docs_documents(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS docs_versions (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  document_id text NOT NULL,
  tab_id text,
  created_at timestamptz NOT NULL,
  label text NOT NULL,
  kind text NOT NULL,
  content text NOT NULL,
  content_format text NOT NULL,
  snapshot_title text NOT NULL,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, document_id) REFERENCES docs_documents(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, tab_id) REFERENCES docs_tabs(owner_id, id) ON DELETE SET NULL (tab_id)
);

CREATE TABLE IF NOT EXISTS docs_citations (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  document_id text NOT NULL,
  label text NOT NULL,
  details text NOT NULL,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, document_id) REFERENCES docs_documents(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS docs_migration_sources (
  owner_id uuid NOT NULL,
  source_key text NOT NULL,
  imported_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, source_key)
);

CREATE TABLE IF NOT EXISTS skills (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  instructions text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  compatible_modes_json jsonb NOT NULL DEFAULT 'null'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS automations (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  kind text NOT NULL,
  trigger_json jsonb NOT NULL,
  action_json jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_triggered_at timestamptz,
  last_completed_at timestamptz,
  last_run_status text NOT NULL DEFAULT 'idle',
  last_run_summary text,
  last_error text,
  last_chat_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS workspace_revision_state (
  owner_id uuid NOT NULL,
  workspace_key text NOT NULL,
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (owner_id, workspace_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_owner_updated ON ai_chats(owner_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ai_artifacts_owner_chat_updated ON ai_artifacts(owner_id, chat_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ai_artifact_versions_owner_artifact_created ON ai_artifact_versions(owner_id, artifact_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_docs_documents_owner_updated_at ON docs_documents(owner_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_docs_documents_owner_last_opened_at ON docs_documents(owner_id, last_opened_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_docs_tabs_owner_document_id ON docs_tabs(owner_id, document_id, tab_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_docs_versions_owner_document_created ON docs_versions(owner_id, document_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_docs_citations_owner_document_id ON docs_citations(owner_id, document_id, id ASC);

CREATE INDEX IF NOT EXISTS idx_skills_owner_name ON skills(owner_id, name ASC);
CREATE INDEX IF NOT EXISTS idx_skills_owner_enabled ON skills(owner_id, enabled);
CREATE INDEX IF NOT EXISTS idx_skills_owner_updated_at ON skills(owner_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_automations_owner_name ON automations(owner_id, name ASC);
CREATE INDEX IF NOT EXISTS idx_automations_owner_enabled ON automations(owner_id, enabled);
CREATE INDEX IF NOT EXISTS idx_automations_owner_due ON automations(owner_id, kind, enabled, next_run_at ASC, id ASC) WHERE next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automations_owner_updated_at ON automations(owner_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_revision_state_owner_updated ON workspace_revision_state(owner_id, updated_at DESC, workspace_key ASC);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_artifact_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_migration_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_revision_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  app_settings,
  ai_chats,
  ai_artifacts,
  ai_artifact_versions,
  docs_documents,
  docs_tabs,
  docs_versions,
  docs_citations,
  docs_migration_sources,
  skills,
  automations,
  workspace_revision_state
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  app_settings,
  ai_chats,
  ai_artifacts,
  ai_artifact_versions,
  docs_documents,
  docs_tabs,
  docs_versions,
  docs_citations,
  docs_migration_sources,
  skills,
  automations,
  workspace_revision_state
TO authenticated;

DROP POLICY IF EXISTS app_settings_authenticated_owner ON app_settings;
CREATE POLICY app_settings_authenticated_owner ON app_settings FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS ai_chats_authenticated_owner ON ai_chats;
CREATE POLICY ai_chats_authenticated_owner ON ai_chats FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS ai_artifacts_authenticated_owner ON ai_artifacts;
CREATE POLICY ai_artifacts_authenticated_owner ON ai_artifacts FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS ai_artifact_versions_authenticated_owner ON ai_artifact_versions;
CREATE POLICY ai_artifact_versions_authenticated_owner ON ai_artifact_versions FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS docs_documents_authenticated_owner ON docs_documents;
CREATE POLICY docs_documents_authenticated_owner ON docs_documents FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS docs_tabs_authenticated_owner ON docs_tabs;
CREATE POLICY docs_tabs_authenticated_owner ON docs_tabs FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS docs_versions_authenticated_owner ON docs_versions;
CREATE POLICY docs_versions_authenticated_owner ON docs_versions FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS docs_citations_authenticated_owner ON docs_citations;
CREATE POLICY docs_citations_authenticated_owner ON docs_citations FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS docs_migration_sources_authenticated_owner ON docs_migration_sources;
CREATE POLICY docs_migration_sources_authenticated_owner ON docs_migration_sources FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS skills_authenticated_owner ON skills;
CREATE POLICY skills_authenticated_owner ON skills FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS automations_authenticated_owner ON automations;
CREATE POLICY automations_authenticated_owner ON automations FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS workspace_revision_state_authenticated_owner ON workspace_revision_state;
CREATE POLICY workspace_revision_state_authenticated_owner ON workspace_revision_state FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
