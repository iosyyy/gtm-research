# 网页研究台插件

DeepSeek Harness 普通插件包，包含真实 Host 服务、Agent 工具、工作台页面与全部源码。目标版本为 Harness 0.2.1-rc.5。

在 Harness 的「插件 → 安装 → Git 仓库」中填写 `https://github.com/iosyyy/gtm-research`，或选择本目录安装。安装后从侧边栏打开「网页研究台」。熟悉命令行可用：

```sh
dsh plugin --profile desktop add https://github.com/iosyyy/gtm-research
```

从 1.5.1 起，仓库根目录也声明完整组合包，Git 地址可直接安装；本地 `plugin` 目录和 ZIP 解压目录仍支持安装。

安装或更新后重开一次 Harness，使 Host 和 Client 一起加载新代码。仅刷新页面可能仍在使用旧后端。浏览器窗口全程可见，缺少依赖时由执行任务准备，权限与登录沿用 Harness 的正常交互。

支持 GTM Agents / Zime 两套目录、中文用途、搜索筛选、记住设置、PDF / Excel 样式模板和研究材料。工作台创建真实会话，开始后留在研究台，AI 根据本次目标和材料制定计划，并按实际步骤更新；进度和报告由 Host 服务检查。独立的“查看执行过程”在本页展开官方会话组件，支持滚动查看消息、工具记录和继续输入；“打开执行对话”仍跳转到完整会话。需要审批或回答问题时显示原生交互，不代替用户批准。不会用模拟数据代替执行。

- 修改样式：`studio.css`
- 修改组件：`client.template.js`
- 修改默认模板：`templates.json`
- 修改技能目录：`skills.json`
- 修改任务指令：`plan.js`
- 共享 Host 接口：`host-service.js` / `index.js`

```sh
node build.mjs
node --test *.test.mjs
```

修改后重新构建 `client.js` 并通过插件管理器更新。Host 代码更新需要重新加载或重启。

上游许可证随源码包附带，中文用途是基于原始简介修改的翻译。完整说明和教程：https://github.com/iosyyy/gtm-research
