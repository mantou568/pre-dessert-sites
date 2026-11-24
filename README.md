# Pre-Dessert Sites 站点配置库

这是一个开源的站点适配配置文件仓库。大家群策群力，欢迎提交 Pull Requests，推动站点配置更新，人人为我，我为人人。

## 📁 项目结构

```
pre-dessert-sites/
├── site_config/                  # 站点配置文件
│   ├── commons/                  # 公共配置
│   └── sites/                    # 单个站点配置
├── site_favicon/                 # 站点图标（128×128 PNG 格式）
│   └── *.png                     # 各站点的 favicon 图标
├── tools/                        # 辅助工具脚本
```

## 📖 使用说明

本配置文件可与相关媒体管理工具配合使用，实现自动站点适配和数据获取。在 Media Saber 等程序的「站点配置订阅」中填入本仓库任一 GitHub 链接（仓库主页 / Release 页 / archive 下载链接均可），程序会自动提取仓库并订阅更新。

## 📦 站点配置更新包标准（适配指南）

本仓库通过 GitHub Release 滚动发布 `site_config.tar.gz` 更新包。**任何按本标准组织发布的 GitHub 仓库，都可以被 Media Saber 等程序订阅**，实现站点配置自动更新。第三方维护者按下述标准组织仓库即可接入。

### 发布机制

- **触发**：`site_config/` 或 `site_favicon/` 内容变更后由 CI 自动打包发布（也支持手动触发）
- **版本号（tag 命名）**：`main_YYYYMMDDHHMMSS`（稳定版，main 分支）/ `dev_YYYYMMDDHHMMSS`（开发版，dev 分支），时间为东八区。程序按自身构建通道选择 `main_` 或 `dev_` 前缀的最新 Release，前缀缺失将无法被识别
- **滚动发布**：每个渠道仅保留最新一个 Release，旧 Release 随新版发布自动删除（如需保留历史版本可自行调整 CI）
- **Release 资产**：
  - `site_config.tar.gz` —— 更新包本体，**命名必须固定**，程序按此名查找
  - `site_config.tar.gz.sha256` —— 校验和（可选）

### 包内结构（必须符合）

`site_config.tar.gz` 解压后的标准结构：

```
├── site_config/          # 【必需】站点配置目录
│   ├── commons/          # 公共框架配置（如 NexusPHP.json）
│   └── sites/            # 单站点配置（{id}.json）
├── site_favicon/         # 【可选】站点图标（{id}.png，128×128）
└── manifest.json         # 【推荐】包版本自描述
```

- `site_config/` 与 `site_favicon/` 允许在解压目录中存在多级嵌套（程序按目录名递归定位），但目录名与内部结构（`commons/`、`sites/`）不可更改
- `manifest.json` 放在 tar 包根下，字段如下；程序读取它识别包的真实版本（含离线手动上传场景），缺失时程序会降级处理，不影响更新：

```json
{
  "version": "main_20260510120000",   // 与 Release tag 一致
  "channel": "main",                  // main / dev
  "buildTime": "2026-05-10T12:00:00+08:00",
  "gitSha": "0a34ebd...",             // 构建时的 commit
  "siteCount": 195                    // 站点配置数量
}
```

### 订阅方（程序）读取行为

以 Media Saber 为例：

1. 用户在「站点配置订阅」中填写订阅源地址（任意 GitHub 链接，程序自动提取 `owner/repo`）；
2. 程序拉取 Release 列表，按自身通道（稳定/开发）匹配 `main_` / `dev_` 前缀的最新 Release；
3. 下载资产 `site_config.tar.gz`，解压后按目录名定位 `site_config` / `site_favicon`，整体替换本地对应目录；
4. 读取 `manifest.json`（如存在）记录版本号，用于「当前版本 / 最新版本」比对；
5. 境外访问受限的环境可由用户配置代理与 GitHub Token。

### 对第三方配置库的要求

- **免责声明**：配置库属用户自行订阅的第三方来源，程序不内置、不审核配置内容；库维护者应在仓库 README 附带免责声明（可参考本仓库下文 ⚖️ 章节）
- **许可证**：请自行选择并声明仓库许可证

### 站点 `login_assist` 字段（浏览器登录辅助，可选）

站点 JSON 顶层的可选块，供浏览器扩展（Media Saber Tools 等）在站点登录页自动识别/填充验证码与两步验证码。**不配置该块的站点完全不受影响**（消费方走内置默认规则）。

```jsonc
"login_assist": {
  "login_paths": ["/login.php", "/takeotp.php"],        // 登录/两步验证步骤页路径子串（用于注入判定）
  "captcha": {                                           // 图片验证码（图片与输入框必须成对配置，只配一侧无效）
    "image_selectors": ["img[alt='CAPTCHA']", "img[src*='image.php']"],
    "input_selectors": ["input[name='txt_code']"]
  },
  "two_factor": {                                        // 两步验证
    "input_selectors": ["input[name='otp']"],            // 常规单输入框（先尝试）
    "segmented": {                                       // 分离式输入（可选，单框未命中时走此路径）
      "container_selector": ".input-wrap",
      "digit_selector": ".input-content .input-item",    // 分位显示元素（逐位填充）
      "hidden_input_selector": ".input-wrap input.visible"
    }
  }
}
```

**继承规则**：站点配置了 `login_assist` 时，`captcha` / `two_factor` **子块整体覆盖** `commons/NexusPHP.json` 的对应默认（不与默认做数组合并）；未配置的子块继承 commons 默认；站点与 commons 均未配置时由消费方内置规则兜底。

**贡献约束**：

1. 选择器必须是标准 CSS selector（`querySelector` 语义），每子项建议 ≤4 条，首条放最精确的
2. `captcha` 图片与输入框选择器**必须成对配置**，只配一侧会在加载期被丢弃（CI 会警告）
3. `login_paths` 填写页面 URL 的路径子串（含两步验证步骤页，如 `/takeotp.php`）；不要写 `takelogin.php` 等 POST 落地页
4. **本配置仅含页面结构选择器，严禁包含任何用户数据**（密钥、Cookie、账号等）
5. 提交前本地自检：`npm install && npm run lint:selectors`（CI 发版前会强制拦截语法错误）

**版本兼容矩阵**：消费 `login_assist` 需 Media Saber 后端 ≥ 2026-11 包含 `/site/loginAssist` 端点的版本 + Media Saber Tools 扩展 ≥ 同期版本；旧版本组合自动降级为内置默认规则（行为等同未配置）。

## ⚡ 反馈与交流

- **提交问题**：在 [Issues](https://github.com/mantou568/pre-dessert-sites/issues) 中报告问题或申请新站点
- **贡献代码**：提交 Pull Request 改进站点配置

## 📋 贡献指南

欢迎提交以下类型的贡献：
- 新站点适配配置
- 现有站点配置更新和改进
- 站点图标和素材
- Bug 修复
- 文档完善

### 规范性说明

- 命名统一使用 `snake_case`（小写字母、数字、下划线），不要使用驼峰命名或连字符。
- 站点配置文件需满足三者一致：
   - `site_config/sites/{id}.json` 文件名（不含扩展名）
   - JSON 顶层字段 `id`
   - `site_favicon/{id}.png` 图标名（不含扩展名）
- 历史兼容站点（如 `bt_` 前缀）可保留前缀，但仍需满足“文件名 = id = 图标名”。
- `site_config/commons/NexusPHP.json` 为公共框架配置，属于特例，不按站点命名规则修改。

请参考 [Issue 模板](https://github.com/mantou568/pre-dessert-sites/issues/new/choose) 提交规范化的问题报告。

## 📜 许可证

本项目采用 **AGPL-3.0 WITH NON-COMMERCIAL CLAUSE** 许可证，详见 [LICENSE](LICENSE) 文件。

## ⚖️ 免责声明

### 使用风险

1. **本仓库仅供学习参考**，不对站点配置的准确性、完整性和可用性做任何保证。

2. **用户自行承担风险**：
   - 使用本配置文件产生的任何后果（包括但不限于数据丢失、账号被封等）由用户本人承担
   - 开发者不承担因配置失效、站点更新等原因造成的任何损失

3. **版权和法律责任**：
   - 本仓库配置均来自网友贡献和社区协作，开发者不提供原始资源和信息
   - 用户需自行确保使用过程中遵守相关法律法规和网站服务条款
   - 任何侵权行为由使用者本人承担全部法律责任

4. **内容更新**：
   - 站点配置可能因网站更新而失效，开发者不保证实时更新
   - 本项目仅提供配置参考，具体使用效果取决于站点本身情况

5. **第三方服务**：
   - 本项目配置的任何第三方站点或服务与开发者无关
   - 使用过程中的任何问题，应直接联系相关站点提供者
