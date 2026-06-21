const MODEL = 'ep-20260613123151-fm49q'
const NANASCLAW_API = 'https://api.nanasclaw.com'

// 默认 Prompt（Langfuse 不可用时的兜底）— Fable 5 风格
const SYSTEM_DEFAULT = `你是菠萝助手，菠萝荟（nanasity.com）的邻里 AI 助手。

【身份】
菠萝荟是连接小区居民与便利店老板的 AI 桥梁。你服务的用户主要是小区居民和便利店老板，语气要像邻居朋友，不像客服机器人。

【核心行为准则】
- 直接给答案。不说"当然可以""好的""没问题"等无意义开场白。
- 回答控制在 80 字以内，除非用户明确要详细说明。
- 有【菠萝爪比价数据】就直接用，不说"我不知道价格"。
- 不确定的事直说"我不确定"，不编造数据。
- 不重复用户说过的话，直接接着说有用的内容。

【擅长场景】
- 附近商品比价（可乐、米、水等日用品）
- 便利店活动、优惠券
- 小区生活问题（快递、买菜、团购）

【长辈友好】
若用户提到年纪大或不熟悉手机操作，主动放慢节奏，每次只说一件事，用词简单直白。`

// ── Langfuse Prompt 版本管理 ────────────────────
// 从 Langfuse 拉最新 prompt（失败则用 SYSTEM_DEFAULT 兜底）
async function fetchPromptFromLangfuse(env) {
  const LANGFUSE_URL = env.LANGFUSE_URL
  const LANGFUSE_PUBLIC_KEY = env.LANGFUSE_PUBLIC_KEY
  const LANGFUSE_SECRET_KEY = env.LANGFUSE_SECRET_KEY
  if (!LANGFUSE_URL || !LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) return null
  try {
    const res = await fetch(
      `${LANGFUSE_URL}/api/public/prompts?name=nanas-system`,
      {
        headers: {
          'Authorization': `Basic ${btoa(LANGFUSE_PUBLIC_KEY + ':' + LANGFUSE_SECRET_KEY)}`,
          'Accept': 'application/json',
        },
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.prompt || null
  } catch {
    return null
  }
}

// ── Langfuse 对话追踪（异步，不阻塞响应）───────────
async function traceToLangfuse(env, traceData) {
  const LANGFUSE_URL = env.LANGFUSE_URL
  const LANGFUSE_SECRET_KEY = env.LANGFUSE_SECRET_KEY
  const LANGFUSE_PUBLIC_KEY = env.LANGFUSE_PUBLIC_KEY
  if (!LANGFUSE_URL || !LANGFUSE_SECRET_KEY) return
  try {
    await fetch(`${LANGFUSE_URL}/api/public/traces`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(LANGFUSE_PUBLIC_KEY + ':' + LANGFUSE_SECRET_KEY)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(traceData),
    })
  } catch {
    // 追踪失败不影响主链路
  }
}

// ── 比价意图检测 ──────────────────────────────
function extractCompareKeyword(messages) {
  const last = messages[messages.length - 1]
  const text = typeof last?.content === 'string' ? last.content : ''
  const trigger = /比价|多少钱|哪家便宜|最便宜|哪里买|在哪买|便宜.*吗|价格.*多少|买.*哪|附近.*卖|卖.*多少/
  if (!trigger.test(text)) return null
  const keyword = text
    .replace(/帮我|请|查一下|找一下|看看|比价|附近|便利店|超市|多少钱|哪家便宜|最便宜|价格|哪里买|在哪买|的价格|一下|吗|呢|\?|？/g, '')
    .trim()
  return keyword || null
}

// ── 调用 NanasClaw 比价 API ────────────────────
async function fetchCompareData(keyword) {
  try {
    const res = await fetch(
      `${NANASCLAW_API}/api/compare?keyword=${encodeURIComponent(keyword)}`,
      { headers: { Accept: 'application/json' }, cf: { cacheTtl: 300 } }
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── 格式化比价结果为上下文 ─────────────────────
function formatCompareContext(data, keyword) {
  if (!data?.shops?.length) {
    // 无数据时不注入任何 context，让 AI 自然引导用户输入具体商品
    return null
  }
  const shopLines = data.shops.slice(0, 5).map(s => {
    const shopName = s.shop_name || s.name || '附近门店'
    const dist = s.distance_m ? `约${s.distance_m}米` : (s.distance || '附近')
    const tag = s.tag ? ` · ${s.tag}` : ''
    const vs = s.vs_market ? ` · ${s.vs_market}` : ''
    return `• ${shopName}：¥${s.price}/${s.unit || '件'}（${dist}）${tag}${vs}`
  }).join('\n')
  const suggest = data.ai_suggest ? `\nAI 推荐：${data.ai_suggest}` : ''
  return `【菠萝爪比价数据 · ${keyword}】\n${shopLines}${suggest}`
}

// ── 主处理函数 ────────────────────────────────
export async function onRequestPost(context) {
  const ARK_KEY = context.env.ARK_API_KEY
  if (!ARK_KEY) {
    return new Response('ARK_API_KEY not configured', { status: 500 })
  }

  let body
  try {
    body = await context.request.json()
  } catch {
    return new Response('bad json', { status: 400 })
  }

  const messages = body.messages || []

  // 从 Langfuse 拉最新 Prompt，失败兜底默认值
  const livePrompt = await fetchPromptFromLangfuse(context.env)
  let systemContent = livePrompt || SYSTEM_DEFAULT
  const compareKeyword = extractCompareKeyword(messages)
  if (compareKeyword) {
    const compareData = await fetchCompareData(compareKeyword)
    const compareContext = formatCompareContext(compareData, compareKeyword)
    if (compareContext) {
      systemContent = systemContent + '\n\n' + compareContext
    }
  }

  const payload = JSON.stringify({
    model: MODEL,
    messages: [{ role: 'system', content: systemContent }, ...messages],
    stream: true,
    max_tokens: 2048,
  })

  const upstream = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ARK_KEY}`,
      'Content-Type': 'application/json',
    },
    body: payload,
  })

  // 异步追踪到 Langfuse（不阻塞流式响应）
  const traceId = crypto.randomUUID()
  context.waitUntil(traceToLangfuse(context.env, {
    id: traceId,
    name: 'nanas-chat',
    input: messages[messages.length - 1]?.content || '',
    metadata: { hasCompareKeyword: !!compareKeyword, model: MODEL },
  }))

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}
