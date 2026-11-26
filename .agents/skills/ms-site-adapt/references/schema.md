# MS 站点配置 Schema（后端权威版）

> 本文内容已逐项对照 media-saber 后端源码核对（`internal/modules/btsite/core/config.go`、`parser/parser.go`、`filter/filter.go`、`client.go`、`types.go`）。
> 与 `doc/site_adaptation.md` 冲突时，**以本文为准**（差异清单见文末）。

## 1. 目录结构与加载链

```
site_config/
├── commons/            # 架构公共配置，文件名 = 架构 id（如 NexusPHP.json）
│   └── NexusPHP.json   # 绝大多数 PT 站的继承来源
└── sites/              # 单站点配置，文件名必须 = 顶层 id（snake_case）
    └── {id}.json
```

后端启动时 `InitConfig` 先加载 `commons/*.json`（以顶层 `id` 为键注册），再加载 `sites/*.json`。**任何一个文件 JSON 非法都会导致整批配置加载失败**，所以配置必须是严格 JSON：无注释、无尾逗号。

## 2. 站点配置顶层字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 站点唯一标识，**必须与文件名一致**，snake_case；后端按它匹配站点 `code` |
| `name` | string | 站点显示名 |
| `domain` | string | 站点域名，必须 `http(s)://` 开头；相对路径请求基于它拼接 |
| `additional_domain` | string[] | 备用域名（当前业务基本不用） |
| `api` | string | API 基地址；请求定义 `use_api: true` 时改用它拼接 |
| `requests` | object | 请求定义映射，键为请求 ID（见 [requests-and-fields.md](requests-and-fields.md)）。**缺失/未定义的请求键会从架构公共配置整份复制**——纯继承站点可以完全不写 `requests` |
| `torrent_id_filters` | array | 从粘贴的详情页 URL 提取种子 id 的过滤器链。**注意：站点级值在架构继承时会被公共配置无条件整体覆盖**，一般不需要写 |
| `public` | bool | 是否公开站点 |
| `schema` | string | 架构名，决定客户端类型。**未知值会让后端 panic**；缺省按 `NexusPHP`。可选值见下 |
| `reuse_schema` | string | `schema` 无公共配置时的回退继承架构 |
| `required` | object | `{ "user_id": bool, "sign_in": bool, "cookie": bool }`，提示用户需要准备的凭据/动作 |
| `category` | object | 分类映射，键仅 `movie / tv / 9kg / music / query / Single`（注意 `Single` 首字母大写，bool）。每项分类 `{ "id", "cat", "desc", "default" }`。其余键后端不消费 |
| `search_box` | object | `{ "fields": [ { "title", "name", "type", "options" } ] }`，搜索框附加复选项，搜索时值以 `<name>=1` 追加 |
| `meta` | object | `{ "has_free", "has_2x_free", "has_hr", "has_cover", "shoutbox" }`（bool） |
| `custom_config` | object | string→string 自定义配置 |
| `first_page_offset` | int | 搜索页码偏移：后端 `PageNum += first_page_offset`（如 API 首页为第 0/2 页时修正） |
| `login_assist` | object | 登录辅助（可选），见 [login-assist.md](login-assist.md) |

**schema 可选值**（后端 `client.go` 注册表，未知即 panic）：
`NexusPHP`、`mTorrent`、`zhuQue`、`rousi`、`bt`、`telegram`、`gying`、`hdsky`、`chdbits`、`ttg`、`pt52pt`、`u2`、`opencd`、`nullbr`、`attendance_captcha`。

`attendance_captcha` 是 NexusPHP `attendance.php` 验证码签到的变体客户端，其专用请求键为 `sign_in_page` / `image` / `sign_in_action`。

## 3. 继承规则（InitConfig 实际行为）

1. 站点的 `schema`（缺失时 `reuse_schema`）在 commons 中找到对应配置后：
   - `torrent_id_filters`：**无条件用架构值覆盖站点值**；
   - `requests`：架构有而站点没有的请求键 → **整份复制**；两边都有的键 → 按 `extend()` 逐字段补空（站点值优先）；
   - `login_assist`：子块级合并（见 [login-assist.md](login-assist.md)）。
2. `extend()` 补空的字段：`parser / method / path / list / headers / required_headers / params / form_data / body / success_status_codes / fields`；站点可用 `disabled_extends` 逐项拒绝继承。
3. `fields` 的合并：架构字段在前、站点字段在后，同名字段站点覆盖。

**适配策略结论**：NexusPHP 站点先只写「与 commons 的差异」，用浏览器实际请求验证每个字段的选择器后，再决定是否 `disabled_extends`。

## 4. 请求定义（RequestDefinition）字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `parser` | string | `CssSelector` / `XPath` / `Xml` / `JsonPath` / `None`，**精确大小写**（`XML`、`xpath` 均非法，运行时报"不支持的解析器类型"） |
| `method` | string | GET / POST 等 |
| `path` | string | 相对路径（拼 `domain`，`use_api` 时拼 `api`）；`http(s)://` 开头的绝对地址原样使用 |
| `use_api` | bool | 是否使用 `api` 地址 |
| `chrome` | bool | **已废弃**：后端从不读取，写了也没用 |
| `headers` | object | 请求头，值支持占位符 |
| `required_headers` | string[] | 声明用户必须在"站点维护→自定义请求头"里补充的头（如 `Authorization`）；缺失时后端会报错提示 |
| `params` | object | URL 查询参数，**值为字符串数组**（url.Values 语义）：`{ "search": ["{keyword}"] }` |
| `form_data` | object | 表单数据，同上（字符串数组） |
| `body` | any | 请求体，任意 JSON |
| `success_status_codes` | int[] | 额外视为成功的状态码（默认非 2xx 即失败） |
| `list` | object | `{ "selector": 列表项选择器, "next_page": Field }`；`next_page` 解析整篇文档，结果必须是纯字符串 |
| `fields` | object | 字段定义（有序 map，输出顺序保持书写顺序），键为输出字段名（见 [requests-and-fields.md](requests-and-fields.md)） |
| `flat_map_fields` | object | `{ "selector", "fields" }`，JSON API 一条记录拆多行（子行缺失的字段回填外层值） |
| `disabled_extends` | object | 拒绝继承的键：`path / headers / required_headers / params / form_data / body / success_status_codes / list / fields / field`（bool） |
| `tags` | string[] | 请求标签；`user_profile` 标签的请求会被批量预取并缓存 300s，供 `user_profile_holder` 过滤器引用 |
| `disabled` | bool | `true` 时该请求直接返回空成功响应（禁用不支持的请求用 `{"disabled": true}`） |

## 5. 字段定义（Field）

| 字段 | 类型 | 说明 |
|---|---|---|
| `selector` | string | 选择器表达式；**JsonPath 可省略，缺省用字段名**（gjson 语法） |
| `selection` | string | 仅 `html` 有特殊语义（取 innerHTML），其余任何值都取纯文本 |
| `attribute` | string | CSS 选择器时取该属性值（如 `href`、`src`） |
| `filters` | array | 过滤器链 `[{ "name", "args" }]`，顺序执行，见 [filters.md](filters.md) |
| `parent` | bool | 选择父元素 |
| `remove` | string | 解析前从克隆节点移除的子元素，CSS 选择器，多个用英文逗号分隔 |
| `any` | Field[] | 依序尝试，取第一个非空候选（外层 filters 会复制进每个子项） |
| `array` | bool | 收集全部匹配为字符串数组 |
| `fields` | object | 嵌套字段 |
| `list` | object | 嵌套列表 |
| `trim_chars` | bool | 额外修剪 `\n \r \t " ("` 等特殊字符 |

文本处理流水线：`remove` → `parent` → `attribute` 或 `selection:"html"` 或 `.Text()` → TrimSpace →（`trim_chars`）→ 过滤器链 → TrimSpace。**最终为空的字段不会出现在输出里**；选择器未命中时过滤器仍会执行（可用 `constant` 给默认值）。

## 6. 占位符（配置里可用，后端请求期替换）

| 占位符 | 注入点 | 说明 |
|---|---|---|
| `{userId}` | 全部 | 用户 id（`user_basic_info.id` 解析结果或用户手填） |
| `{domain}` | 全部 | 站点 domain |
| `{api}` | 全部 | 站点 api 地址 |
| `{keyword}` | search | 搜索关键词 |
| `{page}` | search | 页码（已含 `first_page_offset` 修正） |
| `{id}` | details / download / get_subtitle_url / download_link | 种子 id |
| `{shbox_text}` | shoutbox | 群聊消息文本 |
| `{<key>}` | 任意 | `user_profile_holder` 过滤器场景：从 `tags:["user_profile"]` 请求的缓存结果里展开 |

出现在 path / headers / params / form_data / body 中均可替换。

**凭据规则**：Cookie 和 User-Agent 由后端从用户站点数据自动附带，**配置里严禁出现任何真实凭据**。

## 7. 搜索行为（npClient 约定）

- 关键词非空时自动追加 `search_mode=0`、`notnewword=1`（NexusPHP 习惯）；
- 分类：`category.Single` 为 `false` 时，按 `category.movie/tv/9kg/music` 的 `id` 追加参数，通用形式为 `categories.query=<id>`，兜底 `cat<id>=1`；`Single: true` 表示站点分类只能单选；
- `search_box.fields` 勾选项以 `<name>=1` 追加；
- 结果的 `details` / `download` / `cover` 若是相对地址会自动拼上响应域名；`http(s)://` 或 `magnet:` 开头原样保留；`labels` 按 `|` 切分为数组；`media_type` 由 `category` 与分类表比对得出。

## 8. 与 doc/site_adaptation.md 的已知差异（以本文为准）

| 文档说法 | 后端实际 |
|---|---|
| 顶层 `price`（has_free…） | 实际键为 **`meta`**，且多 `has_cover`、`shoutbox` |
| `common_fields` 公共字段定义 | **已删除，不支持** |
| `fields_ref` 字段引用 | **已注释，不支持** |
| 请求键 `download_file` | 实际为 `download_link`（另有 `get_subtitle_url`、`token_refresh` 等，见 requests 文档） |
| `params/form_data` 值为字符串 | 实际为**字符串数组**（url.Values） |
| `selection: text` | `text` 无特殊语义，仅 `html` 特判 |
| `chrome` 使用 chrome | 字段存在但后端从不读取（无效） |
| details 字段 `hr` | 实际消费 **`hr_days`**（int） |
| search 字段 `imdbid` | 实际消费 **`imdb_id`**（另有 `douban_id`、`cover`、`media_type`、`link_type`） |
| my_hr 字段 `downloaded_time` | 实际消费 **`download_time`** |
| 过滤器仅 16 种 | 实际 19 种，另有 `append_field_right`、`pad_zero`、`user_profile_holder` |
| —— | 文档未提：占位符机制、`flat_map_fields`、`tags:["user_profile"]`、`first_page_offset`、`search_box` |

## 9. 后端不消费但现存于旧配置的键（可删；lint 会提示）

- 顶层：`encoding`、`count_message`、`my_hr`（顶层误置）、`sign_in_required`、`cookie`、`timezone`、`required_headers`、`id_cookie_name`
- `category` 扩展键（`game/app/book/edu/fanres/xxx/other/single` 等，注意 `single` 小写无效，正确键是 `Single`）
- `meta` 扩展键（`auth_type`、`api_host` 等）

这些键后端 JSON 解码时静默忽略，不影响运行；新适配**不要模仿**。
