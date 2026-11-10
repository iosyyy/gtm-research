# 实现与接口

插件为普通工作区包 `@iosyyy/dsh-web-research`，通过 Harness 插件管理器安装；不直接修改个人 profile。目标环境为实际安装版 Harness `0.2.1-rc.5`。

## Git 仓库与 ZIP 安装

仓库根目录的 `package.json` 与 `plugin/package.json` 声明同一个包名和版本。根包的 `dsh.bundle.patch` 指向 `./plugin/cordis.patch.yml`，Host、Client、图标与 locale 的 exports 指向 `./plugin/` 下实际文件；Client 声明与子包保持一致。根包按 files 清单分发所需源码，构建后的 client.js 已提交，不需要安装时执行构建脚本。

这使插件管理器直接安装 Git 仓库地址时也能识别组合包。本地 `plugin` 目录与 ZIP 仍独立可安装。回归检查实际 npm pack 后的包并导入 Host、解析 Client / locale / 图标，避免只检查源码目录。

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

## 同页执行与会话展示

开始研究只创建会话、初始化 Host 状态、上传实际附件并通过 `session.prompt` 提交任务，不调用 `uiWorkspace.openSession`。页面继续监听该会话和 Host 进度；“打开执行对话”是用户主动触发的跳转。

独立的“查看执行过程”在研究台内展开完整宽度。使用 `ctx.sessions.retain()` 获得当前任务的 `SessionReference`，等待 ready 后交给官方 `SessionProvider`，在声明为 session scope 的子 Slot 中调用 `renderFactorySlot('conversation.content', {variant:'embedded', phase:'active', hero:false})`。不会因为主界面选中了另一会话而串线；引用随会话变更和卸载释放。同一时刻只挂载当前面板的一个可编辑会话根。

消息、工具卡、输入和审批复用官方组件，不复制私有组件，也不通过 iframe 加载 Harness 页面。监听 `useSessionStatus` 的 pendingInteraction 后展开，仍由用户完成原生授权或回答。正文容器使用 flex 与有界高度，内部滚动；通用表单 CSS 排除原生会话区域，防止按钮、段落和输入框样式污染。配置区域仍保持挂载，返回时保留输入与所选附件。

这不等于把 PDF / Excel 预览嵌入页面；目前报告入口仍打开实际本地文件。官方 document preview 使用侧边栏资源模型，尚未接入本工作台。

## AI 计划状态协议（1.5.0）

Client 在 begin 后验证 schemaVersion，旧 Host 不支持时停止提交模型任务并提示重开。包版本号只是文件元数据，不能证明运行中的模块已替换；新代码更新后需要按宿主生命周期重开。

新任务状态使用 schemaVersion 2。begin 只写 phase=planning、plan=null 与“正在制定计划”，不创建任何默认步骤。AI 在执行前根据输入调用 set_plan，页面只显示 Host 保存的 plan.steps。

| 操作 | 数据与约束 |
| --- | --- |
| set_plan | plan.summary 和 1–40 个自定步骤，每步唯一 id、中文 title、可选 detail。首次均 pending。修订必须提供原因，按稳定编号保留进度，已完成的步骤不能删除或改写含义。 |
| progress | stepId 与 stepStatus 更新单独步骤；状态为 pending、in_progress、completed、blocked、failed、skipped。等待、失败或跳过要说明原因，同一时刻一个步骤进行中。可附实际依赖检查结果。 |
| status | 返回持久化的计划、版本和实际状态；页面不按当前步骤位置补算前面步骤。 |
| finalize | 新任务计划必须存在。除唯一进行中的最后一步外，其他步骤须 completed / skipped；实际文件检查通过后，才原子完成最后一步和任务。仅写 progress 不能完成任务。 |

`task-plan.js` 处理计划校验和独立步骤更新，`host-service.js` 负责持久化与文件边界。页面、命令和 Agent 工具共用这份状态。任务的技能安装、可见浏览器、附件和导出约束仍生效，具体工作顺序由 AI 制定。旧版状态仍可读取和继续更新，页面不为其制造一份 AI 计划。

## 步骤计时（1.6.0）

新任务带 timingVersion=1；Client 在发送研究任务前检查后台是否已加载计时支持，旧 Host 明确提示重开，不静默发起没有步骤计时的新任务。Host 在首次 in_progress 保存 startedAt，在 completed / failed / skipped 保存 finishedAt；重复状态消息保持原起止，计划修订按稳定编号保留，恢复执行保留首次开始。报告最终检查通过才写任务 completedAt；重复 finalize 不延长已完成任务时长。时间不来自 Agent 参数。

Client 的 useRunClock 只使 PlanProgress 每秒重绘，完成后停止并清理 interval，不重绘整个工作台或嵌入会话。显示实际经过的墙上时间，包含等待与暂停，不作为纯模型响应延迟。旧任务缺少步骤起点不从 updatedAt 推算；只能从新更新开始记录的旧执行步骤标记 timingPartial，页面用 ≥ 标示下限。

提示词按所选浏览器生成相应规则，其他引擎指令不进入模型输入；只有用户选择个人来源时保留该导入检查。自动模式在内置操作验证失败后才准备外部浏览器。48 组配置逐条对照范围、计划、证据、授权与导出条款；这属于输入约束对照，不等于模型输出质量或真实任务速度 A/B。旧版生成器以测试夹具保留，便于核对和回退。

## PDF 预设版式（1.7.0）

`pdf-styles.js` 保存四种版式的稳定编号、中文名称、尺寸、排版要求与文件名。`pdf-templates/*.pdf` 是随 Git 包和 ZIP 分发的真实参考文件。Host 在 begin 中校验编号、复制对应 PDF 至本任务 `_inputs/pdf-template.pdf`，并返回 `pdfTemplateVersion=1` 和 `reportTemplate`。路径按现有目录边界检查，不允许符号链接写到任务目录外。Client 在发送任务前核对版本和所选编号；旧 Host 或错配时阻止发送并提示重开。

Client 保存预设选择，PDF 上传期间禁用预设选项。自定义上传以 `custom` 标识，Host 不复制预设，提示词让 Agent 读取实际上传的 PDF；移除上传文件恢复原预设。研究材料中的 PDF 不会被误当成版式模板。版式只规定展示，不改变研究范围、技能来源或模型设置；正式报告替换全部占位内容，不保留模型名称和参数。

生成脚本使用 ReportLab 和可嵌入的中文字体；可通过 `PDF_TEMPLATE_FONT` 指定字体路径。预览 PNG 来自实际 PDF 渲染。样张不是研究数据或执行结果；Agent 仍需生成、回读并核对本次报告。复杂上传版式的精确复刻不保证，按实际差异说明。

研究目录版本升至 3，从旧版升级会补入新增默认用途，保留按编号保存的用户修改与选择；已升级的目录继续尊重用户主动删除的选项。研究模板不携带模型配置。

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
- [Conversation Factory](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-conversation/README.md)
- [Session Provider](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-session/README.md)
- [Plugin Manager 加载生命周期](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)
- [UI Slots](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-slots/README.md)
- [Browser](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-sidebar-browser/README.md)

接口以当前安装版实际源码为准；升级 Harness 后需要重新验证。
