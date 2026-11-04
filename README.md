# 网页研究台

可修改、可本地运行的 **DeepSeek Harness 插件**，附完整中文教程。插件与 GitHub Pages 网站在同一个仓库。

- [在线教程](https://iosyyy.github.io/gtm-research/)
- [下载插件源码包](https://iosyyy.github.io/gtm-research/downloads/dsh-web-research-plugin.zip)
- [实现与接口说明](architecture.md)
- [验证记录与能力边界](VERIFICATION.md)
- [用户已要求后续处理的功能](BACKLOG.md)

## 新手怎么开始

1. 从 [官网](https://www.deepseek.com/en/harness/) 安装并打开 DeepSeek Harness，登录自己的账号。
2. 新建一个对话，复制下面这段给它，让它下载和安装插件：

```text
帮我安装网页研究台插件：
https://github.com/iosyyy/gtm-research

先读 README，下载仓库，再使用当前 Harness 支持的插件管理器安装 plugin 目录。
不要手改个人 profile 配置。需要审批时正常申请。
安装后确认侧边栏有“网页研究台”；需要重新加载时告诉我。
```

3. 在侧边栏打开「网页研究台」，填网页名称和地址，选择技能、数量及浏览器，再点「开始研究」。需要登录或授权时，在执行对话里按提示操作。

插件复用 Harness 的模型和账号，不需要另填模型 API Key。运行会消耗你自己账号的用量。

熟悉命令行的用户可在已安装 `dsh` 的环境运行：

```sh
dsh plugin --profile desktop add /absolute/path/gtm-research/plugin
```

目录使用自己的实际路径。通过官方插件管理器添加本地目录同样可以。更新后若仍显示旧界面，关闭并重开 Harness。

## 可以改什么

- 网页名称和 URL 默认留空，支持公开网站或你有权限的内部页面。
- 「最多看多少项」包含正文和可读取的评论，也可选择全部。全部按可访问范围分批处理，无法完成时说明剩余范围。
- **GTM Agents** 与 **Zime GTM Skills** 分开选择，包含 244 / 71 个技能目录项与中文用途。每个选择保留仓库和目录，避免同名技能混用。
- 全部模板常驻下拉框显示，点“编辑模板”或“添加模板”打开弹窗表单。skill 在原列表统一勾选，也可交给 Agent 修改。Agent 通过 `web_research_manage` 保存，与页面使用同一个 Host 服务。
- 可上传 PDF 版式模板、Excel 模板及研究材料；在副本中应用结果，保留原附件。
- 默认选择系统默认浏览器，之后自动记住上次的设置。出于浏览器文件安全限制，重开页面需要重新选择上传文件。

Zime 主要审核销售通话与 CRM，需要买方原话或导出数据。论坛讨论不足以证明预算、决策权、成交概率等信息，缺少材料时应该补充材料或换研究方式。

## 浏览器怎么选

| 选项 | 运行行为 |
| --- | --- |
| 自动 | 检查内置操作能力，不可用时用 agent-browser 的可见 Chrome for Testing。 |
| Harness 内置 | 当前官方组件主要供查看。缺少模型可用的读取、点击工具时，停止并提示改选。 |
| Chrome for Testing | 用 agent-browser 和独立研究资料目录，窗口可见。 |
| 本机 Chrome | 用本机 Chrome 可执行文件与独立研究资料目录，不复制日常个人 profile。 |
| 系统默认浏览器 | 通过系统默认方式打开；先验证现有工具能否操作，无法操作就明确提示。 |
| agent-chrome | 检查本机兼容 CLI 与现有连接；未安装时要求提供确切来源，不猜测同名项目。 |

所有方式都禁止无头浏览器，包含截图与浏览器 PDF 导出。仅能打开页面不代表已经具备自动采集能力。

## skill 会自动安装吗

开始研究的任务会先实际检查选定来源的必要 skill、浏览器 CLI 和浏览器组件。已有的复用，缺少的由 Harness 按官方来源下载、安装并验证。系统授权、网络审批和账号登录沿用 Harness 的正常流程；失败时应停止并说明。

这是 Harness 执行的安装流程，插件不会绕过审批，也不保证任意电脑或任意网站零操作完成。当前机器已经安装的工具只能验证复用路径，不能冒充全新机器安装测试。

## 文件与源码

```text
plugin/              Harness 插件、Host 服务与测试
docs/                GitHub Pages 静态教程、中文技能目录与插件下载
scripts/             打包脚本
licenses/            上游许可证
architecture.md      插件接口与数据流
VERIFICATION.md      实际验证及已知限制
```

任务目录在所选工作区的 `web-research-runs/<runId>/`，包含 `task-state.json`、`manifest.json` 和实际报告。模板配置存放在工作区 `.web-research/studio-config.json`；网页、数量、来源等界面偏好留在本机 Harness 页面存储。

```sh
node plugin/build.mjs
node --test plugin/*.test.mjs
python3 scripts/package_plugin.py
python3 -m http.server 8767 --directory docs --bind 127.0.0.1
```

修改 `plugin/client.template.js`、`studio.css`、`templates.json` 后重新构建。修改 Host 代码后重新加载插件或重启 Harness。GitHub Pages 使用 `main` 分支的 `/docs`。

## 许可证

本仓库新增代码使用 MIT。技能目录和中文用途依据上游内容整理，英文标识及原始简介保留以便核对；中文用途经过修改和精简。GTM Agents 使用 Apache-2.0，Zime 使用 MIT，详见 [上游说明](THIRD_PARTY_NOTICES.md)。本仓库不重新分发完整 skill 正文或第三方浏览器程序。
