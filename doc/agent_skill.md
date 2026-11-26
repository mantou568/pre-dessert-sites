# AI 智能体站点适配技能（ms-site-adapt）安装与使用

本仓库内置了一个 **Agent Skill（智能体技能）**：`ms-site-adapt`。安装后，支持 [Agent Skills (SKILL.md)](https://agentskills.io) 规范的 AI 编码智能体（Claude Code、ZCode、爱马仕等）即可按标准流程**完整适配**一个 MS(MediaSaber) 站点：页面踩点 → 编写 `site_config/sites/{id}.json` → favicon → 双 lint 校验 → 后端实测 → 提交 PR。技能内置的校验脚本 `lint:configs` 已接入本仓库 CI，会拦截"未知过滤器名 / 未知 schema"等会让后端 panic 的错误。

技能内容（已逐项对照 MS 后端源码核对，与 `doc/site_adaptation.md` 的过时字段做了差异说明）：

```
.agents/skills/ms-site-adapt/
├── SKILL.md                     # 适配主流程（触发后智能体自动阅读）
├── references/
│   ├── schema.md                # 站点 JSON 顶层/请求定义/字段定义权威 schema + 占位符
│   ├── requests-and-fields.md   # 全部请求 ID 与每个请求的输出字段表
│   ├── filters.md               # 19 个过滤器语义、参数与陷阱
│   └── login-assist.md          # 登录辅助（验证码/两步验证）规则
└── scripts/
    └── lint_configs.mjs         # 配置校验脚本（npm run lint:configs，CI 共用）
```

## 安装

### 方式 A：克隆仓库使用（推荐，零安装）

```bash
git clone https://github.com/mantou568/pre-dessert-sites.git
cd pre-dessert-sites
# 在仓库根目录启动你的智能体（Claude Code / ZCode / 爱马仕 等）
```

智能体会自动发现 `.agents/skills/ms-site-adapt`，直接进入[使用](#使用)即可。

### 方式 B：安装到用户级技能目录（任意目录可用）

把整个 `ms-site-adapt` 目录复制到智能体的技能目录（**必须整目录复制**，references 与 scripts 需随行）：

| 智能体 | 用户级目录 |
|---|---|
| ZCode | `~/.zcode/skills/ms-site-adapt/` |
| Claude Code | `~/.claude/skills/ms-site-adapt/` |
| 其他遵循 Agent Skills 规范的智能体 | `~/.agents/skills/ms-site-adapt/` |

macOS / Linux：

```bash
git clone https://github.com/mantou568/pre-dessert-sites.git
mkdir -p ~/.agents/skills
cp -r pre-dessert-sites/.agents/skills/ms-site-adapt ~/.agents/skills/
```

Windows PowerShell：

```powershell
git clone https://github.com/mantou568/pre-dessert-sites.git
New-Item -ItemType Directory -Force "$env:USERPROFILE\.agents\skills" | Out-Null
Copy-Item -Recurse pre-dessert-sites\.agents\skills\ms-site-adapt "$env:USERPROFILE\.agents\skills\"
```

> 提示：技能里的校验脚本默认按"脚本位于本仓库内"定位仓库根；复制到用户级目录后在**目标配置仓库**内使用时，智能体仍可通过 `node <技能目录>/scripts/lint_configs.mjs --root <配置仓库根>` 完成校验。

## 前置条件

- **Node.js ≥ 18**（跑 `lint:selectors` / `lint:configs`）；
- 智能体具备浏览器操作能力时体验最佳（自动踩点登录页/搜索页/详情页）；没有也可以把关键页面 HTML 另存为文件交给智能体分析；
- 目标站点的**测试账号 Cookie**（适配 `user_basic_info`/`search` 并验证数值必需）；
- （可选）本地运行 MS 后端用于实测。

## 使用

在对话中自然描述需求即可触发，例如：

- 「帮我适配 xx 站点（https://example.pt），schema 是 NexusPHP，测试 cookie 在 cookie.txt」
- 「用 ms-site-adapt 给配置库新增 abc 站，只搜索和签到」
- 「修复 piggo 站搜索列表为空的问题」
- 「这个站的验证码是滑动的，配置一下 login_assist」

技能会引导智能体按 8 步执行：查重定名 → 浏览器踩点 → 编写站点 JSON → login_assist → favicon → `npm run lint:selectors` + `npm run lint:configs` → 后端实测（可选）→ 按仓库风格提交 PR。字段语义以技能 `references/` 为准（权威），`doc/site_adaptation.md` 作背景阅读。

## 校验与测试

- **双 lint**（适配必过）：

```bash
npm install
npm run lint:selectors   # login_assist 选择器语法（CI 强制）
npm run lint:configs     # 配置命名/schema/parser/过滤器白名单（CI 强制）
```

- **后端实测**（推荐）：
  1. dev 接管：环境变量 `MS_SITE_CONFIG_DEV_DIR` 指向本仓库根，后端直接读取本地 `site_config/`（该模式停用在线更新与手动上传）；
  2. 手动上传：打包 `site_config.tar.gz`（须含 `site_config/` 目录，≤64MB）在 MS 后台「站点配置」上传；
  3. 发版订阅：PR 合并后 CI 自动发布 Release，订阅方按 `main_`/`dev_` 前缀自动更新。

## 安全与合规

- 配置中**严禁出现任何用户数据**（Cookie、passkey、密钥、账号）；Cookie/UA 由后端从用户自己的站点数据附带。
- 本仓库 AGPL-3.0 + 非商业条款，适配配置提交即视为按同许可证贡献。
- 请遵守目标站点条款，控制请求频率，不要对站点造成压力。

## FAQ

- **技能没有被触发？** 在消息里显式点名："用 ms-site-adapt 适配…"，或使用智能体的技能调用命令（如 `/skill ms-site-adapt` / `/ms-site-adapt`）。
- **lint 报"未知过滤器/schema"？** 以技能 `references/filters.md`、`schema.md` 的白名单为准修正，这类错误会让后端 panic。
- **想人工适配？** 完全可以不装技能，直接读 [site_adaptation.md](site_adaptation.md) 与 [login_assist.md](login_assist.md)；技能只是把同一套规则整理成了智能体可执行的流程。
