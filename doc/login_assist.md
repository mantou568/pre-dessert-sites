# 站点 login_assist 登录辅助适配指南

> 站点适配基础（parser / 选择器 / 过滤器 / JSON 结构）见 [site_adaptation.md](site_adaptation.md)。

`login_assist` 是站点 JSON 顶层的**可选块**，供浏览器扩展类消费方在站点登录页自动识别/填充验证码与两步验证码。**不配置该块的站点完全不受影响**（消费方走内置默认规则）。

## 字段说明

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

| 字段 | 类型 | 必填 | 语义 |
|---|---|---|---|
| `login_paths` | `string[]` | 否 | 登录/两步验证步骤页 URL 路径子串列表；缺省用消费方内置默认 |
| `captcha.image_selectors` | `string[]` | 否 | 验证码图片选择器，按序尝试 |
| `captcha.input_selectors` | `string[]` | 否 | 验证码输入框选择器，按序尝试 |
| `two_factor.input_selectors` | `string[]` | 否 | 两步验证单输入框选择器 |
| `two_factor.segmented` | `object` | 否 | 分离式输入配置，三选择器字段见上例 |

## 继承规则

- 站点配置了 `login_assist` 时，`captcha` / `two_factor` **子块整体覆盖** `commons/NexusPHP.json` 的对应默认（不与默认做数组合并）；未配置的子块继承 commons 默认
- 站点与 commons 均未配置时由消费方内置规则兜底（行为等同未配置）
- UNIT3D 等无 commons 默认的架构：站点级配置或走消费方内置默认

## 贡献约束

1. 选择器必须是标准 CSS selector（`querySelector` 语义），每子项建议 ≤4 条，首条放最精确的
2. `captcha` 图片与输入框选择器**必须成对配置**，只配一侧会在加载期被丢弃（CI 会警告）
3. `login_paths` 填写页面 URL 的路径子串（含两步验证步骤页，如 `/takeotp.php`）；不要写 `takelogin.php` 等 POST 落地页
4. **本配置仅含页面结构选择器，严禁包含任何用户数据**（密钥、Cookie、账号等）
5. 提交前本地自检：`npm install && npm run lint:selectors`（CI 发版前会强制拦截语法错误）

## 配置示例（star_space）

```json
"login_assist": {
  "login_paths": ["/p_login/login.php"],
  "captcha": {
    "image_selectors": ["img[alt='CAPTCHA']", "img[src*='login_image.php']"],
    "input_selectors": ["input[name='txt_code']"]
  }
}
```

## 版本兼容

消费 `login_assist` 需消费方程序（服务端与浏览器扩展）均为支持该字段的版本；旧版本组合自动降级为内置默认规则，行为等同未配置。
