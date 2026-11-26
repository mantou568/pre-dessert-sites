# login_assist 登录辅助（后端权威版）

> 依据：`internal/modules/btsite/core/login_assist.go`（Sanitize/Merge）、`internal/logic/site/login_assist_logic.go`（`GET /api/v1/site/loginAssist` 驼峰投影）。
> 完整背景可读 `doc/login_assist.md`（与本文件一致，冲突时以本文 + 后端代码为准）。

## 定位与消费链

`login_assist` 是站点 JSON 顶层**可选块**，只含页面结构选择器。后端通过 `GET /api/v1/site/loginAssist` 以驼峰命名投影给 **MS 浏览器扩展**，由扩展在站点登录页/两步验证页自动填充验证码与两步验证码。后端本身不做表单填充。

```jsonc
"login_assist": {
  "login_paths": ["/login.php", "/takeotp.php"],   // 登录/两步验证步骤页的 URL 路径子串（注入判定）
  "captcha": {                                      // 图片验证码
    "image_selectors": ["img[alt='CAPTCHA']"],
    "input_selectors": ["input[name='txt_code']"]
  },
  "two_factor": {                                   // 两步验证
    "input_selectors": ["input[name='otp']"],       // 单输入框，先尝试
    "segmented": {                                  // 分离式逐位输入，单框未命中时的回退
      "container_selector": ".input-wrap",
      "digit_selector": ".input-content .input-item",
      "hidden_input_selector": ".input-wrap input.visible"
    }
  }
}
```

## 继承与清洗（后端实际行为）

1. 站点未配置 → 整块继承 commons 对应架构的默认（NexusPHP 已内置标准登录页/验证码/2FA 选择器）。
2. 站点配置了 → `login_paths` / `captcha` / `two_factor` **子块整体覆盖**，不与默认数组合并；未写的子块仍继承 commons。
3. `SanitizeLoginAssist` 清洗（非法不报错，静默丢弃，**CI lint 是权威告警口**）：
   - `captcha` 图片与输入框**必须成对**，只配一侧整块丢弃；
   - `segmented` 三个选择器键缺一 → 整块丢弃（保留 `input_selectors`）；
   - 空串从数组中修剪；空数组视为未配置。

## 贡献约束

1. 标准 CSS selector（`querySelector` 语义）；每个子项 ≤4 条，**首条放最精确的**。
2. `login_paths` 填登录页/两步验证**步骤页**路径子串；**不要写 `takelogin.php` 等 POST 落地页**。
3. **严禁包含任何用户数据**（密钥、Cookie、账号等），只能有页面结构选择器。
4. 标准命名可零配置：NexusPHP 默认 `imagestring` 验证码命名（`#imagestring`、`input[name="imagestring"]`、`input[placeholder*="验证码"]`、`input[name*="code"]` 等）扩展可自动识别，无需写 `captcha` 块。
5. 提交前自检：`npm run lint:selectors`（jsdom 同源校验语法；单侧 captcha 只警告）。

## 配置示例（star_space / piggo 实例）

- 常规验证码：`site_config/sites/star_space.json`
- 分离式两步验证（segmented）：`site_config/sites/piggo.json`
