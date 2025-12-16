-- 迁移脚本：为 sessions 表添加 full_conversation 字段
-- 用于存储完整对话内容（JSON 格式）

-- 添加 full_conversation 字段
ALTER TABLE sessions ADD COLUMN full_conversation TEXT;

-- 注意：如果表不存在，请先执行 schema.sql 创建表

