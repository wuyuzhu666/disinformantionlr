// 前端发送的数据格式
interface FrontendLogPayload {
  sessionId: string;
  scenario: {
    // 兼容旧字段
    context?: string;
    trace_image_context?: string;
    assessment_context?: string;

    // 新字段：两条图文案例（用于横向阅读/反向检索对比）
    case1_context?: string;
    final_test_context?: string;
  };
  startedAt: string;
  logEntries: Array<{
    timestamp: string;
    role: 'user' | 'agent' | 'system';
    stage: string;
    required_action?: string;
    is_relevant?: boolean;
    offTopicCount?: number;
    text: string;
    image_url?: string | null;
    userImageAttached?: boolean;
    webUrlExtracted?: string | null;
  }>;
}

interface Env {
  DB: D1Database; // D1 数据库绑定
}

interface Context {
  request: Request;
  env: Env;
}

export const onRequestPost = async (context: Context): Promise<Response> => {
  const { request, env } = context;

  // 添加调试日志
  console.log('API /log called, DB available:', !!env.DB);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let body: FrontendLogPayload;

  try {
    body = (await request.json()) as FrontendLogPayload;
  } catch (e) {
    console.error('JSON parse error:', e);
    return new Response(JSON.stringify({ error: 'Invalid JSON body', detail: String(e) }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  // 验证必需字段
  if (!body.sessionId || !body.logEntries || !Array.isArray(body.logEntries)) {
    return new Response(JSON.stringify({ error: 'Missing required fields: sessionId, logEntries' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  const now = new Date().toISOString();
  const sessionId = body.sessionId;
  const scenario = body.scenario || {};

  console.log('Processing log for session:', sessionId, 'with', body.logEntries.length, 'entries');

  // 检查 DB 是否可用
  if (!env.DB) {
    console.error('DB is not available in env');
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    const isTerminated = body.logEntries.some(e => e.required_action === 'TERMINATED');
    
    // 将完整对话内容序列化为 JSON
    const fullConversationJson = JSON.stringify({
      sessionId,
      scenario: body.scenario,
      startedAt: body.startedAt,
      storedAt: now,
      isTerminated,
      logEntries: body.logEntries
    }, null, 2);

    // 只在对话结束时才存储（isTerminated = true）
    if (isTerminated) {
      console.log('Conversation terminated, storing full conversation...');
      
      // 1. 先批量插入日志条目到 log_entries 表
      let firstLogId: number | null = null;
      let lastLogId: number | null = null;
      
      if (body.logEntries.length > 0) {
        console.log('Inserting log entries...');
        
        const stmt = env.DB.prepare(`
          INSERT INTO log_entries (
            session_id,
            timestamp,
            role,
            stage,
            required_action,
            is_relevant,
            off_topic_count,
            text,
            image_url,
            user_image_attached,
            web_url_extracted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const batch = body.logEntries.map(entry => 
          stmt.bind(
            sessionId,
            entry.timestamp,
            entry.role,
            entry.stage || null,
            entry.required_action || null,
            entry.is_relevant ? 1 : 0,
            entry.offTopicCount || 0,
            entry.text,
            entry.image_url || null,
            entry.userImageAttached ? 1 : 0,
            entry.webUrlExtracted || null
          )
        );

        await env.DB.batch(batch);
        console.log('Log entries inserted, batch size:', body.logEntries.length);

        // 查询实际插入的 id 范围（通过 session_id 和 timestamp 匹配）
        const idRangeResult = await env.DB.prepare(`
          SELECT MIN(id) as first_id, MAX(id) as last_id 
          FROM log_entries 
          WHERE session_id = ?
        `).bind(sessionId).first();

        if (idRangeResult) {
          firstLogId = (idRangeResult as any).first_id;
          lastLogId = (idRangeResult as any).last_id;
          console.log('Log entry ID range:', { firstLogId, lastLogId, sessionId });
        } else {
          console.warn('Could not retrieve log entry ID range for session:', sessionId);
        }
      } else {
        console.warn('No log entries to insert for session:', sessionId);
      }
      
      // 2. 插入或更新会话记录，包含完整对话内容和 log_entries 的 id 范围
      const scenarioTitle =
        scenario.case1_context ||
        scenario.final_test_context ||
        scenario.trace_image_context ||
        scenario.assessment_context ||
        scenario.context
          ? '虚假信息教学案例'
          : '未知';

      // 先查询是否已存在会话，以保留验证码等信息
      const existingSession = await env.DB.prepare(
        `SELECT verification_code FROM sessions WHERE session_id = ?`
      ).bind(sessionId).first();

      const existingVerificationCode =
        existingSession && (existingSession as any).verification_code
          ? (existingSession as any).verification_code
          : null;

      const sessionResult = await env.DB.prepare(`
        INSERT OR REPLACE INTO sessions (
          session_id,
          scenario_title,
          scenario_fake_source,
          scenario_trace_image_context,
          scenario_assessment_context,
          started_at,
          stored_at,
          last_updated,
          is_terminated,
          full_conversation,
          first_log_id,
          last_log_id,
          verification_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sessionId,
        '横向阅读技能教学',
        scenario.context || scenario.case1_context || scenario.trace_image_context || null,
        scenario.trace_image_context || scenario.case1_context || null,
        scenario.assessment_context || scenario.final_test_context || null,
        body.startedAt || now,
        now,
        now,
        1, // is_terminated = true
        fullConversationJson, // 完整对话内容
        firstLogId,
        lastLogId,
        existingVerificationCode
      ).run();
      console.log('Session stored successfully:', sessionResult);

      return new Response(JSON.stringify({ 
        ok: true, 
        sessionId,
        message: 'Full conversation stored',
        logEntriesCount: body.logEntries.length,
        firstLogId,
        lastLogId
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } else {
      // 对话未结束，不存储到数据库
      console.log('Conversation not terminated yet, skipping database storage');
      return new Response(JSON.stringify({ 
        ok: true, 
        sessionId,
        message: 'Conversation in progress, not stored yet',
        logEntriesCount: body.logEntries.length 
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    console.log('All operations completed successfully');

    return new Response(JSON.stringify({ 
      ok: true, 
      sessionId,
      sessionsInserted: 1,
      logEntriesInserted: body.logEntries.length 
    }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

  } catch (err) {
    console.error('Database error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: err instanceof Error ? err.name : undefined
    });
    
    return new Response(JSON.stringify({ 
      error: 'Failed to write to database', 
      detail: errorMessage,
      stack: errorStack,
      type: err instanceof Error ? err.name : typeof err
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
};
