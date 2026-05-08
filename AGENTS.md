# UI 设计指南

> **设计类型**: App 设计（应用架构设计）
> **确认检查**: 本指南适用于可交互的应用/网站/工具。

> ℹ️ Section 1-2 为设计意图与决策上下文。Code agent 实现时以 Section 3 及之后的具体参数为准。

## 1. Design Archetype (设计原型)

### 1.1 内容理解

- **目标用户**: 企业内部用户和开发者，使用wcnb.ai中转站调用多AI模型，需要一站式管理配置、对话、Token消耗统计
- **核心目的**: 提供统一的多模型对话交互入口，管理API密钥配置，监控Token消耗和费用，帮助企业掌控AI使用成本
- **期望情绪**: 专业可靠、高效专注、数据透明、安全可控
- **需避免的感受**: 杂乱无章、廉价感、数据混淆、操作复杂、隐私泄露焦虑

### 1.2 设计语言

- **Aesthetic Direction**: 现代简约企业级AI工具设计，信息层级清晰，突出数据展示，交互反馈即时明确
- **Visual Signature**: 
  1. 沉稳炭蓝主色调传递专业信任感，符合企业级应用定位
  2. 清晰区块分隔，数据卡片突出关键指标，Token用量一目了然
  3. 适度圆角搭配柔和阴影，营造现代但不轻浮的质感
  4. 对话气泡差异化设计，用户问题与AI回复清晰区分
  5. 语义化状态配色，配置有效性、Token消耗状态一目了然
- **Emotional Tone**: 专业可靠 + 高效简洁 — 企业级工具需要传递信任感，同时保持操作流畅不干扰思考
- **Design Style**: **Soft Blocks 柔色块** — 多功能区块的数据密集型应用，需要清晰的区域分隔，柔和圆角和低饱和度色块让界面长时间使用不疲劳
- **Application Type**: SaaS / 企业级AI工具 - 多页面功能系统，需要侧边栏持久导航

## 2. Design Principles (设计理念)

1. **数据优先**: Token统计和消费记录清晰呈现，关键数据视觉突出，让用户快速掌握使用状况和成本
2. **专注对话**: 对话区域保持干净，干扰元素最小化，让用户专注于内容交互和思考
3. **状态透明**: API配置状态、请求状态、Token消耗都有明确的视觉反馈，消除不确定性
4. **安全可信**: 配置信息强调隐私保护，操作有确认机制，传递企业级应用的安全感
5. **一致性**: 所有页面保持统一的视觉语言，用户学习成本低，操作形成肌肉记忆

## 3. Color System (色彩系统)

> 基于内容理解推导配色方案，确保整体协调。

**配色设计理由**: 企业级工具需要建立专业信任感，选择沉稳的炭蓝色作为主色，低饱和度搭配足够的对比度，既专业又不会造成视觉疲劳，数据展示清晰可读，长时间监控Token消耗也不易疲劳。

### 3.1 主题颜色

> **Color Token 语义速查（供 code agent 参考）**:
> - `primary` → 主行动：按钮填充、激活态高亮、关键操作 CTA
> - `accent` → 状态反馈：Ghost/Outline 按钮 hover、DropdownMenu focus、Toggle 激活、Skeleton 占位背景
> - `muted` → 静态非交互：禁用态背景、次级说明背景、占位文字色（`text-muted-foreground`）
> - **选择原则**：用户"可以点击" → primary；交互"正在发生" → accent；内容"不可操作" → muted

| 角色               | CSS 变量               | Tailwind Class            | HSL 值    
| ------------------ | ---------------------- | ------------------------- | ---------- | 
| bg                 | `--background`         | `bg-background`           | `hsl(225 25% 97%)` |
| card               | `--card`               | `bg-card`                 | `hsl(0 0% 100%)` |
| text               | `--foreground`         | `text-foreground`         | `hsl(224 71% 10%)` |
| textMuted          | `--muted-foreground`   | `text-muted-foreground`   | `hsl(220 9% 46%)` |
| primary            | `--primary`            | `bg-primary`              | `hsl(215 85% 38%)` |
| primary-foreground | `--primary-foreground` | `text-primary-foreground` | `hsl(0 0% 100%)` |
| accent             | `--accent`             | `bg-accent`               | `hsl(215 85% 96%)` |
| accent-foreground  | `--accent-foreground`  | `text-accent-foreground`  | `hsl(215 85% 38%)` |
| border             | `--border`             | `border-border`           | `hsl(220 13% 91%)` |

### 3.2 Sidebar 颜色（仅当使用 Sidebar 导航时定义）

| 角色                       | CSS 变量                       | Tailwind Class                    | HSL 值     | 设计说明                         |
| -------------------------- | ------------------------------ | --------------------------------- | ---------- | -------------------------------- |
| sidebar                    | `--sidebar`                    | `bg-sidebar`                      | `hsl(0 0% 100%)` | Sidebar 背景色，纯白与主内容浅灰形成清晰区分 |
| sidebar-foreground         | `--sidebar-foreground`         | `text-sidebar-foreground`         | `hsl(224 71% 10%)` | 文字对比度满足 WCAG AA 标准   |
| sidebar-primary            | `--sidebar-primary`            | `bg-sidebar-primary`              | `hsl(215 85% 38%)` | 激活态背景使用主色保证视觉突出                     |
| sidebar-primary-foreground | `--sidebar-primary-foreground` | `text-sidebar-primary-foreground` | `hsl(0 0% 100%)` | 激活态白色文字，对比度满足要求     |
| sidebar-accent             | `--sidebar-accent`             | `bg-sidebar-accent`               | `hsl(215 85% 96%)` | Hover 态使用浅主色背景，提供清晰交互反馈       |
| sidebar-accent-foreground  | `--sidebar-accent-foreground`  | `text-sidebar-accent-foreground`  | `hsl(215 85% 38%)` | Hover 态文字使用主色保持一致性                     |
| sidebar-border             | `--sidebar-border`             | `border-sidebar-border`           | `hsl(220 13% 91%)` | 使用全局边框色，维持整体风格统一       |
| sidebar-ring               | `--sidebar-ring`               | `ring-sidebar-ring`               | `hsl(215 85% 38%)` | 聚焦环使用主色保持一致性                       |

### 3.3 语义颜色（可选）

| 语义 | CSS 变量 | HSL 值 | 用途 |
| ---- | -------- | ------ | ---- |
| success | `--success` | `hsl(142 76% 36%)` | 配置验证成功、Token消耗正常状态 |
| success-foreground | `--success-foreground` | `hsl(0 0% 100%)` | 成功状态文字 |
| warning | `--warning` | `hsl(38 92% 50%)` | 配置提醒、Token配额预警 |
| warning-foreground | `--warning-foreground` | `hsl(224 71% 10%)` | 警告状态文字 |
| error | `--error` | `hsl(0 84% 60%)` | 配置无效、请求失败、错误提示 |
| error-foreground | `--error-foreground` | `hsl(0 0% 100%)` | 错误状态文字 |

## 4. Typography (字体排版)

- **Heading**: 思源黑体, system-ui, -apple-system, BlinkMacSystemFont, sans-serif
- **Body**: 思源黑体, system-ui, -apple-system, BlinkMacSystemFont, sans-serif
- **Mono (数字/代码/Token统计)**: JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
- **字体导入**: 使用系统字体栈，无需引入外部字体，保证多端兼容性

**排版层级规范**:
- 页面标题: `text-2xl font-bold` （24px/700）
- 区块标题: `text-lg font-semibold` （18px/600）
- 正文: `text-base font-normal` （16px/400），行高 `leading-relaxed`
- 次要文字: `text-sm text-muted-foreground` （14px）
- 小字/标签: `text-xs text-muted-foreground` （12px）
- 数据数字: `text-xl font-semibold` （20px/600），强制使用等宽字体确保表格对齐
- 对话内容: `text-base leading-relaxed`，支持Markdown渲染，代码块使用等宽字体

## 5. Layout Strategy (布局策略)

### 5.1 结构方向

**导航策略**: 功能模块分为对话交互、配置管理、Token监控、历史对话四个主要功能，需要持久导航快速切换 → 采用侧边栏布局，桌面端固定显示，移动端折叠为抽屉菜单。

**页面架构特征**: 企业级SaaS应用，功能分区清晰，侧边栏提供全局导航，主内容区容纳各页面功能，数据展示（Token监控）和对话交互并重，需要保持不同功能区域的视觉一致性。

### 5.2 响应式原则

**断点策略**:
- 桌面端（>1024px）：侧边栏固定展开，宽度 240px，主内容区自适应
- 平板端（768px-1024px）：侧边栏默认折叠，点击顶部汉堡按钮展开为抽屉
- 移动端（<768px）：侧边栏全屏抽屉，覆盖主内容区，关闭后返回主内容

**内容密度**:
- 桌面端：数据概览区使用多列卡片布局（2-4列），表格全宽展示消费记录
- 平板端：数据概览区2列卡片布局
- 移动端：单列流式布局，卡片堆叠，表格横向可滚动
- 触摸设备：可点击区域最小 48px，满足移动端可点击要求

**全局容器约束**:
- 主内容区最大宽度限制为 `max-w-[1600px]`，大屏幕不会无限拉伸导致行宽过长
- 各区块保持合理内边距 `p-6`，确保足够呼吸空间
- 对话展示区在大屏幕保持合理阅读宽度，不强制全宽

## 6. Visual Language (视觉语言)

**形态特征**:
- 柔和圆角: 容器卡片使用 `rounded-lg` (0.5rem)，按钮使用 `rounded-md`，保持现代柔和感不生硬
- 细微阴影: 卡片使用 `shadow-sm`，悬浮交互元素使用 `shadow-md`，营造层次不突兀
- 柔色块分隔: 不同功能区块使用背景色差异区分，不依赖厚重边框
- 间距: 采用 `spacious` 间距规格，区块间 `gap-6` ~ `gap-8`，卡片内 `p-6` ~ `p-8`

**对话气泡特殊规则**:
- 用户消息: 靠右对齐，主色背景 `bg-primary` + 白色文字 `text-primary-foreground`，圆角自然
- AI回复: 靠左对齐，卡片背景 `bg-card` + 前景文字 `text-foreground`，边框 `border-border`
- 气泡最大宽度限制为 `max-w-[85%]`，避免过宽行高影响阅读体验
- 流式响应过程中，打字效果保持柔和闪烁，不干扰阅读

**装饰策略**:
- 极简原则，不使用额外装饰元素
- 数据卡片通过轻微阴影和背景色差异建立层次
- 无冗余装饰，所有视觉元素服务于功能
- 保持页面干净，让用户聚焦于对话内容和数据

**动效原则**:
- 交互反馈快速干脆，hover/focus 过渡时长 150ms
- 侧边栏展开/收起使用平滑过渡 200ms
- 对话新消息加载使用淡入效果，不干扰阅读
- 打字响应过程使用轻微脉动效果，指示正在生成
- 所有可交互元素必须有 hover/focus/active 状态反馈

**可及性保障**:
- 所有正文文字对比度 ≥ 4.5:1，大标题对比度 ≥ 3:1，符合 WCAG AA 标准
- 交互状态有明确视觉反馈（hover背景变化、focus环）
- 语义颜色不仅靠色相区分，也有足够明度对比，色盲用户可识别
- 表单错误状态同时提供文字说明和颜色提示
- API Key输入框提供显示/隐藏切换，兼顾安全和可检查性

**组件状态规范**:
- **Primary Button**: `bg-primary text-primary-foreground` → hover: `bg-primary/90`，disabled: `opacity-50 cursor-not-allowed`
- **Secondary Button**: `bg-accent text-accent-foreground` → hover: `bg-accent/80`
- **Outline Button**: `border-border text-foreground` → hover: `bg-accent`
- **Input**: `border-border` → focus: `ring-1 ring-primary border-primary`
- **Card**: `bg-card border-border rounded-lg shadow-sm`
- **Sidebar Item**: 默认 `text-foreground hover:bg-accent` → 激活 `bg-sidebar-primary text-sidebar-primary-foreground`
- **Select**: 下拉选项 hover 使用 `bg-accent`，选中项使用 `bg-primary/10 text-primary`

**Token数据展示规则**:
- 用量数字和费用必须使用等宽字体保证表格对齐
- 费用统一保留两位小数，右对齐展示
- 模型用量占比饼图从主色出发色相偏移生成配色，保持整体协调
- 状态标签统一使用胶囊形状 `rounded-full px-2 py-1 text-xs`
- 数据卡片中关键指标（总Token、总费用）字号放大加粗，视觉突出

**对话页面特殊布局**:
- 对话展示区占满可用高度，自动滚动到底部展示最新消息
- 输入框固定在底部，模型选择栏在输入框上方，保持可见
- 历史对话边栏在桌面端可见，移动端收起，保持主内容区域干净

## 7. Application State

### 7.1 页面路由

| 页面名称 | 路由路径 | 页面文件 |
|---------|---------|--------|
| 对话交互页 | `/` | `client/src/pages/ChatPage/ChatPage.tsx` |
| Agent列表页 | `/agent` | `client/src/pages/AgentPage/AgentPage.tsx` |
| Agent对话页 | `/agent/:agentId` | `client/src/pages/AgentChatPage/AgentChatPage.tsx` |
| Agent编辑页 | `/agent/:agentId/edit` | `client/src/pages/AgentEditPage/AgentEditPage.tsx` |
| Workflow列表页 | `/workflow` | `client/src/pages/WorkflowPage/WorkflowPage.tsx` |
| Workflow编辑器 | `/workflow/:workflowId` | `client/src/pages/WorkflowEditorPage/WorkflowEditorPage.tsx` |
| n8n配置页 | `/n8n-config` | `client/src/pages/N8nConfigPage/N8nConfigPage.tsx` |
| 配置管理页 | `/config` | `client/src/pages/ConfigPage/ConfigPage.tsx` |
| Token监控页 | `/token-monitor` | `client/src/pages/TokenMonitorPage/TokenMonitorPage.tsx` |
| 历史对话页 | `/history` | `client/src/pages/HistoryPage/HistoryPage.tsx` |
| 登录页 | `/login` | `client/src/pages/LoginPage/LoginPage.tsx` |

### 7.2 导航结构

- **导航组件**: `client/src/components/Layout.tsx`
- **导航类型**: 侧边栏导航（Sidebar）
- **导航项**: 对话交互、Agent、Workflow、配置管理、Token监控、历史对话
