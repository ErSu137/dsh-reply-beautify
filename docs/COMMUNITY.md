# 发现渠道与介绍草稿

2026-10-19 核实。只准备文案，未代发、未联系任何人。

## 渠道

- 添加准确的 `dsh-plugin` Topic：[官方 README 建议](https://github.com/deepseek-ai/deepseek-harness#community-and-support)。另用 dsh、deepseek-harness、typography、data-visualization、javascript 等实际相关标签。
- 官方 Discussions **Show Your Plugins!** 分区：一项目一主题，规定标题格式，明确非官方并附项目、截图、集成方式。[规则](https://github.com/deepseek-ai/deepseek-harness/discussions/2004) · [分区](https://github.com/deepseek-ai/deepseek-harness/discussions/categories/show-your-plugins)
- 官方 README 的 Discord 入口可供后续查阅服务器规则，在允许频道分享；也可在个人技术分享和同学群邀请真实试用。[入口页面](https://github.com/deepseek-ai/deepseek-harness#community-and-support)
- GitHub Search、Topics、Explore、关注与Stars都是发现方式，准确介绍与演示有助理解用途。[GitHub 文档](https://docs.github.com/en/get-started/exploring-projects-on-github/discovering-projects-on-github)

没有可靠官方证据证明立即10次下载触发推荐，或晚几天下载受惩罚。不要编造首发窗口/Trending门槛。官方插件讨论区按社区 Upvote 排序，不等于GitHub下载算法，更不代表官方背书。

自定义市场另有索引、精确版本和Git commit/npm来源要求，GitHub发布不等于进入市场。[市场说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md)

## 中文草稿

**DSH｜Reply Beautify｜让回复更易读、让图表和小工具可操作**

> 非官方项目，由社区成员独立开发和维护。

项目：https://github.com/ErSu137/dsh-reply-beautify

为 DeepSeek Harness 提供三种排版预设、交互图表和表格、隔离 HTML 作品空间。通过客户端扩展位加载画笔与侧栏，通过Host只读格式指南帮助模型选择组件；保留原文与启停卸载入口，不自动发送操作结果。

0.6.0为预览版，兼容依据Windows Desktop 0.2.1-rc.2，最终实机视觉与多设备验收待补。模型不一定每次出组件，任意作品也不保证绝对安全。欢迎按Release安装说明在新建测试对话体验，反馈脱敏复现步骤。

可使用已验收的[六张演示图](demo/README.md)。前四张标注为独立通用样例，后两张为裁去账号与会话侧栏的DSH实机组件截图；不要把两类来源混称为实机截图。

## English draft

**DSH | Reply Beautify | Readable replies, interactive charts and isolated mini apps**

Unofficial community project: https://github.com/ErSu137/dsh-reply-beautify

Three typography presets, charts/tables and an isolated HTML artifact workspace. Integrates through DSH client slots and read-only Host format guidance, with original-content access and reversible controls. Version 0.6.0 is a preview based on Windows Desktop 0.2.1-rc.2 interfaces; final DSH acceptance and broader compatibility remain pending. The README provides a synthetic standalone demo and checksum-verified downloads. Feedback from real installs is welcome.

## 30秒演示顺序

新空白测试对话 → 三风格 → 通用工时图表 → 切系列、改计算输入 → 计数作品运行/停止 → 查看原文、画笔关闭。标注插件和DSH版本；录制前隐藏私人侧栏、账号与路径。先组织[真实安装测试](TESTING.md)，修主要问题后集中分享，无需制造下载量。
