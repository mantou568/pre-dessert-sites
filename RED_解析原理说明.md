# RED.json Search 配置解析原理

## 1. 整体流程

```
API 响应 JSON
    ↓
JsonPath 解析器
    ↓
列表选择器 (list.selector) → 展开嵌套数组
    ↓
字段选择器 (fields.*.selector) → 在每个列表项上下文中提取数据
    ↓
过滤器 (filters) → 数据转换
    ↓
最终结果
```

## 2. 配置结构分析

### 2.1 列表选择器 (List Selector)

```json
"list": {
  "selector": "response.results[*].torrents[*]"
}
```

**工作原理：**
1. `response.results[*]` - 遍历所有 results 数组中的元素（每个元素是一个 group）
2. `.torrents[*]` - 对每个 group，遍历其 torrents 数组中的所有元素
3. 最终展开为：`[torrent1, torrent2, torrent3, ...]`

**示例：**
```json
{
  "response": {
    "results": [
      {
        "groupId": 1200643,
        "groupName": "Voodoo Chile",
        "torrents": [
          { "torrentId": 2573527, "format": "FLAC", ... },
          { "torrentId": 5980301, "format": "MP3", ... }
        ]
      }
    ]
  }
}
```

经过列表选择器后，会得到：
```json
[
  { "torrentId": 2573527, "format": "FLAC", ... },
  { "torrentId": 5980301, "format": "MP3", ... }
]
```

### 2.2 字段选择器 (Field Selectors)

字段选择器在每个列表项（torrent 对象）的上下文中执行。

#### 2.2.1 直接字段访问

```json
"id": {
  "selector": "torrentId"
}
```

**上下文：** 当前 torrent 对象
```json
{ "torrentId": 2573527, "format": "FLAC", ... }
```

**结果：** `2573527`

#### 2.2.2 父级数据访问（问题所在）

```json
"title": {
  "selector": "response.results[0].groupName"
}
```

**问题：** 
- 字段选择器的上下文是 torrent 对象，不是根 JSON
- `response.results[0]` 无法从 torrent 对象访问
- 这会导致解析失败

**正确的做法应该是：**
Media-Saber 可能支持在字段选择器中使用 `$` 访问根对象，或者需要其他特殊语法。

## 3. 过滤器 (Filters) 工作原理

### 3.1 append_left 过滤器

```json
"description": {
  "selector": "format",
  "filters": [
    { "name": "append_left", "args": " / " },
    { "name": "append_left", "args": "encoding" }
  ]
}
```

**执行流程：**
1. 获取 `format` 值：`"FLAC"`
2. 第一次 `append_left(" / ")`：`"FLAC" + " / "` = `"FLAC / "`
3. 第二次 `append_left("encoding")`：`"FLAC / " + "encoding"` = `"FLAC / encoding"`

**注意：** 这里有个问题，`encoding` 是另一个字段，不是字符串。应该先获取 encoding 的值，然后拼接。

### 3.2 timestamp 过滤器

```json
"date_added": {
  "selector": "time",
  "filters": [
    { "name": "timestamp" }
  ]
}
```

**执行流程：**
1. 获取 `time` 值：`"2019-11-20 17:43:16"`
2. `timestamp` 过滤器将日期字符串转换为 Unix 时间戳：`1574266996`

## 4. 当前配置的问题

### 4.1 父级数据访问失败

```json
"title": {
  "selector": "response.results[0].groupName"  // ❌ 无法访问
}
```

**原因：** 字段选择器的上下文是 torrent 对象，无法访问根对象的 `response.results[0]`

### 4.2 description 字段拼接错误

```json
"description": {
  "selector": "format",
  "filters": [
    { "name": "append_left", "args": " / " },
    { "name": "append_left", "args": "encoding" }  // ❌ encoding 是字段名，不是值
  ]
}
```

**问题：** `append_left` 只能拼接字符串，不能访问其他字段的值

## 5. 可能的解决方案

### 方案 1：使用绝对路径（如果支持）

```json
"title": {
  "selector": "$.response.results[?(@.torrents[*].torrentId == @.torrentId)].groupName"
}
```

这需要 JsonPath 支持在字段选择器中使用 `$` 访问根对象，并且支持复杂的 filter 表达式。

### 方案 2：使用相对路径（如果支持）

如果 Media-Saber 支持在字段选择器中使用相对路径访问父级：

```json
"title": {
  "selector": "../groupName"  // 假设支持相对路径
}
```

### 方案 3：改变列表选择器策略

不使用嵌套展开，而是选择 results，然后在字段中处理：

```json
"list": {
  "selector": "response.results[*]"
},
"fields": {
  "torrents": {
    "selector": "torrents[*]",
    "array": true
  }
}
```

但这不符合 Media-Saber 的预期结构（每个列表项应该是一个种子）。

### 方案 4：检查 Media-Saber 是否支持特殊语法

可能需要查看 Media-Saber 的源代码或文档，了解它如何处理嵌套数组和父级数据访问。

## 6. 建议的测试步骤

1. **测试基本字段**：先测试 `id`, `size`, `seeders` 等直接字段是否能解析
2. **测试列表选择器**：确认 `response.results[*].torrents[*]` 是否能正确展开
3. **测试父级访问**：尝试不同的语法访问父级数据
4. **查看日志**：如果 Media-Saber 有调试模式，查看详细的解析日志

## 7. 参考：其他站点的实现

查看 `zhuque.json` 和 `mteam.json` 等站点，它们使用 JsonPath 时：
- 列表选择器通常是简单的路径：`data.torrents` 或 `data.data`
- 字段选择器都是相对路径，不访问父级数据
- 没有嵌套数组展开的情况

这说明 Media-Saber 的 JsonPath 实现可能不支持复杂的嵌套展开和父级访问。
