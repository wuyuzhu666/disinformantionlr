# Cloudflare D1 数据库设置指南

## 1. 创建 D1 数据库

1. 登录 Cloudflare Dashboard
2. 进入你的 Pages 项目（或 Workers）
3. 在左侧菜单找到 **"D1"** → **"创建数据库"**
4. 输入数据库名称，例如：`lateral-reading-logs`
5. 选择区域（建议选择离你最近的区域）
6. 点击创建

## 2. 初始化数据库 Schema

在 Cloudflare Dashboard 中：

1. 进入你刚创建的 D1 数据库
2. 点击 **"执行 SQL"** 或 **"Query"** 标签
3. 复制 `schema.sql` 文件中的内容
4. 粘贴并执行，创建表和索引

或者使用 Wrangler CLI（推荐）：

```bash
# 安装 Wrangler（如果还没安装）
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 在项目根目录执行
wrangler d1 execute lateral-reading-logs --file=./schema.sql
```

## 3. 绑定 D1 数据库到 Pages 项目

1. 在 Cloudflare Dashboard 中，进入你的 Pages 项目
2. 点击 **"设置"** → **"函数"** → **"绑定"**
3. 点击 **"添加绑定"** → 选择 **"D1 数据库"**
4. **变量名称**填写：`DB`（必须与代码中的 `env.DB` 一致）
5. **数据库**选择你刚创建的数据库（如 `lateral-reading-logs`）
6. 选择环境（生产/预览）
7. 保存

## 4. 重新部署

绑定完成后，需要重新部署你的 Pages 项目：

- 如果是通过 Git 自动部署，推送一次代码即可
- 或者手动触发重新部署

## 5. 验证数据存储

部署后，测试一下应用，然后：

1. 进入 D1 数据库
2. 点击 **"浏览数据"** 或 **"Data"** 标签
3. 查看 `sessions` 和 `log_entries` 表是否有数据

## 6. 查询数据示例

在 D1 的 SQL 查询界面，你可以执行：

```sql
-- 查看所有会话
SELECT * FROM sessions ORDER BY started_at DESC LIMIT 10;

-- 查看某个会话的所有日志
SELECT * FROM log_entries WHERE session_id = 'your-session-id' ORDER BY timestamp;

-- 统计每个阶段的日志数量
SELECT stage, COUNT(*) as count FROM log_entries GROUP BY stage;

-- 查看完成的会话数量
SELECT COUNT(*) FROM sessions WHERE is_terminated = 1;
```

## 7. 导出数据

### 方法 1：通过 Cloudflare Dashboard
1. 进入 D1 数据库
2. 使用 SQL 查询导出为 CSV

### 方法 2：使用 Wrangler CLI
```bash
# 导出所有会话
wrangler d1 execute lateral-reading-logs --command "SELECT * FROM sessions" --output=json > sessions.json

# 导出所有日志条目
wrangler d1 execute lateral-reading-logs --command "SELECT * FROM log_entries" --output=json > log_entries.json
```

## 注意事项

- **免费版限制**：D1 免费版有 5GB 存储空间，对于实验数据来说应该足够
- **读写限制**：免费版每天有读写次数限制，但对于教学实验应该足够
- **数据持久性**：D1 数据是持久化的，不会自动删除
- **备份建议**：定期导出数据作为备份

## 故障排查

如果数据没有写入：

1. 检查 D1 绑定是否正确（变量名必须是 `DB`）
2. 检查数据库 schema 是否已创建
3. 查看 Cloudflare Workers 日志（在 Dashboard → Workers → 你的项目 → 日志）
4. 确认前端请求是否成功（浏览器开发者工具 → Network）

