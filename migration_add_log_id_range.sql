-- 迁移脚本：为 sessions 表添加 first_log_id 和 last_log_id 字段
-- 用于记录该会话对应的 log_entries 表的 id 范围

-- 添加 first_log_id 字段
ALTER TABLE sessions ADD COLUMN first_log_id INTEGER;

-- 添加 last_log_id 字段
ALTER TABLE sessions ADD COLUMN last_log_id INTEGER;

-- 注意：如果表不存在，请先执行 schema.sql 创建表
-- 外键约束会在下次重建表时自动添加

