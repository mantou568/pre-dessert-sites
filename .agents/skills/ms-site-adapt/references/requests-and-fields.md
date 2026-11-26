# 请求定义（request ID）与输出字段（后端权威版）

> 依据：`internal/modules/btsite/constants.go`、各 `*_client.go`、`internal/modules/btsite/types.go`（mapstructure 标签即配置 `fields` 的键）。
> 字段解码使用 mapstructure，**键名匹配不区分大小写**，但请统一用下表的标准小写写法。

## 1. 请求 ID 全表

### 通用请求键（constants.go，所有架构客户端共用）

| 请求键 | 用途 | 站点不支持时 |
|---|---|---|
| `favicon` | 站点图标（通常直接继承 commons，无需适配） | 可 `{"disabled": true}` |
| `user_basic_info` | 用户基础信息（登录态/上传/下载/魔力） | —核心，必配或可继承 |
| `user_details` | 用户详情（等级/注册时间） | 可禁用 |
| `search` | 搜索种子列表 | —核心 |
| `seeding_statistics` | 做种统计（有 `list` 走分页汇总，无 `list` 直接解析 `count`/`size` 字段） | 可禁用 |
| `seeding_count` / `seeding_size` | 做种数/体积单值接口（与 seeding_statistics 二选一优先） | 可禁用 |
| `my_hr` | HR 考核列表 | 可禁用 |
| `messages` | 消息列表 | 可禁用 |
| `message_detail` | 消息详情（按消息链接查询） | 可禁用 |
| `notice` | 公告 | 可禁用 |
| `sign_in` | 签到（`required.sign_in: true` 时才执行） | 无签到站点禁用或 required.sign_in=false |
| `details` | 种子详情（免费/HR 标志等） | 可禁用 |
| `get_subtitle_url` | 字幕下载链接（输出 `url`） | 可禁用 |
| `download_link` | 下载链接签发：下载地址需单独请求换取的站点使用（输出 `url`）；未配置时直接用搜索结果的 `download` | 按需 |
| `get_rss` | 生成 RSS 链接（输出 `content`） | 可禁用 |
| `rss` | RSS 拉取解析 | 可禁用 |
| `token_refresh` | 用 Cookie 换新访问令牌（输出 `content`） | 按需 |
| `shoutbox` | 群聊发消息（`meta.shoutbox: true` 时可用） | 可禁用 |
| `user_profile` | **不是请求键而是 tags**：`"tags": ["user_profile"]` 的请求会被批量预取并缓存 300s | — |

### 各架构客户端专用请求键

| 请求键 | 客户端/架构 |
|---|---|
| `sign_in_page` / `image` / `sign_in_action` | attendance_captcha（NexusPHP attendance.php 验证码签到）、pt52pt、opencd |
| `sign_in_submit` / `sign_in_image_code` / `sign_in_showup` | NexusPHP 特殊签到流程 |
| `u2_sign_in_page` / `u2_sign_in_submit` | u2 |
| `ttg_sign_in_start_page` / `ttg_sign_in_submit` | ttg |
| `chdbits_sign_in_page` / `chdbits_sign_in_submit` | chdbits |
| `mark_as_read` | 消息已读（输出 `success`/`message`） |
| `profile` / `my_peer_statistics` / `sys_role_list` / `gen_dl_token` | mTorrent（API 型） |

### 历史遗留键（后端当前不消费，不要新增）

`my_bonus`、`infos`、`get_security_info`、`get_genshin_character`、`download_file`

未知请求键运行时被忽略（lint 会警告）。**新增请求键必须先有后端代码支持**。

## 2. 各请求的输出字段（配置 `fields` 的合法键）

### search（SearchTorrent）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 种子 id（建议从 `download`/`details` 链接提取） |
| `category` | string | 分类原文（后端比对 `category.*` 得出 media_type） |
| `title` | string | 标题（`any` 多候选时把更可能的放前面） |
| `description` | string | 副标题/描述 |
| `details` | string | 详情页相对地址（自动拼域名） |
| `download` | string | 下载相对地址或 `magnet:`（自动拼域名/原样保留） |
| `size` | int | 字节数（`byte_size` 过滤） |
| `grabs` / `seeders` / `leechers` | int | 完成/做种/下载数 |
| `downloadvolumefactor` / `uploadvolumefactor` | float | 下载/上传系数（Free→0 等） |
| `date_added` | int | 发布时间 unix 秒（`timestamp` 过滤） |
| `hr_days` | int | HR 天数 |
| `labels` | string | 标签，多个用 `\|` 分隔（后端切开） |
| `imdb_id` / `douban_id` | string | 观影 id（注意不是 `imdbid`） |
| `cover` | string | 封面地址 |
| `media_type` | string | 一般不用手填（由 category 推导） |
| `link_type` | int | 非 0 表示网盘分享链接 |
| `date_elapsed` | string | 兼容保留，**当前后端不消费**，可不配 |

### user_basic_info（UserBasicInfo）

`is_login`（bool，核心登录判定）、`signed_in`（bool）、`id`（用户 id，供 `{userId}` 占位）、`name`、`ratio`、`uploaded`、`downloaded`（字节）、`bonus`（魔力）。
辅助键 `gold` / `silver` / `copper`：金币类站点用，后端折算 `bonus = gold*10000 + silver*100 + copper`；`ratio` 为 0 时后端会用 uploaded/downloaded 自动计算。

### user_details（UserDetails）

`level`、`level_icon`、`join_at`（时间戳）、`last_accessed`（时间戳）。

### seeding_statistics（SeedingStatistics）

`count`（数量）、`size`（字节）。
两种模式：
- **无 `list`**：`fields.count` / `fields.size` 直接从页面文本解析（如 "做种记录: N / 总大小: X"，`re_search` 提取）；
- **有 `list`**：`list.selector` 逐行解析，后端分页累加行数与每行 `size`（继承 commons 的 NexusPHP 标准做法，每行只需 `size` 字段）。

### details（TorrentDetail）

`absent`（bool 种子已删）、`free`（bool）、`2x_free`（bool）、**`hr_days`**（int，HR 天数；文档旧写法 `hr` 不被消费）、`peer_count`（int）、`enclosure`（特殊站点下载链接，内部禁用）。

### messages（Message）

`id`、`title`、`date`（时间戳）、`content`、`link`（详情相对地址）。

### message_detail / notice（title/date/content）

npClient 的 notice 内部仅消费 `content`；`title`/`date` 建议仍配置（自定义客户端可能用）。

### sign_in（signInResult）

`signed_in`（bool）。另注意：签到接口返回 404 时后端视为"站点未启用签到"不报错；`required.sign_in: false` 时只做模拟登录。

### my_hr（HrTorrent，字段均为 string）

`id`、`name`、`uploaded`、`downloaded`、`share_ratio`、**`download_time`**（不是 downloaded_time）、`need_seed_time`、`remaining_inspection_time`。

### rss（RssTorrent）

`id`、`title`、`description`、`link`（详情页）、`enclosure`（下载链接）、`size`（字节）、`pub_date`（时间戳）、`imdb_id`、`douban_id`。
**parser 用 `Xml`**（精确大小写，`XML` 非法）。

### get_subtitle_url / download_link（输出 `url`）

缺 `url` 时后端报"未获取到下载链接"。

### get_rss / token_refresh（输出 `content`）

## 3. 适配建议（新站点最小集）

1. NexusPHP 站点：`search` + `user_basic_info` 通常继承 commons 即可用，仅需按站点实际 HTML 校验并微调；确认不支持的功能一律显式 `{"disabled": true}`（保持配置自文档化）。
2. JSON API 站点（piggo/mTorrent/rousi 风格）：整套重写 `requests`，用 `disabled_extends` 全量切断继承，`required_headers` 声明 `Authorization` / `X-API-Key` 等。
3. 参考同类站点：`grep -l "\"schema\": \"NexusPHP\"" site_config/sites/` 找同架构样本；JSON API 参考 `piggo.json`、`kele.json`、`mteam.json`。
4. 输出字段宁缺勿滥：后端对缺失字段静默跳过；多余字段名不报错但也不生效（lint 会警告已知过时名）。
