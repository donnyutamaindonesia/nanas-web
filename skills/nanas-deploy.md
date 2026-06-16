---
name: nanas-deploy
description: 当用户说"部署""发布""deploy""上线nanas"时，执行 nanas.com.cn 完整部署流程并验证
---

# Skill：nanas.com.cn 部署

## 触发词
部署 / 发布 / deploy / 上线 nanas / 推到线上

## 执行步骤

### 1. 部署前检查
- 确认 functions/api/chat.js 中没有硬编码 API Key
- 确认 .env.local 不在 git 追踪列表中
- 确认 index.html 最后修改正常

### 2. 执行部署
```bash
cd /Users/khao/nanas-web
npx wrangler pages deploy . --project-name nanas-3d
```

### 3. 验证
部署成功后验证 AI 接口可用：
```bash
curl -s -X POST https://nanas.com.cn/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}]}' \
  | head -c 200
```

## 成功标准
- wrangler 输出 `Deployment complete`
- curl 返回流式文本（非报错）

## 失败处理
- ARK_API_KEY 未配置 → 去 Cloudflare Pages → Settings → Environment variables 补充
- 构建报错 → 检查 functions/api/chat.js 语法
