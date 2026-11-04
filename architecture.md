# 实现与接口

插件为普通工作区包 `@iosyyy/dsh-web-research`，通过 Harness 插件管理器安装；不直接修改个人 profile。目标环境为实际安装版 Harness `0.2.1-rc.5`。

## 页面与 Agent 共用 Host 服务

```mermaid
flowchart LR
  A[插件按钮] --> B[remote.commands.execute]
  B --> C[/web-research 命令]
  D[Harness Agent] --> E[web_research_manage 工具]
  C --> F[ResearchService]
  E --> F
  F --> G[工作区状态和模板]
  F --> H[报告文件检查]
  H --> A
```

`host-service.js` 只处理工作区内的状态、模板和报告检查。UI 与工具调用同一个 `execute(cwd, args)`，包括相同的数据校验、错误与目录边界。它不授予系统权限、不代替用户确认登录，也不执行上传文档里的宏或指令。

`index.js` 使用官方 `ctx.commands.register()` 与 `ctx.tools.register()`。Client 声明 `remote.commands` 注入，通过已有的 Remote 通道调用命令，不单开未鉴权 HTTP 服务、不读取 Harness Cookie。任务仍使用官方 `ctx.sessions.create/retain/using` 和 `session.prompt/cancel`。

进度由 Agent 调用结构化工具更新。报告只从 Host 检查后的结果显示，不从助手随意回复的一行文字生成完成状态。Host 确认路径、文件存在、非空与格式签名；排版、中文、公式和链接的实际质量需要执行 Agent 回读检查。

## skill 来源

`skills.json` 保存来源仓库、相对目录、英文 ID、中文用途和原始简介，`templates.json` 引用这些身份。即使名称相同，来源目录仍不同。模板的技能选择保留来源路径；当前界面只开放两套官方技能，不再提供个人 skill 导入入口。开始任务只请求安装所选来源的必要目录及引用文件，不覆盖已有同名项。

官方 `ctx.skills.registerProvider()` 可实现独立 skill provider。当前沿用 Harness 已有的 skill 加载机制，由执行任务检查并准备依赖；没有把全部正文加载进每个会话，也没有将第三方仓库中的安装脚本直接当成可信代码执行。

## 浏览器边界

官方内置 Browser 是 Web iframe / Desktop webview，文档的 Model Experience 为 None。打开内置网页和让模型能够读取、点击是不同能力。自动模式检测失败后改用可见 agent-browser；显式选择某引擎时，能力不足要提示，不能暗中换引擎。

GitHub Pages 只分发教程和源码，不能直接控制访客的本机 Harness、浏览器或文件。真实 Demo 下载后在本机安装运行，不提供伪造的执行结果。

## 官方依据

- [用户操作和工具扩展](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/api-gateway.md)
- [Commands](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/interaction/commands/README.md)
- [Session Controller](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/api/session-controller/README.md)
- [Skills](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md)
- [Browser](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-sidebar-browser/README.md)

接口以当前安装版实际源码为准；升级 Harness 后需要重新验证。
