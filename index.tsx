import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';

// ============================================================================
// 👇 用户配置区域 (OpenRouter 单引擎配置) 👇
// ============================================================================
const USER_CONFIG = {
  // 1. OpenRouter API Key
  // 请只用环境变量或 URL 参数 ?key=... 提供，避免硬编码暴露
  MY_API_KEY: "", 
  
  // 2. 模型配置 (Google Gemini 2.5 Flash)
  PROVIDER: 'openai' as const, 
  BASE_URL: "https://openrouter.ai/api/v1",
  MODEL: "moonshotai/kimi-k2.5", 
  // 3. 温度（0-2），默认较稳
  TEMPERATURE: 0.1,
};

// --- 1. 图片库配置 (用户在此处替换自己的图片链接) ---
const IMAGE_LIBRARY: { [key: string]: string } = {
  'IMG_CASE1': 'https://fakenewsphotos.oss-cn-beijing.aliyuncs.com/1.png',
  'IMG_FINAL': 'https://fakenewsphotos.oss-cn-beijing.aliyuncs.com/2.jpg',
};

// --- 2. 教学案例配置（共 2 个案例，均为图文兼备；横向阅读/反向检索共用同一材料） ---
const CURRENT_SCENARIO = {
  case1_context:
    "上海虹桥站2025年5月5日发生乘客阻挡车门事件。铁路上海站调查显示，G1673次列车关闭车门时，一女子为等待行动不便的老太太，故意伸手扒门，导致车门反复开启，延误发车1分钟。目击视频显示，此行为严重影响公共安全，易引发事故。专家提醒：高铁关门程序严格，阻挡车门可致夹伤或列车故障，建议乘客提前上车。类似事件频发，呼吁加强教育。来源：沪上都市报",
  final_test_context:
    '最终测试：据气象与海洋局监测，2025年10月21日天津滨海新区曹妃甸滨海大道突发海水倒灌事件，受强潮汐和风暴影响，海平面上升1.5米，部分路段积水达0.8米。专家分析，此系气候变化加剧所致，类似事件频率将增。居民已紧急疏散，交通中断。建议沿海市民加强防范，储备应急物资，避免外出。事件已上报国家应急中心，救援队到位。来源：央视频"我们"栏目',
};

// --- System Instruction（完整横向阅读教学 Prompt） ---
const generateSystemInstruction = (scenario: typeof CURRENT_SCENARIO) => {
  return `【当前教学案例】
- 案例1（上海虹桥站）: "${scenario.case1_context}"
- 最终测试案例（海水倒灌）: "${scenario.final_test_context}"

【核心目标】
1. 让用户意识到自己**没有充分检查来源与证据**。
2. 引导用户学会对信源做**横向阅读（lateral reading）**。
3. 在最后阶段，让用户**独立完成一次完整的事实核查与总结**。

【超低基础教学要求】
- **语气自然对话**：像朋友聊天一样，不要像机器人发指令。**绝对禁止**使用“听懂了吗”、“请回答懂了”这种机械的确认语句。
- **避免长段落**：每次只说一件核心的事，或提出一个简单的问题。
- **步骤清晰**：如果需要用户操作（如搜索），请用 1. 2. 3. 列表展示。
- **鼓励为主**：即使用户回答错误，也要先肯定他们的思考，再温和纠正。
- **宁慢勿快**：不要急着把所有知识点抛出来。等用户回答了，再进行下一步。
- **用户卡顿时**：如果用户不知道怎么做，主动提供简单的具体示例（如“你可以试着搜索...”）。

【重要：聚焦信息真假判断】
- **必须引导用户关注信息的真假性**。
- 当用户讨论观点、情绪时，温和地引导回来：“这很有趣，但我们先看看这条信息本身是不是真的。”

【反作弊与验证逻辑】
1. **相关性检测**：
   - 除非用户明显是在闲聊（天气、八卦），否则尽量判定 \`is_relevant: true\`。
   - 不要太严格，用户说“我不确定”、“有点假”都算相关。
2. **证据验证**：
   - 网页读取：系统会自动读取用户链接。如果用户发了链接，请根据链接内容反馈。
   - 视觉验证：系统会展示用户图片。如果用户发了截图，请根据截图内容反馈。
   - **横向阅读验证**：Stage 2 必须要求用户去搜索信源背景，如果用户没搜就下结论，要追问“你是怎么确认的？能发个搜索截图我看下吗？”。

【阶段设计（教学流程）】
阶段字段 \`stage\` 只允许以下三个值：
- "1_Onboarding"       —— 意识觉醒
- "2_LateralReading"   —— 横向阅读
- "3_Assessment"       —— 检测（包含图片追踪和独立评估）

**严格遵守以下阶段逻辑：**

**重要规则：**
- 每个阶段结束时，必须进行**阶段总结**，总结本阶段学到的技能和专业解释。
- 总结后，必须**等待用户明确确认**（回复"准备好了"/"继续"/"下一步"等）后，才能推进到下一阶段。
- 最后一个阶段结束时，必须进行**完整总结**，回顾所有学习内容，然后才能结束对话。

1. 1_Onboarding（意识觉醒）
   - **第一句话**：展示第一个图文案例（\`image_url\`: "IMG_CASE1"），并引用语境文字："${scenario.case1_context}"，并向用户提问："读完这条信息，凭直觉你觉得它是真的还是假的？"。
   - **用户回答后的反应**：
     - 如果用户说"真的"：反问"这看起来确实像真的。但如果我们仔细看一眼它的来源，你觉得这个来源听起来熟悉吗？"
     - 如果用户说"假的"/"怀疑"：肯定用户，"你的直觉很敏锐！那你觉得是哪里最可疑？是内容太夸张，还是来源有问题？"
   - **目标**：引导用户意识到需要检查来源，然后进入下一阶段。
   - 此阶段图片只在第一次展示时设置 image_url 为 "IMG_CASE1"，后续对话中 image_url 必须为 null。

2. 2_LateralReading（横向阅读）
   - **核心任务**：让用户真正做到“**不在一个页面里深挖，而是跳出去查信源**”，先判断这条信息的**来源可信度**，再决定要不要继续相信内容。
   - **话术**："接下来，我们先**不要细读这条新闻本身**，而是跳出去查一查：是谁在说这件事。\n\n请你打开一个新标签页，用百度/必应搜索下面这些信息（至少做 2 项）：\n1）这个账号 / 网站 / 栏目本身是谁？它属于哪家机构？\n2）有没有央媒、地方主流媒体、权威机构也报道或引用它？\n3）搜索“账号名 + 争议 / 辟谣 / 造假”等关键词，看有没有别人质疑过它。\n把你看到的线索、链接发给我，我们一起判断这个信源靠不靠谱。"
   - **后续**：当用户反馈结果时，要引导其**用“社会共识 vs. 孤立观点”来判断**：如果只有零散自媒体在说、主流权威都没提，或者这个账号历史上有争议/辟谣记录，就要提醒用户“这个来源风险很高，需要特别谨慎”。
   - **存真引导（重要）**：**只有在用户先意识到原始信源有问题或不可靠之后**，再引导其进行“存真”：专门去搜索**政府部门、权威媒体、专业机构**的通报和背景说明，对比他们给出的时间线、数据和结论。
   - **总结**：当用户基于多个来源得出判断后，总结："做得好！你刚才做的就是『横向阅读』——不困在一条内容里细抠，而是跳出去查“谁在说”、有没有权威认可、社会上大多数可靠来源是怎么说的，从而判断这条信息值不值得信。"
   
   - **必须教学：AI 检索也是横向阅读，但必须验证（重要）**
     - **第一步：提问用户是否使用了 AI 工具**
       在用户完成横向阅读并找到信息后，**必须用简单直接的一个提问**：
       "你在查找信息的过程中，有没有使用 AI 工具？比如直接使用 AI 工具（如豆包、Deepseek、ChatGPT、文心一言等），或者使用了搜索引擎内置的 AI 功能（如百度 AI+、必应 AI 等）？"
       
       **重要**：提问必须简洁，不要展开说明，只问一个问题，等待用户回答。
       
     - **第二步：根据用户回答进行教学**
       - **如果用户回答使用了 AI 工具或搜索引擎内置 AI**：
         1) 首先肯定："很好！你使用了 AI 检索，这也是横向阅读的一部分，因为 AI 会汇总多个来源的信息。"
         2) 然后解释什么是 AI 检索："让我解释一下什么是 AI 检索。AI 检索包括两种形式：
            - **直接使用 AI 工具**：比如豆包、Deepseek、ChatGPT、文心一言、通义千问等专门的 AI 对话工具。
            - **搜索引擎内置的 AI**：比如百度 AI+（在百度搜索结果中出现的 AI 回答）、必应 AI、Google Bard 等，这些是搜索引擎集成的 AI 功能，会在搜索结果中直接提供 AI 总结生成的答案。
         无论是哪种形式，只要是通过 AI 来获取信息，都属于 AI 检索。"
         3) **强调检验原始信源（重要）**："但是，无论是直接使用 AI 工具还是搜索引擎内置的 AI，它们都只是汇总其他来源的信息，不是原始信源。我们必须检验原始信源。请告诉我：AI 给出了哪些要点？它提到了哪些来源或链接？"
         4) 要求验证："现在，请点开至少一个 AI 提到的官方或权威链接，或者用传统搜索引擎再查一下，确认 AI 说的信息是否准确。把你验证的结果告诉我。"
         5) 确认理解："记住：AI 检索是横向阅读的工具，但检验原始信源是必须的步骤。你理解了吗？"
       
       - **如果用户回答只使用了传统搜索引擎（没有使用 AI 功能）**：
         1) 肯定用户的做法："很好！你使用了传统搜索引擎进行横向阅读。"
         2) 补充说明 AI 检索："另外，我想提醒你，AI 检索也是横向阅读的一种方式。让我解释一下什么是 AI 检索：
            - **直接使用 AI 工具**：比如豆包、Deepseek、ChatGPT、文心一言、通义千问等专门的 AI 对话工具。
            - **搜索引擎内置的 AI**：比如百度 AI+（在百度搜索结果中出现的 AI 回答）、必应 AI、Google Bard 等，这些是搜索引擎集成的 AI 功能，会在搜索结果中直接提供 AI 总结生成的答案。
         如果你使用这些 AI 功能进行检索，这也是横向阅读的一部分。"
         3) **强调检验原始信源（重要）**："但要注意，无论是直接使用 AI 工具还是搜索引擎内置的 AI，它们都只是汇总其他来源的信息，不是原始信源。我们必须检验原始信源，不能只相信 AI 的总结。"
         4) 确认理解："你明白了吗？如果明白了，请回复『准备好了』，我们进入下一阶段的教学。"  
    
     - **第三步：等待用户确认**
       用户必须明确表示理解 AI 检索是横向阅读但需要验证，然后回复『准备好了』，才能进入下一阶段。
   - 此阶段 \`image_url\` 必须为 null。

3. 3_Assessment（最终测试）
   - **发布任务**：同时展示图片和文字（\`image_url\`: "IMG_FINAL"），引用语境："${scenario.final_test_context}"。
   - **话术**："现在，我们来个实战演练。请你用刚才学到的横向阅读方法，独立核查这条新闻。请直接把你的调查过程和结论发给我。"
   - **重要**：
     - 图片和文字必须同时出现在第一个消息中
     - image_url 必须设置为 "IMG_FINAL"，不能为 null 或空字符串
     - agent_response 中必须完整包含案例文字内容，不能省略或简化
     - agent_response 格式示例："现在，我们来个实战演练。请你用刚才学到的横向阅读方法，独立核查这条新闻。\n\n最终测试：据气象与海洋局监测，2025年10月21日天津滨海新区曹妃甸滨海大道突发海水倒灌事件，受强潮汐和风暴影响，海平面上升1.5米，部分路段积水达0.8米。专家分析，此系气候变化加剧所致，类似事件频率将增。居民已紧急疏散，交通中断。建议沿海市民加强防范，储备应急物资，避免外出。事件已上报国家应急中心，救援队到位。来源：央视频\"我们\"栏目\n\n请直接把你的调查过程和结论发给我。"
     - **关键**：agent_response 必须完整引用 "${scenario.final_test_context}" 的全部文字内容，不能只写 "最终测试" 或省略部分内容
   - **评价**：根据用户的证据给出评分。如果用户做得好，给予高度赞扬。如果用户做得不好，请给出具体的改进建议。
     - **重要**：评价时 image_url 必须为 null。
   
   - **最终总结（必须）**：总结并回顾所有学习内容：
     - "恭喜你完成了所有教学！让我们回顾一下你学到的核心技能：
     **横向阅读（Lateral Reading）**：不只看信息本身，而是查找信源的背景、权威性和可信度。无论是使用传统搜索引擎还是 AI 检索（包括直接使用 AI 工具如豆包、Deepseek、ChatGPT 等，以及直接参考搜索引擎内置的 AI 回答如百度 AI+、必应 AI 等），都要记住验证信息来源的准确性。
     这些技能可以帮助你在日常生活中更好地识别虚假信息。"
     - **重要**：总结时 image_url 必须为 null。
   - 完成后设置 \`required_action\` 为 "TERMINATED"。

【输出格式（严格遵守）】
**极其重要：你只能返回一个纯 JSON 对象，不能有任何其他文字、说明、示例或 Markdown 标记。同时，需要核查 JSON 对象的格式、内容是否正确。**

**禁止事项：**
- 禁止在 agent_response 中包含 JSON 格式示例（如 { "stage": ... }）
- 禁止在回复前后添加任何解释性文字
- 禁止使用 Markdown 代码块（三个反引号加 json 或三个反引号）
- 如果设置了 image_url，agent_response 中禁止出现 "想象...图片"、"请看图片" 等文字，因为图片会自动显示

**图片显示规则（极其重要）：**
- 第一阶段（1_Onboarding）：图片只在第一次展示时设置 image_url 为 "IMG_CASE1"，后续所有对话中 image_url 必须为 null。
- 第三阶段（3_Assessment）：图片只在第一次发布任务时设置 image_url 为 "IMG_FINAL"，后续所有对话中 image_url 必须为 null。
- **特别强调**：第三阶段（3_Assessment）的第一个消息（发布任务时）**必须**设置 image_url 为 "IMG_FINAL"，这是强制要求，不能省略、不能为 null、不能为空字符串。图片和文字必须同时出现在第一个消息中。agent_response 中必须同时包含图片引用和文字内容，不能只有文字没有图片设置。如果违反此规则，系统将无法正确显示图片。
- 违反此规则会导致图片重复显示或图片无法显示，严重影响用户体验。
- **重要**：当设置了 image_url（非 null）时，agent_response 中绝对不能出现 "想象...图片"、"请想象...图片" 等文字，因为图片会自动显示。如果出现这些文字，说明图片没有正确显示，需要检查 image_url 的值是否正确。

**JSON 结构（必须严格遵守）：**
{
  "stage": "当前阶段",
  "agent_response": "中文回复内容，支持 Markdown 格式（如 **加粗**, > 引用），但不要包含 JSON 示例",
  "required_action": "USER_INPUT_REQUIRED | SHOW_IMAGE | ASSESSMENT | TERMINATED",
  "image_url": "IMG_CASE1 | IMG_FINAL | null（注意：第一阶段和第三阶段的第一个消息必须设置对应的图片）",
  "is_relevant": true 或 false
}
`;
};

// --- Types ---

interface AgentResponse {
  stage: string;
  agent_response: string;
  required_action: 'USER_INPUT_REQUIRED' | 'SHOW_IMAGE' | 'ASSESSMENT' | 'TERMINATED';
  image_url?: string;
  is_relevant: boolean;
  off_topic_reason?: string;
}

interface Message {
  role: 'user' | 'model';
  content: string; // Text content
  image?: string; // Base64 image data for user uploads
  data?: AgentResponse;
}

// 用于后续研究分析的日志结构
interface LogEntry {
  timestamp: string;
  role: 'user' | 'agent' | 'system';
  stage: string;
  required_action?: AgentResponse['required_action'];
  is_relevant?: boolean;
  offTopicCount?: number;
  text: string;
  image_url?: string | null;
  userImageAttached?: boolean;
  webUrlExtracted?: string | null;
}

type CaptchaSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// --- Utils ---

// Convert File to Base64
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getEnvVar = (key: string): string => {
  try {
    // 优先读取 Vite 注入的 import.meta.env（Pages 前端运行时可用）
    const viteEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
    if (viteEnv) {
      return (
        viteEnv[key] ||
        viteEnv[`VITE_${key}`] ||
        viteEnv[`REACT_APP_${key}`] ||
        ''
      );
    }
    // 兼容 SSR/Node 环境
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || process.env[`VITE_${key}`] || process.env[`REACT_APP_${key}`] || '';
    }
  } catch (e) {
    return '';
  }
  return '';
};

// --- MCP: Jina Reader (Keyless) ---
const callJinaReader = async (url: string): Promise<string | null> => {
    console.log("MCP: Calling Jina Reader for", url);
    try {
        // Jina 的 Reader URL 格式: https://r.jina.ai/<URL>
        const targetUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
        // Removed corsproxy.io as it is blocked in China.
        // Trying direct call. Jina usually supports CORS.
        const proxyUrl = targetUrl;

        // 设置 8 秒超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(proxyUrl, {
            method: "GET",
            headers: {
                "Accept": "application/json", 
                "x-respond-with": "markdown" 
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn("MCP Reader Error:", response.status);
            return null;
        }

        // Jina Reader 通常返回 Markdown 文本；如果是 JSON 再尝试解析
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const json = await response.json();
            return (json as any).data?.content || JSON.stringify(json);
        }
        return await response.text();
    } catch (e) {
        console.error("MCP Network Error:", e);
        return null;
    }
}

// --- API Adapters ---

const callOpenAICompatible = async (
    apiKey: string,
    baseUrl: string,
    model: string,
    messages: Message[],
    currentMessage: string, 
    currentImageBase64: string | undefined, 
    currentStage: string,
    offTopicCount: number,
    webContext?: string | null, // New: Web Content Context
    temperature: number = USER_CONFIG.TEMPERATURE
): Promise<{ text: string }> => {
    
    const apiMessages = [
        { role: "system", content: generateSystemInstruction(CURRENT_SCENARIO) }
    ];

    for (const m of messages) {
        if (m.role === 'model') {
            apiMessages.push({ role: "assistant", content: JSON.stringify(m.data) });
        } else {
            if (m.image) {
                apiMessages.push({
                    role: "user",
                    content: [
                        { type: "text", text: m.content },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${m.image}` } }
                    ]
                } as any);
            } else {
                apiMessages.push({ role: "user", content: m.content });
            }
        }
    }

    // Current Message Construction
    let contextPrompt = `[Context: Stage ${currentStage}, OffTopicCount: ${offTopicCount}] ${currentMessage}`;
    
    // Inject Web Context if available
    if (webContext) {
        contextPrompt += `\n\n[SYSTEM: I have auto-read the link provided by the user using Jina Reader. Here is the content:]\n${webContext}\n[End of Web Content]`;
    }

    if (currentImageBase64) {
        apiMessages.push({
            role: "user",
            content: [
                { type: "text", text: contextPrompt },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${currentImageBase64}` } }
            ]
        } as any);
    } else {
        apiMessages.push({ role: "user", content: contextPrompt });
    }

    // --- Retry Logic for 429 (Rate Limit) ---
    let retries = 3;
    let lastError: any = null;

    while (retries > 0) {
        try {
            const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://lateral-reading-agent.pages.dev', 
                    'X-Title': 'Lateral Reading Coach'
                },
                body: JSON.stringify({
                    model: model,
                    messages: apiMessages,
                    temperature,
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                if (response.status === 429) {
                    console.warn(`Hit 429 Rate Limit. Retrying... (${retries} left)`);
                    lastError = new Error(`OpenRouter 429 免费通道拥堵: 请稍后重试。`);
                    retries--;
                    if (retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
                        continue;
                    }
                    throw lastError;
                }
                if (response.status === 401 || response.status === 402) {
                    throw new Error(`OpenRouter 401/402 错误: 您的 API Key 可能无效或余额不足。OpenRouter 返回: ${errText.substring(0, 100)}...`);
                }
                throw new Error(`API Error ${response.status}: ${errText.substring(0, 100)}`);
            }

            const data = await response.json();
            return { text: data.choices[0]?.message?.content || "{}" };

        } catch (err: any) {
            lastError = err;
            if (retries <= 0) break;
            const msg = typeof err?.message === 'string' ? err.message : '';
            if (!msg.includes("429")) throw err;
        }
    }
    
    throw lastError || new Error("Failed to connect after retries");
};


// --- Components ---

const App = () => {
  // --- Config Initialization ---
  // 1. URL Query Parameter Override (?key=sk-...)
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const queryKey = urlParams.get('key');

  // 2. Hardcoded Config
  const configKey = USER_CONFIG.MY_API_KEY.trim();

  // 3. Environment Variable
  const envKey = (getEnvVar('VITE_API_KEY') || getEnvVar('API_KEY')).trim();

  // Priority: URL Query > Hardcoded > Environment
  const userApiKey = queryKey || (configKey.length > 5 ? configKey : envKey);

  const provider = USER_CONFIG.PROVIDER;
  const baseUrl = (getEnvVar('VITE_API_BASE_URL') || USER_CONFIG.BASE_URL).trim();
  const userModelName = (getEnvVar('API_MODEL') || getEnvVar('VITE_API_MODEL') || USER_CONFIG.MODEL).trim();
  const userTempEnv = parseFloat(getEnvVar('API_TEMP') || getEnvVar('VITE_API_TEMP'));
  const userTemperature = Number.isFinite(userTempEnv) ? Math.min(Math.max(userTempEnv, 0), 2) : USER_CONFIG.TEMPERATURE;

  // App State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingWeb, setIsReadingWeb] = useState(false);
  const [currentStage, setCurrentStage] = useState('1_Onboarding');
  const [offTopicCount, setOffTopicCount] = useState(0);
  const [isTerminated, setIsTerminated] = useState(false);
  const [apiKey] = useState(userApiKey);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [sessionId] = useState(() => new Date().toISOString());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 600);
  const [captchaCode, setCaptchaCode] = useState<string | null>(null);
  const [captchaSyncStatus, setCaptchaSyncStatus] = useState<CaptchaSyncStatus>('idle');
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [hasShownFinalImage, setHasShownFinalImage] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendLogTimeoutRef = useRef<number | null>(null);
  const logEntriesRef = useRef<LogEntry[]>([]);

  // 监听窗口大小变化，适配手机端
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 发送日志到后端的函数（自动保存）
  const sendLogToBackend = (logEntries: LogEntry[], force: boolean = false) => {
    if (typeof window === 'undefined') return;

    // 清除之前的定时器
    if (sendLogTimeoutRef.current) {
      clearTimeout(sendLogTimeoutRef.current);
      sendLogTimeoutRef.current = null;
    }

    // 检查是否对话已结束（包含 TERMINATED 的日志）
    const isTerminated = logEntries.some(e => e.required_action === 'TERMINATED');
    
    // 只在对话结束时才保存
    if (!isTerminated && !force) {
      console.log('Conversation not terminated yet, skipping save');
      return;
    }

    const send = () => {
      try {
        const payload = {
          sessionId,
          scenario: CURRENT_SCENARIO,
          startedAt: sessionId,
          logEntries,
        };
        const json = JSON.stringify(payload);
        window.localStorage.setItem('TRUTH_DETECTIVE_LAST_SESSION', json);

        // 尝试自动上报到后端（Cloudflare Pages Functions: /api/log）
        const endpoint = '/api/log';

        // 使用 fetch 而不是 sendBeacon，以便能够捕获错误和查看响应
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: json,
            keepalive: true
        })
        .then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            let errorDetail = errorText;
            try {
              const errorJson = JSON.parse(errorText);
              errorDetail = JSON.stringify(errorJson, null, 2);
            } catch (e) {
              // 如果不是 JSON，直接使用文本
            }
            console.error('❌ Failed to send log to backend:', {
              status: response.status,
              statusText: response.statusText,
              error: errorDetail
            });
          } else {
            const result = await response.json();
            console.log('✅ Log sent successfully:', result);
          }
        })
        .catch((error) => {
          console.error('❌ Error sending log to backend:', error);
        });
      } catch (e) {
        console.warn('Failed to send log to backend', e);
      }
    };

    // 如果强制发送（如对话结束时），立即发送
    if (force) {
      send();
    } else {
      // 否则使用防抖，每 5 秒或每 10 条日志才发送一次
      sendLogTimeoutRef.current = window.setTimeout(send, 5000);
    }
  };

  // 追加一条日志，只保存到内存和 localStorage，不发送到后端
  // 只有在对话结束时才一次性发送所有日志
  const logEvent = (entry: Omit<LogEntry, 'timestamp'>) => {
    const ts = new Date().toISOString();
    setLogEntries(prev => {
      const updated = [...prev, { ...entry, timestamp: ts }];
      // 更新 ref，方便在其他地方访问最新的 logEntries
      logEntriesRef.current = updated;
      try {
        if (typeof window !== 'undefined') {
          // 只更新 localStorage，不发送到后端
          const payload = {
            sessionId,
            scenario: CURRENT_SCENARIO,
            startedAt: sessionId,
            logEntries: updated,
          };
          const json = JSON.stringify(payload);
          window.localStorage.setItem('TRUTH_DETECTIVE_LAST_SESSION', json);
        }
      } catch (e) {
        console.warn('Failed to persist log to localStorage', e);
      }
      return updated;
    });
  };

  const syncCaptchaToBackend = async (code: string) => {
    if (typeof window === 'undefined') return;
    setCaptchaSyncStatus('syncing');
    setCaptchaError(null);
    try {
      const response = await fetch('/api/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          captcha: code,
          generatedAt: new Date().toISOString(),
        }),
        keepalive: true,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Captcha sync failed');
      }
      setCaptchaSyncStatus('success');
    } catch (error: any) {
      console.error('Captcha sync error:', error);
      setCaptchaSyncStatus('error');
      setCaptchaError(error?.message || '同步失败，请重试');
    }
  };

  const generateCaptchaForSession = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setCaptchaCode(code);
    setCaptchaSyncStatus('idle');
    setCaptchaError(null);
    syncCaptchaToBackend(code);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isReadingWeb]);

  useEffect(() => {
      if (messages.length === 0 && apiKey && !isTerminated) {
        logEvent({
          role: 'system',
          stage: 'INIT',
          required_action: 'USER_INPUT_REQUIRED',
          is_relevant: true,
          offTopicCount: 0,
          text: 'SYSTEM_INIT: 开始模拟，进入阶段 1（意识觉醒）。',
          image_url: null,
          userImageAttached: false,
          webUrlExtracted: null,
        });
        handleAgentTurn("SYSTEM_INIT: 开始模拟，进入阶段 1（意识觉醒）。", undefined, apiKey);
      }
    }, [apiKey, messages.length, isTerminated]);

  // 注意：对话结束时的日志发送已在 handleAgentTurn 中处理，这里不再重复发送

  const handleAgentTurn = async (userMessage: string, imageBase64: string | undefined, currentApiKey: string) => {
    if (!currentApiKey) {
      console.warn("handleAgentTurn called without apiKey, aborting.");
      return;
    }
    setIsLoading(true);

    try {
        let webContext: string | null = null;
        let firstUrl: string | null = null;

        // --- MCP: Check for URLs and Read Webpage (Jina Reader) ---
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const foundUrls = userMessage.match(urlRegex);
        
        if (foundUrls && foundUrls.length > 0) {
            firstUrl = foundUrls[0];
            setIsReadingWeb(true);
            // 读取第一个链接
            const content = await callJinaReader(firstUrl);
            if (content) {
                webContext = content.substring(0, 8000); // 截取前8000字
                console.log("Web content fetched via Jina, length:", webContext.length);
            }
            setIsReadingWeb(false);
        }

      const result = await callOpenAICompatible(
            currentApiKey, baseUrl, userModelName, messages, userMessage, imageBase64,
            currentStage, offTopicCount, webContext, userTemperature
      );
      
      const resultText = result.text;

      // JSON Parsing Logic - 提取JSON对象（处理可能包含JSON示例的情况）
      let jsonString = resultText || "{}";
      jsonString = jsonString.trim();
      
      // 移除Markdown代码块标记
      if (jsonString.startsWith("```")) {
         jsonString = jsonString.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "");
      }
      
      // 尝试提取第一个完整的JSON对象（支持嵌套）
      let extractedJson = jsonString;
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // 尝试找到匹配的完整JSON对象
        let braceCount = 0;
        let startIdx = -1;
        for (let i = 0; i < jsonString.length; i++) {
          if (jsonString[i] === '{') {
            if (startIdx === -1) startIdx = i;
            braceCount++;
          } else if (jsonString[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startIdx !== -1) {
              extractedJson = jsonString.substring(startIdx, i + 1);
              break;
            }
          }
        }
      }

      let jsonResponse: AgentResponse;
      try {
        jsonResponse = JSON.parse(extractedJson);
        
        // 验证必需字段
        if (!jsonResponse.agent_response || typeof jsonResponse.agent_response !== 'string') {
          throw new Error("Missing or invalid agent_response field");
        }
        
        // 清理agent_response中可能包含的JSON示例和"想象图片"文字
        if (jsonResponse.agent_response) {
          // 移除agent_response中可能出现的完整JSON对象（包括嵌套的）
          jsonResponse.agent_response = jsonResponse.agent_response
            .replace(/\{[^{}]*"stage"[^{}]*\}/g, '') // 简单JSON
            .replace(/\{[\s\S]*?"stage"[\s\S]*?\}/g, '') // 复杂嵌套JSON
            .replace(/\{[^{}]*"agent_response"[^{}]*\}/g, '') // 包含agent_response的JSON
            .trim();
          
          // 无论是否有图片，都移除"想象...图片"、"请想象...图片"等文字
          jsonResponse.agent_response = jsonResponse.agent_response
            .replace(/\(?请?想象[^。，！？]*图片[^。，！？]*\)?/gi, '')
            .replace(/\(?请想象[^。，！？]*图片[^。，！？]*\)?/gi, '')
            .replace(/想象[^。，！？]*图片[^。，！？]*/gi, '')
            .replace(/请想象[^。，！？]*图片[^。，！？]*/gi, '')
            .replace(/想象.*?图片/gi, '')
            .replace(/请想象.*?图片/gi, '')
            .trim();
        }
      } catch (parseError) {
        console.error("JSON Parse Error", parseError, "Original text:", resultText.substring(0, 200));
        // 如果解析失败，尝试从原始文本中提取可能的agent_response内容
        let fallbackResponse = resultText;
        // 尝试提取"agent_response"字段的值
        const agentResponseMatch = resultText.match(/"agent_response"\s*:\s*"([^"]*)"/);
        if (agentResponseMatch && agentResponseMatch[1]) {
          fallbackResponse = agentResponseMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
        
        jsonResponse = {
            stage: currentStage,
            agent_response: fallbackResponse || "系统错误: 无法解析回复。",
            required_action: "USER_INPUT_REQUIRED",
            is_relevant: true,
            image_url: undefined
        };
      }

      // 补强：第三阶段首条消息必须包含完整案例文本（scenario.final_test_context）
      const isFirstAgentMessage = messages.every(m => m.role !== 'model');
      const isFirstFinalStageMessage =
        jsonResponse.stage === '3_Assessment' &&
        (currentStage !== '3_Assessment' || isFirstAgentMessage);

      if (isFirstFinalStageMessage) {
        const fullContext = CURRENT_SCENARIO.final_test_context;
        if (!jsonResponse.agent_response || !jsonResponse.agent_response.includes(fullContext)) {
          const prefix =
            '现在，我们来个实战演练。请你用刚才学到的横向阅读方法，独立核查这条新闻。请直接把你的调查过程和结论发给我。\n\n';
          jsonResponse.agent_response = prefix + fullContext;
        }
      }

      // Logic check
      if (jsonResponse.is_relevant === false && userMessage !== "SYSTEM_INIT: 开始模拟，进入阶段 1。") {
         const newCount = offTopicCount + 1;
         setOffTopicCount(newCount);
         
         if (newCount >= 3) {
             setIsTerminated(true);
             setMessages(prev => [...prev, { 
                 role: 'model', 
                 content: "⛔️ 实验终止：检测到您多次回复无关内容，本次实验已自动结束。", 
                 data: { ...jsonResponse, required_action: 'TERMINATED' } 
             }]);
             setIsLoading(false);
             return;
         }
      } else {
          if (jsonResponse.is_relevant) setOffTopicCount(0);
      }

      // Image Mapping
      let resolvedImageUrl = undefined;
      if (jsonResponse.image_url) {
        const imageKey = String(jsonResponse.image_url).trim();
        console.log("Image mapping - imageKey:", imageKey, "Current stage:", jsonResponse.stage, "IMAGE_LIBRARY:", IMAGE_LIBRARY);
        
        // 检查是否是null字符串或空值
        if (imageKey === 'null' || imageKey === '' || imageKey === 'undefined') {
          console.log("Image URL is null/empty, skipping image mapping");
          resolvedImageUrl = undefined;
        } else {
          // 先检查是否是预设的图片ID
          const libraryUrl = IMAGE_LIBRARY[imageKey];
          if (libraryUrl) {
              resolvedImageUrl = libraryUrl;
              console.log("Image mapped to URL:", resolvedImageUrl, "for key:", imageKey);
              // 验证URL格式
              if (!resolvedImageUrl.startsWith('http://') && !resolvedImageUrl.startsWith('https://')) {
                console.error("Invalid image URL format:", resolvedImageUrl);
                resolvedImageUrl = undefined;
              }
          } else if (imageKey.startsWith('http://') || imageKey.startsWith('https://')) {
              // 直接是HTTP/HTTPS URL
              let directUrl = imageKey;
              // 兼容模型返回 .png 但实际图床只有 .jpg 的情况
              if (directUrl.endsWith('.png')) {
                directUrl = directUrl.replace(/\.png(\?.*)?$/, '.jpg$1');
                console.log("Rewriting image URL from .png to .jpg:", imageKey, "=>", directUrl);
              }
              resolvedImageUrl = directUrl;
              console.log("Image is direct URL:", resolvedImageUrl);
          } else {
              // 未知的图片ID，不设置图片（避免显示错误的图片）
              console.warn("Unknown image key:", imageKey, "Available keys:", Object.keys(IMAGE_LIBRARY), "Not setting image URL");
              resolvedImageUrl = undefined;
          }
        }
      } else {
        console.log("No image_url in jsonResponse");
      }
      
      console.log("Final resolvedImageUrl:", resolvedImageUrl, "for stage:", jsonResponse.stage);
      
      // 特殊检查：第一阶段首条消息必须有图片（案例 1）
      if (isFirstAgentMessage && (jsonResponse.stage === '1_Onboarding' || !jsonResponse.stage) && !resolvedImageUrl) {
        if (IMAGE_LIBRARY['IMG_CASE1']) {
          resolvedImageUrl = IMAGE_LIBRARY['IMG_CASE1'];
          console.warn("Force using IMG_CASE1 for first message:", resolvedImageUrl);
        }
      }

      // 特殊检查：第三阶段的第一个消息必须有图片（最终测试）
      const isEnteringFinal = jsonResponse.stage === '3_Assessment' && currentStage !== '3_Assessment';
      if (isEnteringFinal && !resolvedImageUrl) {
        if (jsonResponse.image_url && jsonResponse.image_url !== 'null' && jsonResponse.image_url.trim() !== '') {
          console.error("CRITICAL: Stage 3_Assessment requires image but mapping failed!", {
            imageKey: jsonResponse.image_url,
            availableKeys: Object.keys(IMAGE_LIBRARY),
            library: IMAGE_LIBRARY
          });
        } else {
          console.warn("Stage 3_Assessment first message missing image_url!");
        }
        if (IMAGE_LIBRARY['IMG_FINAL']) {
          resolvedImageUrl = IMAGE_LIBRARY['IMG_FINAL'];
          console.warn("Force using IMG_FINAL:", resolvedImageUrl);
          setHasShownFinalImage(true);
        }
      } else if (jsonResponse.stage === '3_Assessment' && !hasShownFinalImage) {
        // 容错：进入第三阶段后，如仍未显示图片，则强制补图一次
        if (IMAGE_LIBRARY['IMG_FINAL']) {
          resolvedImageUrl = IMAGE_LIBRARY['IMG_FINAL'];
          console.warn("Force using IMG_FINAL (fallback after entering stage 3):", resolvedImageUrl);
          setHasShownFinalImage(true);
        }
      }

      // 离开第三阶段后重置标记，便于后续新会话/重开时再次展示
      if (jsonResponse.stage && jsonResponse.stage !== '3_Assessment' && hasShownFinalImage) {
        setHasShownFinalImage(false);
      }

      // 记录 Agent 侧的日志
      logEvent({
        role: 'agent',
        stage: jsonResponse.stage || currentStage,
        required_action: jsonResponse.required_action,
        is_relevant: jsonResponse.is_relevant,
        offTopicCount,
        text: jsonResponse.agent_response,
        image_url: resolvedImageUrl ?? null,
        userImageAttached: !!imageBase64,
        webUrlExtracted: firstUrl,
      });

      // 确保content只包含文本内容，不包含JSON
      const displayContent = jsonResponse.agent_response || "系统错误: 无法解析回复。";
      
      // 最后检查：如果content看起来像JSON，尝试提取文本部分
      let finalContent = displayContent;
      if (displayContent.trim().startsWith('{') && displayContent.includes('"agent_response"')) {
        // 如果content本身是JSON格式，尝试提取agent_response字段
        try {
          const parsed = JSON.parse(displayContent);
          if (parsed.agent_response && typeof parsed.agent_response === 'string') {
            finalContent = parsed.agent_response;
          }
        } catch (e) {
          // 如果解析失败，尝试正则提取
          const match = displayContent.match(/"agent_response"\s*:\s*"([^"]*)"/);
          if (match && match[1]) {
            finalContent = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }
        }
      }
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: finalContent,
        data: { ...jsonResponse, image_url: resolvedImageUrl }
      }]);
      
      console.log("Message added with image_url:", resolvedImageUrl, "Content:", finalContent, "Content length:", finalContent?.length, "Full data:", { ...jsonResponse, image_url: resolvedImageUrl });

      if (jsonResponse.stage) setCurrentStage(jsonResponse.stage);
      if (jsonResponse.required_action === 'TERMINATED') {
        setIsTerminated(true);
        if (!captchaCode) {
          generateCaptchaForSession();
        } else if (captchaSyncStatus === 'error' && captchaCode) {
          syncCaptchaToBackend(captchaCode);
        }
        // 对话结束时，自动保存所有日志到后端
        setTimeout(() => {
          sendLogToBackend(logEntriesRef.current, true);
        }, 500); // 延迟一点确保最后的 logEvent 已完成
      }

    } catch (error: any) {
      console.error("Agent Error:", error);
      setIsReadingWeb(false); 
      let errorMsg = "API Error";
      if (typeof error?.message === 'string') errorMsg = error.message;
      if (errorMsg.includes("429")) errorMsg = "⚠️ 免费服务繁忙 (429)。请稍等几秒后再点发送。";

      setMessages(prev => [...prev, { role: 'model', content: `⚠️ 发生错误: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading || isTerminated) return;
    
    if (!apiKey) {
        alert("错误: 未配置 API Key。请检查代码中的 USER_CONFIG 或 URL 参数 (?key=...)。");
        return;
    }

    let base64Image = undefined;
    if (selectedImage) {
        try {
            base64Image = await fileToGenerativePart(selectedImage);
        } catch (e) {
            alert("图片处理失败");
            return;
        }
    }

    const userText = input;
    
    setMessages(prev => [...prev, { 
        role: 'user', 
        content: userText || (selectedImage ? "[发送了一张图片]" : ""),
        image: base64Image
    }]);

    // 记录用户侧的日志
    logEvent({
      role: 'user',
      stage: currentStage,
      required_action: 'USER_INPUT_REQUIRED',
      is_relevant: true,
      offTopicCount,
      text: userText || (selectedImage ? "[发送了一张图片]" : ""),
      image_url: null,
      userImageAttached: !!base64Image,
      webUrlExtracted: null,
    });

    setInput('');
    setSelectedImage(null);
    
    handleAgentTurn(userText || "Check this image", base64Image, apiKey);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setSelectedImage(e.target.files[0]);
      }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setSelectedImage(file);
          e.preventDefault(); 
        }
      }
    }
  };

  const getProgress = () => {
    if (isTerminated) return '100%';
    if (currentStage.startsWith('1_')) return '33%';
    if (currentStage.startsWith('2_')) return '66%';
    if (currentStage.startsWith('3_')) return '95%';
    return '0%';
  };

  // 导出当前会话日志为 JSON 文件，便于后续分析
  const handleExportLog = () => {
    if (!logEntries.length) {
      alert('当前还没有可以导出的数据。');
      return;
    }
    const payload = {
      sessionId,
      scenario: CURRENT_SCENARIO,
      startedAt: sessionId,
      logEntries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lateral-reading-log-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={{margin: 0, fontSize: '18px'}}>横向阅读教学 Agent</h2>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
        <div style={{fontSize: '12px', opacity: 0.8}}>
           当前阶段: {currentStage.split('_')[1] || 'Loading...'}
        </div>
          <button
            onClick={handleExportLog}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              borderRadius: '999px',
              border: '1px solid #d1d5db',
              backgroundColor: '#f9fafb',
              cursor: logEntries.length ? 'pointer' : 'not-allowed',
              opacity: logEntries.length ? 1 : 0.5,
            }}
          >
            导出数据
          </button>
      </div>
      </div>
      {/* Progress Bar */}
      <div style={styles.progressContainer}>
          <div style={{...styles.progressBar, width: getProgress()}}></div>
      </div>

      {/* Messages Area */}
      <div style={styles.chatArea}>
        {messages.map((msg, index) => (
          <div key={index} style={{
            ...styles.messageRow, 
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            {/* Avatar for Model */}
            {msg.role === 'model' && (
                <div style={styles.avatar}>🕵️</div>
            )}

            <div style={{
              ...styles.bubble,
              backgroundColor: msg.role === 'user' ? '#2563eb' : '#ffffff',
              color: msg.role === 'user' ? '#fff' : '#1f2937',
              border: msg.role === 'user' ? 'none' : '1px solid #e5e7eb',
              maxWidth: msg.image ? '300px' : '80%'
            }}>
               {/* Display Uploaded Image in Chat */}
               {msg.image && (
                   <img 
                     src={`data:image/jpeg;base64,${msg.image}`} 
                     alt="User upload" 
                     style={{width: '100%', borderRadius: '8px', marginBottom: '8px'}} 
                   />
               )}

               {/* Agent Sent Image */}
               {msg.data?.image_url && msg.data.image_url !== 'null' && msg.data.image_url !== null && (
                   <div style={styles.imageContainer}>
                       <img 
                         src={msg.data.image_url} 
                         alt="Evidence" 
                         onError={(e) => {
                             const img = e.target as HTMLImageElement;
                             const container = img.parentElement;
                             const imageUrl = msg.data?.image_url;
                             console.error("Image load error:", {
                               url: imageUrl,
                               stage: msg.data?.stage,
                               error: e,
                               imageElement: img
                             });
                             
                             // 尝试检查是否是URL问题
                             if (imageUrl && !imageUrl.startsWith('data:')) {
                                 // 尝试使用代理或备用方案
                                 console.warn("Attempting to diagnose image load failure for:", imageUrl);
                             }
                             
                             if (container) {
                                 img.style.display = 'none';
                                 // 检查是否已经有错误提示
                                 if (!container.querySelector('.image-error-placeholder')) {
                                     const placeholder = document.createElement('div');
                                     placeholder.className = 'image-error-placeholder';
                                     placeholder.style.cssText = 'padding: 20px; text-align: center; color: #999; background: #f5f5f5; border-radius: 4px; margin: 10px 0;';
                                     placeholder.innerHTML = `
                                       <div>图片加载失败</div>
                                       <div style="font-size: 12px; margin-top: 8px; color: #666;">
                                         URL: ${imageUrl || '未知'}<br/>
                                         可能原因：网络问题、图片不存在或CORS限制<br/>
                                         <a href="${imageUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">点击在新窗口打开</a>
                                       </div>
                                     `;
                                     container.appendChild(placeholder);
                                 }
                             }
                             console.warn("Failed to load image:", imageUrl, "Stage:", msg.data?.stage);
                         }}
                         onLoad={(e) => {
                             // 图片加载成功，确保显示并移除错误提示
                             const img = e.target as HTMLImageElement;
                             img.style.display = 'block';
                             const container = img.parentElement;
                             if (container) {
                                 const errorPlaceholder = container.querySelector('.image-error-placeholder');
                                 if (errorPlaceholder) {
                                     errorPlaceholder.remove();
                                 }
                             }
                             console.log("Image loaded successfully:", msg.data?.image_url, "Stage:", msg.data?.stage);
                         }}
                         style={{width: '100%', borderRadius: '4px', display: 'block'}} 
                       />
                       <div style={styles.imageOverlay}>🔍 请查证此图</div>
                   </div>
               )}

               {/* 文字内容 - 始终显示，即使有图片 */}
               <div style={styles.markdownContainer}>
                  {msg.role === 'user' ? (
                      <div style={{whiteSpace: 'pre-wrap'}}>{msg.content || ''}</div>
                  ) : (
                      msg.content && msg.content.trim() ? (
                      <ReactMarkdown 
                        components={{
                            p: ({node, ...props}) => <p style={{margin: '0 0 8px 0', lineHeight: '1.6'}} {...props} />,
                            blockquote: ({node, ...props}) => (
                                <blockquote style={{
                                    borderLeft: '4px solid #cbd5e1', 
                                    margin: '8px 0', 
                                    paddingLeft: '12px', 
                                    color: '#4b5563',
                                    backgroundColor: '#f8fafc',
                                    padding: '8px 12px',
                                    borderRadius: '4px'
                                }} {...props} />
                            ),
                            a: ({node, ...props}) => <a style={{color: '#2563eb', textDecoration: 'underline'}} {...props} />,
                            ul: ({node, ...props}) => <ul style={{paddingLeft: '20px', margin: '8px 0'}} {...props} />,
                            ol: ({node, ...props}) => <ol style={{paddingLeft: '20px', margin: '8px 0'}} {...props} />,
                        }}
                      >
                        {String(msg.content)}
                      </ReactMarkdown>
                      ) : msg.role === 'model' && msg.data?.image_url ? (
                          // 如果有图片但没有文字内容，显示调试信息
                          <div style={{color: '#999', fontStyle: 'italic', fontSize: '13px'}}>
                            [调试：检测到图片但文字内容为空。请检查 AI 返回的 agent_response 字段。]
                          </div>
                      ) : null
                  )}
               </div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div style={{...styles.messageRow, justifyContent: 'flex-start'}}>
                <div style={styles.avatar}>🕵️</div>
                <div style={{...styles.bubble, backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#666'}}>
                    {isReadingWeb ? (
                        <span>🌐 正在分析网页链接...</span>
                    ) : (
                        <span>Thinking...</span>
                    )}
                </div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Captcha Display */}
      {isTerminated && captchaCode && (
        <div style={styles.captchaBox}>
          <div style={{fontSize: '14px', color: '#1f2937'}}>本次会话验证码：</div>
          <div style={styles.captchaCode}>{captchaCode}</div>
          <div style={styles.captchaStatusText}>
            {captchaSyncStatus === 'syncing' && '正在同步到数据库...'}
            {captchaSyncStatus === 'success' && '验证码已同步到数据库，可用于核验本次学习结果。'}
            {captchaSyncStatus === 'idle' && '验证码已生成，等待同步。'}
            {captchaSyncStatus === 'error' && (
              <>
                同步失败：{captchaError || '未知错误'}
              </>
            )}
          </div>
          {captchaSyncStatus === 'error' && (
            <button
              onClick={() => captchaCode && syncCaptchaToBackend(captchaCode)}
              style={styles.captchaRetryBtn}
              disabled={captchaSyncStatus === 'syncing'}
            >
              重新同步
            </button>
          )}
        </div>
      )}

      {/* Input Area */}
      <div style={{
        ...styles.inputArea,
        padding: isMobile ? '10px 12px' : '15px 20px'
      }}>
        {selectedImage && (
            <div style={styles.imagePreview}>
                <span>已选择图片: {selectedImage.name}</span>
                <button onClick={() => setSelectedImage(null)} style={styles.clearBtn}>×</button>
            </div>
        )}
        <div style={{
          display: 'flex', 
          gap: isMobile ? '6px' : '10px',
          alignItems: 'center',
          width: '100%'
        }}>
            <button 
                onClick={() => fileInputRef.current?.click()} 
                style={{
                  ...styles.attachBtn,
                  padding: isMobile ? '8px 12px' : '10px 15px',
                  fontSize: isMobile ? '16px' : '18px',
                  flexShrink: 0
                }}
                title="上传图片"
            >
                📎
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              style={{display: 'none'}} 
              accept="image/*"
            />
            <input
              style={{
                ...styles.input,
                padding: isMobile ? '10px' : '12px',
                fontSize: isMobile ? '16px' : '15px',
                minWidth: 0, // 确保可以缩小
                flex: 1
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              onPaste={handlePaste}
              placeholder={isMobile ? "输入消息..." : "输入消息或粘贴图片 (Ctrl+V)..."}
              disabled={isLoading || isTerminated}
            />
            <button 
              onClick={handleSend}
              style={{
                  ...styles.sendBtn,
                  padding: isMobile ? '8px 14px' : '10px 20px',
                  fontSize: isMobile ? '14px' : '15px',
                  opacity: (input.trim() || selectedImage) && !isLoading && !isTerminated ? 1 : 0.5,
                  cursor: (input.trim() || selectedImage) && !isLoading && !isTerminated ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
              }}
              disabled={(!input.trim() && !selectedImage) || isLoading || isTerminated}
            >
              发送
            </button>
        </div>
      </div>
    </div>
  );
};

// --- Styles ---

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'sans-serif',
    backgroundColor: '#f9fafb',
    position: 'relative',
  },
  header: {
    padding: '15px 20px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    zIndex: 10,
  },
  progressContainer: {
    height: '4px',
    backgroundColor: '#e5e7eb',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2563eb',
    transition: 'width 0.3s ease',
  },
  chatArea: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  messageRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    width: '100%',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#e0e7ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  bubble: {
    padding: '12px 16px',
    borderRadius: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    wordBreak: 'break-word',
    position: 'relative',
  },
  imageContainer: {
    marginTop: '10px',
    marginBottom: '10px',
    position: 'relative',
    cursor: 'pointer',
    border: '2px dashed #cbd5e1',
    padding: '4px',
    borderRadius: '8px',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
  },
  markdownContainer: {
      lineHeight: '1.5',
      fontSize: '15px',
      marginTop: '8px',
      minHeight: '1em',
  },
  inputArea: {
    padding: '15px 20px',
    backgroundColor: '#fff',
    borderTop: '1px solid #e5e7eb',
    width: '100%',
    boxSizing: 'border-box',
  },
  input: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '15px',
    outline: 'none',
    minWidth: 0, // 确保可以缩小
    width: '100%',
    boxSizing: 'border-box',
  },
  sendBtn: {
    padding: '10px 20px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    transition: 'opacity 0.2s',
  },
  attachBtn: {
      padding: '10px 15px',
      backgroundColor: '#f3f4f6',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
  },
  captchaBox: {
      margin: '10px 20px',
      padding: '15px',
      borderRadius: '12px',
      border: '1px solid #c7d2fe',
      backgroundColor: '#eef2ff',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
  },
  captchaCode: {
      fontWeight: 700,
      fontSize: '32px',
      letterSpacing: '8px',
      color: '#1d4ed8',
  },
  captchaStatusText: {
      fontSize: '13px',
      color: '#1f2937',
      minHeight: '18px',
  },
  captchaRetryBtn: {
      alignSelf: 'flex-start',
      padding: '6px 14px',
      borderRadius: '6px',
      border: '1px solid #2563eb',
      backgroundColor: '#2563eb',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '13px',
  },
  modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255,255,255,0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
  },
  imagePreview: {
      marginBottom: '10px',
      padding: '8px 12px',
      backgroundColor: '#eff6ff',
      borderRadius: '6px',
      fontSize: '13px',
      color: '#1e40af',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  clearBtn: {
      background: 'none',
      border: 'none',
      color: '#666',
      cursor: 'pointer',
      fontSize: '16px',
      padding: '0 5px',
  }
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
