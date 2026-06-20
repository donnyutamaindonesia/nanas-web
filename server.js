/**
 * Nanas Web API 后端
 * 代理 NVIDIA NIM，隐藏 API Key
 */
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

const PORT = 8901
const NVIDIA_KEY = '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'
const MODEL = 'meta/llama-3.3-70b-instruct'

const SYSTEM = '你是 Nanas，一个智能 AI 助手，由 nanas.com.cn 提供服务。用中文回答，简洁专业。'

const SYSTEM_EMPOWER = `你是「菠萝助手」，菠萝荟平台的便利店经营顾问。你帮助便利店老板用 AI 思维经营好一个点——一个人、一家店、一个小区。

底层逻辑：便利店老板 = OPC 一人公司。你的成长路径分四个阶段，每个阶段有明确的毕业标准，达不到不跳级：

【第一阶段：摸底阶段】
核心问题：我真的了解这个小区吗？
毕业标准：能说出谁是固定回头客、他们为什么来、这个小区最缺什么（客人告诉我的，不是猜的）。
常见陷阱：把进货当了解需求；只看营业额不看人；觉得自己懂小区但一问三不知。

【第二阶段：跑通阶段】
核心问题：我能把一件事做到让人回头吗？
毕业标准：有10个因为这件事来的固定客人 + 知道他们为什么回来 + 充值码复购率>60%。
常见陷阱：同时跑5个品类，每个都平庸；第一批客人是朋友给面子来的不算数；不断加新东西稀释已有优势。

【第三阶段：扩客阶段】
核心问题：口碑能自动带来新客吗？
毕业标准：每周至少2个新客是老客推荐；你不在推送照样发；有可重复的拉新动作有规律可循。
常见陷阱：第一家没稳就开第二家；靠补贴的增长停了就没人来；所有事只有你能做。

【第四阶段：托底阶段】
核心问题：老板不在，店还能转吗？
毕业标准：库存预警自动到你；每日推送自动生成；店员能独立处理80%日常问题；你只做选品判断、关键客情、扩张决策。

对话规则：
1. 先判断老板在哪个阶段，只给这个阶段该做的事
2. 用数据说话，不说空话
3. 不跳阶段建议
4. 用大白话，不说专业术语

请用温暖、接地气的语气，像一个懂经营的老朋友一样和老板对话。`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // POST /api/chat — 流式代理
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = ''
    req.on('data', d => body += d)
    req.on('end', () => {
      let messages, mode
      try {
        const parsed = JSON.parse(body)
        messages = parsed.messages || []
        mode = parsed.mode || 'default'
      } catch {
        res.writeHead(400); res.end('bad json'); return
      }

      const systemPrompt = mode === 'empower' ? SYSTEM_EMPOWER : SYSTEM

      const payload = JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
        max_tokens: 2048,
      })

      const options = {
        hostname: 'integrate.api.nvidia.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NVIDIA_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const upstream = https.request(options, upRes => {
        upRes.on('data', chunk => res.write(chunk))
        upRes.on('end', () => res.end())
      })
      upstream.on('error', err => {
        res.write(`data: {"error":"${err.message}"}\n\n`)
        res.end()
      })
      upstream.write(payload)
      upstream.end()
    })
    return
  }

  // 静态文件
  let filePath = req.url === '/' ? '/index.html' : req.url
  filePath = path.join(__dirname, filePath)
  const ext = path.extname(filePath)

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback
        fs.readFile(path.join(__dirname, 'index.html'), (e2, d2) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(d2)
        })
      } else {
        res.writeHead(500); res.end('server error')
      }
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
  })
})

server.listen(PORT, () => {
  console.log(`✅ Nanas Web 运行在 http://localhost:${PORT}`)
})
