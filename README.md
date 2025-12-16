# 决策转盘（Decision Wheel）

一个零依赖的 Web/PWA 决策转盘 Demo：Spatial Glass + 液态动效，指数减速、临停悬念、震动/音效反馈，支持自定义概率（扇形面积随权重变化）与“转盘库”保存/载入。

## 快速开始（Windows / Android）

前置：安装 Node.js（任意近期版本即可）。

1) 启动本地服务
- `cd spin-wheel`
- `node server.js`

2) 打开页面
- Windows：用浏览器打开 `http://localhost:5173`
- Android（同一 Wi-Fi）：打开 `http://<电脑IP>:5173`
- Android（推荐调试）：`adb reverse tcp:5173 tcp:5173` 后打开 `http://localhost:5173`

> 若页面样式/逻辑没更新，可能被 Service Worker 缓存：浏览器“强制刷新”，或清理站点数据后再试。

## 功能一览

- 转盘物理：指数衰减减速（非匀速停止），指针命中与结果映射统一，避免不一致。
- 悬念模式：临停阶段自动增强视觉/音量压低，并提供更明显的指针 tick 动效与扇区高亮。
- 震动反馈：按扇区边界触发 tick（`navigator.vibrate()`），随转速变慢由密到疏，停止时重击。
- 音频：合成氛围音 + tick/锁定音；需要用户手势解锁；右上角按钮开关。
- 快速输入：支持粘贴文本自动分割（换行/逗号/中文逗号）；内置预设一键填充选项。
- 自定义概率：每个选项有权重滑条；权重同时影响“抽中概率”和“扇形面积”；`0` 权重会变成 0 面积且不会被抽中。
- 转盘库：支持自定义命名保存/载入/删除（含权重），存储在本机浏览器 `localStorage`。
- 选项面板：可收起；支持“面板高度”滑条自定义（持久化到本机）。
- PWA/离线：注册 Service Worker，支持离线打开（缓存静态资源）。

## 使用说明

- 编辑选项：在“选项”列表里直接改文本；右侧 `×` 删除。
- 概率/面积：拖动每个选项下方的权重滑条；右侧显示该项占比（会随其他项变化）。
- 保存转盘：点“转盘”→ 输入名称 → “保存”；同名会覆盖更新。
- 载入/删除：在“转盘库”选择已保存转盘 → “载入/删除”。
- 调面板高度：拖动“面板高度”滑条；“重置”恢复默认。

## 目录结构

- `spin-wheel/index.html`：页面结构（顶部栏/转盘舞台/底部面板/对话框）
- `spin-wheel/styles.css`：玻璃液态风格与交互动效、滚动条/滑条样式
- `spin-wheel/app.js`：转盘绘制（Canvas）、物理/悬念/震动/音频、权重分段、转盘库与面板设置
- `spin-wheel/server.js`：零依赖静态文件服务器（默认端口 `5173`）
- `spin-wheel/sw.js`：Service Worker 缓存策略

## 兼容性与注意事项

- `navigator.vibrate()` 主要在 Android/Chrome 有效；桌面端通常会降级为无震动。
- 音频与剪贴板读取通常需要“用户手势”与“安全上下文”（`https`/`localhost`）。真机调试推荐用 `adb reverse` 走 `localhost`。
- 权重很小的扇区会非常窄；为保证可读性，极窄扇区可能不显示文字（但仍可被指针命中/抽中）。

## 视觉方向（可选 Prompt）

`Mobile app UI design, decision making wheel, Spatial UI style, glassmorphism, frosted glass transparency, soft blurred background gradients, sleek and futuristic, floating 3D disc wheel with subtle glowing edges, elegant sans-serif typography, pastel color scheme (soft purple, mint, peach), interactive lighting effects, liquid motion interface, clean layout, plenty of negative space, floating action button at the bottom, 8k, photorealistic rendering, Figma style, sophisticated aesthetic --ar 9:16 --stylize 250`
