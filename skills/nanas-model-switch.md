---
name: nanas-model-switch
description: 当用户说"换模型""AI变笨了""换成XXX模型""更新大模型"时，安全地切换 nanas.com.cn 的 AI 模型
---

# Skill：AI 模型切换

## 触发词
换模型 / AI变笨了 / 换成XXX / 更新大模型 / 模型太慢

## 当前模型
- 文件：`functions/api/chat.js`
- 当前：`ep-20260613123151-fm49q`（火山引擎 ARK，Doubao）
- API：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- Key：Cloudflare Pages env `ARK_API_KEY`（不在代码里）

## 可选模型清单

### 火山引擎 ARK（推荐，国内合规）
| 模型 | 特点 |
|------|------|
| ep-20260613123151-fm49q | 当前在用，Doubao系列 |
| doubao-pro-32k | 更强，支持长文本 |
| doubao-vision-pro | 支持图片理解 |

### NVIDIA NIM（备用，国际）
| 模型 | 特点 |
|------|------|
| nvidia/llama-3.1-nemotron-70b-instruct | 强，中文好 |
| meta/llama-3.3-70b-instruct | 均衡 |

## 切换步骤
1. 修改 `functions/api/chat.js` 中 `const MODEL` 或 API endpoint
2. 如换 Key，先用 wrangler secret 写入：
   ```bash
   echo "新KEY" | npx wrangler pages secret put ARK_API_KEY --project-name nanas-3d
   ```
3. 部署（触发 nanas-deploy skill）
4. 验证接口返回正常

## 注意
- 切换到 NVIDIA NIM 时，endpoint 改为 `https://integrate.api.nvidia.com/v1/chat/completions`
- 大陆用户访问 NVIDIA NIM 延迟高，正式运营优先用 ARK
