// 测试数据库连接的端点
interface Env {
  DB: D1Database;
}

interface Context {
  request: Request;
  env: Env;
}

export const onRequestGet = async (context: Context): Promise<Response> => {
  const { env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (!env.DB) {
    return new Response(JSON.stringify({ 
      error: 'Database not configured',
      dbAvailable: false 
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // 测试查询 sessions 表
    const sessionsTest = await env.DB.prepare('SELECT COUNT(*) as count FROM sessions').first();
    
    // 测试查询 log_entries 表
    const logEntriesTest = await env.DB.prepare('SELECT COUNT(*) as count FROM log_entries').first();

    // 检查表结构
    const sessionsSchema = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").first();
    const logEntriesSchema = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='log_entries'").first();

    return new Response(JSON.stringify({
      success: true,
      dbAvailable: true,
      tables: {
        sessions: {
          exists: !!sessionsSchema,
          count: sessionsTest?.count || 0
        },
        log_entries: {
          exists: !!logEntriesSchema,
          count: logEntriesTest?.count || 0
        }
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Database test failed',
      detail: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
};

