-- Cloudflare D1 数据库 schema
-- 用于存储虚假信息教学助手的会话和日志数据

-- 会话表：存储每个教学会话的基本信息
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  scenario_title TEXT NOT NULL,
  scenario_fake_source TEXT,
  scenario_trace_image_context TEXT,
  scenario_assessment_context TEXT,
  started_at TEXT NOT NULL,
  stored_at TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  is_terminated INTEGER DEFAULT 0,
  full_conversation TEXT, -- JSON 格式存储完整对话内容
  first_log_id INTEGER, -- log_entries 表中第一条记录的 id
  last_log_id INTEGER, -- log_entries 表中最后一条记录的 id
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (first_log_id) REFERENCES log_entries(id),
  FOREIGN KEY (last_log_id) REFERENCES log_entries(id)
);

-- 日志条目表：存储每条交互日志
CREATE TABLE IF NOT EXISTS log_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'agent' | 'system'
  stage TEXT,
  required_action TEXT,
  is_relevant INTEGER, -- 0 or 1 (SQLite 没有 BOOLEAN)
  off_topic_count INTEGER,
  text TEXT NOT NULL,
  image_url TEXT,
  user_image_attached INTEGER DEFAULT 0,
  web_url_extracted TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_log_entries_session_id ON log_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_timestamp ON log_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_entries_stage ON log_entries(stage);

