interface Env {
  DB: D1Database;
}

interface Context {
  request: Request;
  env: Env;
}

interface CaptchaPayload {
  sessionId: string;
  captcha: string;
  generatedAt?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost = async (context: Context): Promise<Response> => {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: CaptchaPayload;
  try {
    body = (await request.json()) as CaptchaPayload;
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = body.sessionId?.trim();
  const captcha = body.captcha?.trim();
  const generatedAt = body.generatedAt || new Date().toISOString();

  if (!sessionId || !captcha) {
    return new Response(JSON.stringify({ error: 'Missing sessionId or captcha' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 确保 sessions 中有对应会话（若不存在则占位插入，避免外键约束失败）
    await env.DB.prepare(`
      INSERT OR IGNORE INTO sessions (
        session_id,
        scenario_title,
        scenario_fake_source,
        scenario_trace_image_context,
        scenario_assessment_context,
        started_at,
        stored_at,
        last_updated,
        ip,
        user_agent,
        is_terminated,
        full_conversation,
        first_log_id,
        last_log_id,
        verification_code
      ) VALUES (?, '横向阅读技能教学', NULL, NULL, NULL, ?, ?, ?, NULL, NULL, 0, NULL, NULL, NULL, ?)
    `).bind(sessionId, generatedAt, generatedAt, generatedAt, captcha).run();

    // 记录到 log_entries，便于与对话数据对齐
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
      ) VALUES (?, ?, 'system', 'CAPTCHA', 'TERMINATED', 1, 0, ?, NULL, 0, NULL)
    `);

    const logResult = await stmt.bind(sessionId, generatedAt, `CAPTCHA_CODE:${captcha}`).run();

    // 更新 sessions.verification_code 以便快速核对
    await env.DB.prepare(`
      UPDATE sessions
      SET verification_code = ?
      WHERE session_id = ?
    `).bind(captcha, sessionId).run();

    return new Response(JSON.stringify({ ok: true, sessionId, captcha }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'Failed to store captcha', detail: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
