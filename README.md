# 横向阅读教练 - 横向阅读技能教学助手

一个基于 AI 的交互式媒介素养教学工具，通过分阶段对话引导用户掌握横向阅读与图片追踪等关键查证技能，提升信息辨析能力。

## 功能特点

- 🎓 **分阶段教学**：通过 4 个阶段（意识唤醒 → 横向阅读 → 图片追踪 → 独立评估）系统化教学
- 🔍 **技能训练**：重点培养横向阅读（信源核查）和图片追踪（反向图片搜索）能力
- 🤖 **AI 引导**：使用 Google Gemini 2.5 Flash 模型提供智能教学引导
- 📊 **数据收集**：自动记录所有交互数据，支持教学研究和效果评估
- 📱 **响应式设计**：完美适配桌面端和移动端，支持嵌入问卷平台

## 技术栈

- **前端框架**：React 19 + TypeScript + Vite
- **AI 模型**：Google Gemini 2.5 Flash（通过 OpenRouter）
- **部署平台**：Cloudflare Pages
- **数据存储**：Cloudflare D1 (SQLite)
- **网页读取**：Jina Reader（自动读取用户提交的链接）

## 快速开始

### 本地开发

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置 API Key**
   
   在 `index.tsx` 中修改 `USER_CONFIG.MY_API_KEY`，填入你的 OpenRouter API Key：
   ```typescript
   const USER_CONFIG = {
     MY_API_KEY: "your-openrouter-api-key",
     BASE_URL: "https://openrouter.ai/api/v1",
     MODEL: "google/gemini-2.5-flash-lite-preview-09-2025",
   };
   ```
   
   或者使用环境变量（推荐）：
   - 创建 `.env.local` 文件
   - 添加 `VITE_API_KEY=your-openrouter-api-key`

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **构建生产版本**
   ```bash
   npm run build
   ```

### 部署到 Cloudflare Pages

1. **连接 GitHub 仓库**
   - 在 Cloudflare Dashboard 创建新的 Pages 项目
   - 连接到你的 GitHub 仓库

2. **配置构建设置**
   - 构建命令：`npm run build`
   - 构建输出目录：`dist`
   - 根目录：`/`（默认）

3. **设置 D1 数据库**（用于数据收集）
   
   详细步骤请参考 [D1_SETUP.md](./D1_SETUP.md)
   
   简要步骤：
   - 创建 D1 数据库（如 `lateral-reading-logs`）
   - 执行 `schema.sql` 创建表结构
   - 在 Pages 项目中绑定 D1 数据库，变量名设为 `DB`

4. **配置环境变量**（可选）
   - 在 Pages 项目设置中添加 `VITE_API_KEY`（如果不想在代码中硬编码）

## 项目结构

```
lateral-reading-agent/
├── index.tsx              # 主应用文件（React 组件）
├── index.html             # HTML 入口文件
├── schema.sql             # D1 数据库表结构
├── functions/
│   └── api/
│       └── log.ts         # 数据收集 API（Cloudflare Pages Functions）
├── D1_SETUP.md            # D1 数据库设置指南
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 配置说明

### 教学案例配置

在 `index.tsx` 中修改 `CURRENT_SCENARIO` 来更换教学案例：

```typescript
const CURRENT_SCENARIO = {
  context: "你的虚假信息内容...\n\n来源：虚假信源名称",
  trace_image_context: "图片追踪任务的描述",
  assessment_context: "独立评估任务的描述"
};
```

### 图片库配置

在 `index.tsx` 中修改 `IMAGE_LIBRARY` 来更换图片：

```typescript
const IMAGE_LIBRARY: { [key: string]: string } = {
  'IMG_TRACE_DEFAULT': '你的图片URL',
  'IMG_ASSESSMENT_DEFAULT': '你的图片URL',
};
```

## 数据收集

系统会自动收集以下数据：

- **会话信息**：session_id、场景配置、开始时间等
- **交互日志**：每条用户和 Agent 的对话记录
- **行为数据**：阶段进度、是否上传图片/链接、相关性判断等

数据存储在 Cloudflare D1 数据库中，可以通过 SQL 查询导出和分析。

## 嵌入问卷平台

本项目支持嵌入到问卷平台（如问卷星、见数等）：

```html
<iframe
  src="https://your-cloudflare-pages-url.pages.dev/"
  width="100%"
  height="640"
  style="border:1px solid #e5e7eb; border-radius:12px;"
></iframe>
```

**注意**：问卷星要求网站备案，如未备案可使用见数等其他平台。

## 教学框架

基于 Wardle & Derakhshan (2017) 的"信息失序"（Information Disorder）框架，重点针对：

- **误导性内容** (Misleading Content)：真图假语境
- **伪造内容** (Fabricated Content)：完全虚构的信息
- **错误关联** (False Connection)：标题党

## 许可证

本项目为教学研究用途。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系。
