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
      let messages
      try {
        messages = JSON.parse(body).messages || []
      } catch {
        res.writeHead(400); res.end('bad json'); return
      }

      const payload = JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
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
