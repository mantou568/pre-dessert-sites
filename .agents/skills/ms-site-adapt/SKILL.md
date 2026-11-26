---
name: ms-site-adapt
description: MS(MediaSaber) PT 站点适配技能。当用户要求适配/新增/修复 pre-dessert-sites 站点配置——编写 site_config/sites/*.json、NexusPHP 选择器、JSON API 解析、login_assist 登录辅助、favicon，或排查站点配置不生效/后端报错/解析为空时使用。用户说"适配 xx 站点""新增站点配置""修复 xx 站点解析""加个站"等即应触发本技能。
---

# MS 站点适配

本技能指导你在 pre-dessert-sites 配置库中完成一个站点的**完整适配**：踩点 → 编写 `site_config/sites/{id}.json` → favicon → 双 lint 校验 → （可选）后端实测 → 提交。配置由 MS(MediaSaber) 后端在运行时消费，字段语义以本技能 `references/` 为准（已逐项对照后端 Go 源码核对）。

## 权威依据与红线

- 信息优先级：`references/`（schema / requests-and-fields / filters / login-assist）> `doc/`（背景阅读，部分字段名已过时）> `site_config/commons/NexusPHP.json` 等现有实例。
- **未知过滤器名 / 未知 schema 会让后端直接 panic**；`parser` 大小写精确匹配（`XML` 非法，应写 `Xml`）。写完任何配置必须跑双 lint。
- 配置是**严格 JSON**：无注释、无尾逗号，一个文件坏会拖垮整批配置加载。
- 配置里**严禁出现任何真实凭据**（Cookie、passkey、账号）；Cookie/UA 由后端从用户数据自动附带。
- 过时写法不要模仿：`price`（应为 `meta`）、`common_fields`/`fields_ref`（已不支持）、`imdbid`（应为 `imdb_id`）、details 的 `hr`（应为 `hr_days`）、`download_file`（应为 `download_link`）。

## 需要向用户确认的输入

开始前向用户收集（缺什么问什么，不要臆测）：
1. 站点名称、首页 URL、站点程序（NexusPHP / UNIT3D / 自研 / JSON API？）；
2. 可登录的测试账号 Cookie（适配验证必需；仅凭登录页无法完成 search/user_basic_info 适配）；
3. 用户关心的功能范围（仅搜索？签到？消息？做种统计？）；
4. 有浏览器操作能力时自行踩点；没有时请用户提供关键页面的 HTML 源码（搜索结果页、详情页、用户控制面板、登录页）。

## 适配流程

### 1. 查重与定名

```bash
# 域名/站名查重，避免重复适配或撞名
grep -ril "<域名主体>" site_config/sites/
grep -il "<站名>" site_config/sites/*
```

- 站点 `id`：snake_case（小写字母/数字/下划线），与现有站风格一致；**文件名 = 顶层 `id` = favicon 名** 三者一致。
- 优先确认 `schema`：绝大多数站 `"schema": "NexusPHP"`，直接继承 commons，只写差异。

### 2. 踩点（浏览器操作）

逐页确认并记录「请求方法 + URL + 参数 + HTML/JSON 结构」：

| 页面 | 要采集的信息 |
|---|---|
| 搜索结果页 | 搜索是 GET `torrents.php?search={keyword}` 还是 POST 表单；列表行选择器；每行各列（标题/副标题/分类/评论数/做种/下载/体积/发布时间/免费标志）对应的节点 |
| 详情页 | free / 2xFree / HR 标志节点；下载链接格式（`download.php?id=...`） |
| 用户控制面板 | 上传量/下载量/魔力/分享率的节点；用户 id |
| 做种列表 | 是否有 `getusertorrentlistajax.php?userid={userId}&type=seeding`（继承 commons 的前提） |
| 登录页/2FA 页 | 验证码图片与输入框、两步验证输入框选择器（判断是否需要 `login_assist`） |

选择器编写注意：CSS `>` 要求直接子级，跨 `tbody` 会失败（用空格后代选择器）；NexusPHP 惯例 `table.torrents tr:has(table.torrentname)`、`td`（不写 `td.rowfollow`）。

### 3. 编写 `site_config/sites/{id}.json`

- 从最小差异开始：能继承 commons 的请求键不要重写；站点不支持的请求键显式 `{"disabled": true}`。
- 改写继承来的请求时，用 `disabled_extends` 精确切断不需要继承的键；JSON API 类站点全部切断后整体重写（参考 `piggo.json`、`kele.json`、`mteam.json`）。
- 必读 [references/schema.md](references/schema.md)（顶层字段/继承/占位符）与 [references/requests-and-fields.md](references/requests-and-fields.md)（每个请求的输出字段名）。
- 过滤器用法与陷阱见 [references/filters.md](references/filters.md)——**timestamp 后不要再叠 timezone +8**；没有"统计行数"的过滤器。
- 分类映射写 `category.movie/tv/...`（键 `Single` 首字母大写）；`meta` 写 `has_free/has_2x_free/has_hr/has_cover/shoutbox`。

### 4. login_assist（仅非标准场景）

标准 NexusPHP `imagestring` 验证码**零配置**（扩展内置识别）。只有验证码/两步验证结构特殊时才配置，规则与清洗行为见 [references/login-assist.md](references/login-assist.md)。分离式 2FA 参考 `piggo.json`。

### 5. favicon

添加 `site_favicon/{id}.png`，128×128 PNG，文件名与 `id` 精确一致（含大小写；后端在 Linux 上按 `{id}.png` 精确查找）。可从站点 `/favicon.ico` 取图后缩放。

### 6. 双 lint 校验（必须全绿）

```bash
npm install
npm run lint:selectors   # login_assist 选择器语法（jsdom 同源）
npm run lint:configs     # 全量配置校验：命名三要素/schema/parser/过滤器白名单
```

`lint:configs` 的 error 必须清零；warning 逐条判断——新适配不应引入新 warning（`category.*`/`meta.*` 未知键、过时字段名都会告警）。

### 7. 实测（可选但强烈建议）

三选一，优先 a：

a. **后端 dev 接管**：本地跑 MS 后端时设环境变量 `MS_SITE_CONFIG_DEV_DIR=<本仓库根>`（后端直接读 `<该目录>/site_config`，重启生效；该模式会停用在线更新/手动上传）。然后在 MS 界面添加该站点，跑「站点测试」：搜索、用户信息、做种统计逐项核对数值与页面一致。
b. **手动上传**：`tar -czf site_config.tar.gz site_config/ site_favicon/`，在 MS 后台「站点配置」上传（≤64MB，须含 `site_config/` 目录），或 `POST /api/v1/site/uploadConfigs`。
c. **发版订阅**：合并后 CI 自动发 Release，订阅方按 `main_`/`dev_` 前缀拉取（最慢，作为兜底验证）。

### 8. 提交

- 提交信息风格（对照 `git log`）：新增站点 `feat ✨: 新增<站名>站点适配配置`；修复 `fix(<site>): <改动摘要>`；文档 `docs 📚: <摘要>`。中文描述。
- 默认基于 `dev` 分支提交 PR（dev 推送自动发 dev 渠道版本，稳定版由维护者合入 main）。
- 注意：本技能目录 `.agents/skills/ms-site-adapt/` 与 `scripts/`、`package.json` 也属于配置库内容，改动后一并提交；`git status` 确认改名类变更（如 favicon 大小写修正）已纳入。

## 完成定义（DoD）

1. `site_config/sites/{id}.json` + `site_favicon/{id}.png` 就位，三要素一致；
2. `npm run lint:selectors` 与 `npm run lint:configs` 双绿、无新增 warning；
3. （有测试账号时）后端实测搜索/用户信息数值与站点页面一致；
4. 提交信息符合仓库风格。

## 常见排查

- **搜索拿到空列表**：九成是 CSS `>` 跨 `tbody` 问题，改后代选择器；再查 `list.selector` 是否只命中表头。
- **字段值全空**：`parser` 大小写错误（`XML`→`Xml`）、选择器未命中、过滤器链把值抹空（如 `re_search` 组号越界）。
- **后端日志 panic "unknown filter type"**：过滤器名拼写错误，对照 [references/filters.md](references/filters.md) 白名单。
- **后端日志 panic "未知的站点客户端"**：`schema` 名不在白名单。
- **数值差 8 小时**：`timestamp` 后多叠了 `timezone +8`。
- **金币站魔力为 0**：确认 `gold/silver/copper` 字段选择器；后端折算 `bonus = gold*10000 + silver*100 + copper`。
