# 转盘 / Decision Wheel

一个带“悬念”的决策转盘：Spatial UI + Glassmorphism，3D 漂浮圆盘，柔和渐变背景与液态动效。

## 视觉方向 (Prompt)

**Midjourney / SDXL Prompt (9:16)**

`Mobile app UI design, decision making wheel, Spatial UI style, glassmorphism, frosted glass transparency, soft blurred background gradients, sleek and futuristic, floating 3D disc wheel with subtle glowing edges, elegant sans-serif typography, pastel color scheme (soft purple, mint, peach), interactive lighting effects, liquid motion interface, clean layout, plenty of negative space, floating action button at the bottom, 8k, photorealistic rendering, Figma style, sophisticated aesthetic --ar 9:16 --stylize 250`

## UI 组件 (建议)

- 顶部：标题 + 轻量设置入口（玻璃胶囊按钮）
- 中部：3D 转盘（漂浮圆盘）+ 指针（微发光）
- 底部：选项列表（玻璃卡片，可编辑/拖拽排序）+ FAB（开始/重转）
- 背景：柔和渐变 + 大半径模糊（低对比，保留负空间）

### 设计 Token（建议）

- Colors：紫 `#A78BFA` / 薄荷 `#5EEAD4` / 桃 `#FDBA74`（低饱和）
- Glass：`opacity 18–28%`，`blur 24–40`，`stroke 1px`，高光边缘
- Shadows：低扩散软阴影 + 轻微环境光遮蔽（AO）
- Type：Inter / SF Pro（SemiBold 标题，Regular 正文）

## 交互物理引擎 (The Physics)

### 1) 减速曲线：指数级衰减（非匀速停止）

用角速度 `ω` 做指数衰减，帧率无关：

- 连续形式：`ω(t) = ω0 * e^(-k t)`
- 离散更新：`ω = ω * exp(-k * dt)`（`dt` 为秒）

停止条件：`ω < ω_stop` 后进入对齐/锁定（snap），保证最终落在某一扇区中心。

**参数求解（希望在 `T` 秒内停下）**

`k = ln(ω0 / ω_stop) / T`

### 2) 选中扇区（角度 → index）

- `N = 选项数`
- `segment = 2π / N`
- `θ = wheelAngle mod 2π`（以指针方向为 0 或加 offset）
- `index = floor(θ / segment)`（按 UI 方向调整正负与 offset）

### 3) Haptic Engine：由密到疏，最后重击

核心：把“震动事件”绑定到扇区边界/齿感（tick），随转速降低自动变疏。

- tick 频率近似：`f ≈ ω * N / (2π)`
- tick 间隔：`interval ≈ 1 / f`，并 clamp 到 `[minInterval, maxInterval]`
- 高速：轻触/低幅、必要时限频（避免 100+Hz）
- 低速：更明显的 impact（清晰顿挫）
- 停止瞬间：`heavy impact` + “锁定”音效（可选）

iOS 可用 CoreHaptics 做连续曲线；Android 可用 `VibrationEffect`/Amplitude。

## 快速输入 (Quick Input)

### 1) 粘贴自动分割

- 分隔符：换行 `\n`、逗号 `,`、中文逗号 `，`
- 处理：trim、去空、可选去重、限制数量（例如 2–50）

示例：`A,B\nC` → `["A","B","C"]`

### 2) Prompt 预设（自动生成选项）

内置模板（示例）：

- `帮我生成一组适合情侣看的电影`
- `给我10个今天晚餐的选择`
- `帮我想一些周末约会点子`

流程：选择预设 →（可编辑）→ 调用生成器 → 返回多行/逗号文本 → 按“粘贴分割”规则落入选项列表。

> 生成器可接 LLM（在线）或本地规则（离线兜底）。

## 悬念模式 (Suspense Mode)

目标：在“快停”的最后 1–2 秒制造紧张高潮，而不改变公平性。

触发条件（任选其一）：

- `tRemaining < 1.5s`，其中 `tRemaining = ln(ω/ω_stop)/k`
- 或 `ω < ω_suspense`（例如 `1.2 rad/s`）

效果建议：

- 视觉：自动放大指针区域（camera zoom / wheel scale + mask），边缘加轻微景深/暗角
- 音频：背景音乐 ducking（音量渐降到 20–40%），叠加低频/心跳（可选）
- 动效：高光沿轮缘“追光”减速，最终锁定时闪一次微光

停止时：snap 到扇区中心 → 最后一击 haptic → 显示结果卡片（玻璃浮层）。

---

如果你希望我直接落地到某个技术栈（SwiftUI / Flutter / React Native），告诉我你要的框架和目标平台，我可以把上述 physics/haptics/suspense 写成可运行的 demo。

## 可运行 Demo（Windows + Android）

目录 `spin-wheel/` 是一个零依赖的 Web/PWA demo（Canvas 转盘 + 指数减速 + 震动 tick + 悬念模式 zoom + 合成背景音 ducking）。

- Windows：`cd spin-wheel` → `node server.js` → 打开 `http://localhost:5173`
- Android：同一 Wi‑Fi 下打开 `http://<你的电脑IP>:5173`（部分浏览器能力会降级）
- Android（推荐调试）：`adb reverse tcp:5173 tcp:5173` 后在手机打开 `http://localhost:5173`

说明：

- 震动使用 `navigator.vibrate()`：主要在 Android/Chrome 生效；Windows 通常会自动降级为无震动。
- 音频需要用户手势解锁：点右上角 `♪` 或点一次 `SPIN` 后才会播放/ducking。
- PWA 安装 / 剪贴板读取等能力通常要求“安全上下文”（`https`/`localhost`），所以更推荐用 `adb reverse` 在真机上走 `localhost`。
