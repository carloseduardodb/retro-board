-- Retro Board - Schema SQL para Supabase
-- Execute este SQL no SQL Editor do Supabase Dashboard

-- Habilitar extensão uuid
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de sessões
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  timer_status TEXT DEFAULT 'configuring' CHECK (timer_status IN ('configuring', 'running', 'paused', 'finished')),
  timer_minutes INTEGER DEFAULT 5,
  timer_ends_at TIMESTAMPTZ,
  timer_remaining_seconds INTEGER
);

-- Tabela de cards (colunas Bom, Ruim, Ideias)
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token TEXT NOT NULL REFERENCES sessions(token) ON DELETE CASCADE,
  column_type TEXT NOT NULL CHECK (column_type IN ('good', 'bad', 'ideas')),
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  author TEXT NOT NULL,
  author_id TEXT NOT NULL,
  votes INTEGER DEFAULT 0,
  voters TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de cards de ação
CREATE TABLE IF NOT EXISTS action_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token TEXT NOT NULL REFERENCES sessions(token) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  responsible TEXT,
  author TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de sugestões da IA
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token TEXT NOT NULL REFERENCES sessions(token) ON DELETE CASCADE,
  text TEXT NOT NULL,
  responsible TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de ações da sprint anterior
CREATE TABLE IF NOT EXISTS prev_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token TEXT NOT NULL REFERENCES sessions(token) ON DELETE CASCADE,
  text TEXT NOT NULL,
  responsible TEXT,
  done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cards_session ON cards(session_token);
CREATE INDEX IF NOT EXISTS idx_cards_session_column ON cards(session_token, column_type);
CREATE INDEX IF NOT EXISTS idx_action_cards_session ON action_cards(session_token);
CREATE INDEX IF NOT EXISTS idx_suggestions_session ON suggestions(session_token);
CREATE INDEX IF NOT EXISTS idx_prev_actions_session ON prev_actions(session_token);

-- Row Level Security (RLS) - permitir acesso público (sem auth)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prev_actions ENABLE ROW LEVEL SECURITY;

-- Policies - acesso total para anon (app sem autenticação)
CREATE POLICY "Allow all for sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for cards" ON cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for action_cards" ON action_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for suggestions" ON suggestions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for prev_actions" ON prev_actions FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE cards;
ALTER PUBLICATION supabase_realtime ADD TABLE action_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE prev_actions;
