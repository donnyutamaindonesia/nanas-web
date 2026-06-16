---
name: nanas-ui-update
description: 当用户说"改侧边栏""更新导航""改chips""改首页文字""修改UI"时，按菠萝荟设计规范修改 index.html
---

# Skill：nanas.com.cn UI 更新

## 触发词
改侧边栏 / 更新导航 / 改chips / 改首页 / 修改UI / 改配色

## 设计约束（修改前必读）
- 主色：`#c96442`（暖橙）
- 背景：`#f5f4f0`（暖米）
- 侧边栏白底：`#fff`
- 禁止：暗色主题 / 渐变文字（background-clip:text）/ 边框左条纹（border-left > 1px）
- 字体：-apple-system, BlinkMacSystemFont, "PingFang SC"

## 侧边栏结构（当前定版）
1. NANAS 文字 logo
2. 新对话（橙色按钮）
3. 对话分组 → 我的对话
4. C 家族分组 → 菠萝爪·比价(NEW) / 菠萝荟·社群 / 菠萝聊·助手(dim) / 菠萝卡·充值(dim)
5. 关于分组 → 便利店赋能 / 关于菠萝荟

## Chips（当前定版）
荟聊天 / 荟比价 / 荟社群 / 荟充值

## 修改后
改完必须本地打开验证：
```bash
open /Users/khao/nanas-web/index.html
```
确认视觉正常后再部署（触发 nanas-deploy skill）
