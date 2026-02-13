# NapCat AI聊天插件

一个为NapCat添加AI聊天功能的插件，支持@触发、群聊限制和限频功能。

## 📁 项目结构

```
napcat-plugin-template/
├── src/
│   ├── index.ts              # 插件入口，导出生命周期函数
│   ├── config.ts             # 配置定义和 WebUI Schema
│   ├── types.ts              # TypeScript 类型定义
│   ├── core/
│   │   └── state.ts          # 全局状态管理单例
│   ├── handlers/
│   │   └── message-handler.ts # 消息处理器（命令解析、CD 冷却、消息工具）
│   ├── services/
│   │   └── api-service.ts    # WebUI API 路由（无认证模式）
│   └── webui/                # React SPA 前端（独立构建）
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── src/
│           ├── App.tsx           # 应用根组件，页面路由
│           ├── main.tsx          # React 入口
│           ├── index.css         # TailwindCSS + 自定义样式
│           ├── types.ts          # 前端类型定义
│           ├── vite-env.d.ts     # Vite 环境声明
│           ├── utils/
│           │   └── api.ts        # API 请求封装（noAuthFetch / authFetch）
│           ├── hooks/
│           │   ├── useStatus.ts  # 状态轮询 Hook
│           │   ├── useTheme.ts   # 主题切换 Hook
│           │   └── useToast.ts   # Toast 通知 Hook
│           ├── components/
│           │   ├── Sidebar.tsx       # 侧边栏导航
│           │   ├── Header.tsx        # 页面头部
│           │   ├── ToastContainer.tsx # Toast 通知容器
│           │   └── icons.tsx         # SVG 图标组件
│           └── pages/
│               ├── StatusPage.tsx  # 仪表盘页面
│               ├── ConfigPage.tsx  # 配置管理页面
│               └── GroupsPage.tsx  # 群管理页面
├── .github/
│   ├── workflows/
│   │   └── release.yml        # CI/CD 自动构建发布
│   ├── prompt/
│   │   ├── default.md             # 默认 Release Note 模板（回退用）
│   │   └── ai-release-note.md     # （可选）AI Release Note 自定义 Prompt
│   └── copilot-instructions.md  # Copilot 上下文说明
├── package.json
├── tsconfig.json
├── vite.config.ts             # Vite 构建配置（含资源复制插件）
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建插件

```bash
# 完整构建（自动构建 WebUI 前端 + 后端 + 资源复制，一步完成）
pnpm run build
```

### 3. 部署插件

将 `dist/` 目录的内容复制到 NapCat 的插件目录即可。

### 4. 配置插件

在 NapCat WebUI 中找到本插件，进入配置页面，设置以下参数：

#### 4.1 AI服务类型选择

- **AI服务类型**: 选择使用的AI服务提供商，可选 `OpenAI` 或 `腾讯云AI`

#### 4.2 OpenAI配置

- **API 地址**: OpenAI API地址，默认为 `https://api.openai.com/v1/chat/completions`
- **API Key**: OpenAI API密钥
- **模型名称**: 使用的OpenAI模型名称，默认为 `gpt-3.5-turbo`

#### 4.3 腾讯云AI配置

- **应用密钥**: 腾讯云智能体开发平台的AppKey（需要先创建应用并发布）
- **访客ID前缀**: 腾讯云AI访客ID前缀，用于标识不同用户，默认为 `napcat_`

#### 4.4 通用配置

- **系统提示词**: AI的系统提示词，用于定义AI的角色和行为，默认为 `你是一个智能助手，帮助用户解答问题。`
- **上下文消息条数**: 上下文消息条数，范围2-30，用于控制AI的对话记忆，默认为 10条
- **限频设置**: 一分钟最大调用次数，-1 表示禁用
- **主人QQ列表**: 额外配置的可以禁用或启用AI功能的QQ，多个用逗号分隔
- **黑名单QQ列表**: 这些QQ发送的消息不会被AI回应，多个用逗号分隔
- **屏蔽词正则列表**: 包含这些正则模式的消息不会被AI回应，多个用逗号分隔

## 🎯 功能说明

### 1. AI聊天功能

- **触发方式**: 在群聊中@机器人，然后输入你的问题
- **使用限制**: 仅允许群聊使用，私聊不响应
- **限频设置**: 可在控制台设置一分钟最大调用次数，超过就不回应，设置为-1就是禁用

### 2. 权限管理

以下用户可以禁用或启用AI功能：

- **群聊群主**
- **群聊管理员**
- **控制台配置的主人QQ**

### 3. 命令使用

- **启用AI功能**: `#cmd ai enable`
- **禁用AI功能**: `#cmd ai disable`
- **查看帮助**: `#cmd help`
- **测试连通性**: `#cmd ping`
- **查看运行状态**: `#cmd status`



## 📄 许可证

MIT License
