// Cloudflare Workers 环境类型定义
export interface Env {
  DB: D1Database; // D1 数据库绑定（变量名必须与 Cloudflare Dashboard 中的绑定名称一致）
}

// D1Database 类型在 Cloudflare Workers 运行时中可用
// 如果 TypeScript 报错，可以忽略，运行时是正确的


