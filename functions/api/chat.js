const MODEL = 'ep-20260613123151-fm49q'
const NANASCLAW_API = 'https://api.nanasclaw.com'

// 默认 Prompt（Langfuse 不可用时的兜底）
const SYSTEM_DEFAULT = `你是 Nanas，由菠萝荟（邻里 AI 消费生态圈）提供的智能助手，服务于 nanas.com.cn。

你的定位：邻里 AI 助手，帮用户解决日常生活、购物比价、社区活动等问题。

回答规则：
- 必须用中文，语气自然口语化，像朋友聊天
- 直接给答案，不要废话铺垫，不要说"当然可以""好的，我来帮你"这类无意义开场
- 简单问题一两句话搞定；复杂问题用列表或分段，清晰简洁
- 如果上下文里有【菠萝爪比价数据】，直接用这个数据回答价格问题，不要说"我不知道"
- 不确定的事情直说不确定，不要瞎编`

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
