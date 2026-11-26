# 过滤器（filter）全表（后端权威版）

> 依据：`internal/modules/btsite/filter/filter.go` 注册表（19 个）。
> **红线：过滤器名拼写错误会让后端 panic**（`panic("unknown filter type: ...")`），写完必须跑 `npm run lint:configs`。过滤器链顺序执行，前一级输出作为后一级输入；选择器未命中时过滤器仍会在空串上执行（`constant` 可用于给默认值）。

## 过滤器速查

| 名称 | 作用 | args 形式 |
|---|---|---|
| `re_search` | 正则搜索文本，取指定捕获组 | `[正则, 组序号]`（组号从 1 起） |
| `regex` | 正则整体匹配判断 | 无 → 转 bool；`[正则, 真文本, 假文本]` |
| `split` | 按分隔符切割取第 n 段 | `[分隔符, n]`（`-1` 为最后一段） |
| `replace` | 字符串替换 | `[被替换串, 新串]`（旧文档的三参形式已不被支持） |
| `strip` | 去两端空白 | 无 |
| `append_left` / `append_right` | 左/右拼接字符串 | `"str"` |
| `append_field_right` | 右拼接**另一个已解析字段**的值 | `"字段名"`（数组值会空格连接） |
| `querystring` | 在 URL/查询串中定位指定键，截取其值起始部分 | `"键名"` |
| `byte_size` | 体积文本 → 字节数 | 无 |
| `timestamp` | 时间文本 → unix 秒级时间戳 | 无，或 `[格式1, 格式2…]`（Go 布局 `2006-01-02 15:04:05`） |
| `timezone` | 对**已是时间戳**的值做时区偏移修正 | 无（默认 +8）或 `["+8"]` / `["-5"]` |
| `eq` | 相等判断 | 无 → bool；`[目标串, 真文本, 假文本]` |
| `case` | switch-case 映射 | `{ "k1": "v1", "*": "默认值" }` |
| `blank` / `not_blank` | 空/非空判断 | 无 → bool；`"真文本"`；`[真文本, 假文本]` |
| `constant` | 固定值（选择器未命中时的默认值机制） | 任意 string/number/bool |
| `pad_zero` | 数字左侧补零到指定位宽 | 数字（如 `6`） |
| `user_profile_holder` | 用 `tags:["user_profile"]` 缓存结果展开 `{key}` 占位 | 无 |

## 高频陷阱

1. **`timestamp` 与 `timezone` 不要叠加**：`timestamp` 对无时区本地时间已按 **Asia/Shanghai** 解析；页面时间就是北京时间时只写 `timestamp`，再叠 `timezone +8` 会二次偏移。`timezone` 只用于"页面时间是其他时区"的场景，修正量 = `8 - 页面时区偏移`（如页面 UTC+7 → `[" +1"]`）。
   - `timestamp` 对纯数字透传（10 位按秒、13 位按毫秒）；带 `Z`/偏移的 ISO 时间按字面时区解析。
2. **`re_search` 组号从 1 开始**：`["上传量: (.*)", 1]`；正则用 Go 语法（`\d` 无需双反斜杠——JSON 里写 `\\d`）。
3. **`case` 的 `*` 是缺省分支**；键匹配基于过滤前的文本。
4. **`constant` 是"默认值"机制**：选择器必然未命中 + `constant` 输出固定值，如固定 `downloadvolumefactor: 1`。
5. **`replace` 仅支持两参** `[旧, 新]`；args 形状不符时静默返回原文（不报错）。
5. **`byte_size`** 输入应为类似 `1.5 TB`、`800 MiB` 的体积文本；先用 `re_search` 抠出体积子串再转换。
6. 未知过滤器名 = 后端 panic；`count`、`len`、`int` 等名字**不存在**——"统计匹配行数"没有对应过滤器，应改用页面文本 `re_search` 或继承 commons 的分页 list 方案。

## 典型组合

```json
// 上传量: 1.2 TB → 字节
[
  { "name": "re_search", "args": ["上传量: (.*)", 1] },
  { "name": "byte_size" }
]

// 2024-12-31 23:59:59（北京时间页面）→ 时间戳
[{ "name": "timestamp", "args": ["2006-01-02 15:04:05"] }]

// 免费标志图片命中 → "0"，否则缺省 "1"
[
  { "name": "eq", "args": ["free", "0", "1"] }
]

// 相对链接补全（详情页）
[
  { "name": "re_search", "args": ["details.php\\?id=(\\d+)", 1] },
  { "name": "append_left", "args": "/details.php?id=" }
]
```
