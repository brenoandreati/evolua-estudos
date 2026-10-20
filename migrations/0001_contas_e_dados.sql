-- Contas, sessões e dados de estudo de cada pessoa.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- Senha guardada só como hash PBKDF2-SHA-256 com sal; vazia em contas criadas pelo Google.
  password_hash TEXT,
  password_salt TEXT,
  password_iterations INTEGER,
  google_sub TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  -- Hash SHA-256 do token do cookie (o token em si nunca é guardado).
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_user_id ON sessions (user_id);

CREATE TABLE study_data (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tentativas de entrada com senha errada, para bloquear tentativas em massa.
CREATE TABLE login_attempts (
  email TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  first_failure_at TEXT NOT NULL,
  locked_until TEXT
);
