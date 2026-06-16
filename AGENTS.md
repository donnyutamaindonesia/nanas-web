# 菠萝荟 · nanas.com.cn 项目说明

## 设计规范（改UI前必读）
读 `.impeccable.md`。设计原则摘要：
- 参考：**微信本体** — 极简留白，字重层次，不靠卡片/阴影
- 情绪：**聪明轻快** — 一秒找答案
- 橙色只给最重要的1个动作，其余全中性
- Web端字体：Noto Sans SC + ZCOOL KuaiLe（品牌词）
- 禁止：AI模板卡片、gradient text、border-left彩色条、glassmorphism

## 背景
菠萝荟（Nanasity）是邻里 AI 消费生态圈，服务社区居民和便利店店主。
本项目是官网 + AI 对话入口，部署在 Cloudflare Pages（项目名：nanas-3d）。

## 目标
1. AI 对话：用火山引擎 ARK 回答邻里生活问题
2. 产品入口：C 家族四个产品（比价/社群/聊天/充值）
3. 便利店赋能：B 端店主入驻宣传

## 技术栈
- 前端：纯 HTML/CSS/JS（index.html）
- 后端：Cloudflare Pages Functions（functions/api/chat.js）
- AI：火山引擎 ARK，endpoint `ep-20260613123151-fm49q`
- 部署：`npx wrangler pages deploy . --project-name nanas-3d`

## 密钥管理
- 所有 API Key 通过 Cloudflare Pages 环境变量注入（不写进代码）
- 本地测试用 .env.local（已加入 .gitignore，禁止提交）
- 当前 secrets：ARK_API_KEY

## 文件结构
```
nanas-web/
├── index.html          # 主页面（AI 对话 + 导航）
├── brand-manual.html   # 品牌手册
├── nav-manual.html     # 导航分类手册
├── functions/
│   └── api/chat.js     # ARK AI 代理（Cloudflare Pages Function）
├── skills/             # 可复用工作流
├── AGENTS.md           # 本文件
└── .gitignore
```

## 品牌规范
- 母品牌：菠萝荟（英文 Nanasity）
- AI 助手名：Nanas（长辈模式叫菠萝助手）
- 主色：#c96442（暖橙）背景：#f5f4f0（暖米）
- 禁止：暗色主题、渐变文字、边框左条纹装饰

## C 家族产品
| 产品 | 中文 | 状态 | 对应 chip |
|------|------|------|-----------|
| NanasClaw | 菠萝爪 | ✅上线 | 荟比价 |
| NanasClub | 菠萝荟 | ✅上线 | 荟社群 |
| NanasChat | 菠萝聊 | 🔄即将 | 荟聊天 |
| NanasCard | 菠萝卡 | 🔄即将 | 荟充值 |

## 工作习惯
- 改前先说明影响范围
- 涉及 chat.js 修改后必须重新部署（wrangler pages deploy）
- 不要修改 .gitignore 和 .env.local
- 保持暖色极简白底风格，不引入新 CSS 框架
