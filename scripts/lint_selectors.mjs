/**
 * login_assist 选择器/字段 lint 脚本
 * - 校验所有 login_assist 的 JSON 形态与 CSS 选择器语法（jsdom querySelector 同源语义）
 * - 语法错误 / 形态错误：exit 1（CI 拦截发版）
 * - captcha 单侧配置：警告（不拦截，后端加载时会丢弃该子块回退默认）
 *
 * 用法：npm run lint:selectors
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'site_config');
const dom = new JSDOM('<html><body></body></html>');
const probe = dom.window.document.body;

let errorCount = 0;
let warnCount = 0;
let siteCount = 0;
let selectorCount = 0;

const fail = (file, msg) => {
  errorCount++;
  console.error(`  ✗ ${file}: ${msg}`);
};
const warn = (file, msg) => {
  warnCount++;
  console.warn(`  ⚠ ${file}: ${msg}`);
};

/**
 * 引号/方括号配平检查（补充 jsdom nwsapi 引擎的宽容盲区）：
 * nwsapi 对 "img[alt='x'" 这类未闭合写法不抛错，但 Chrome 会抛 SyntaxError，此处对齐浏览器严格度。
 */
function checkSelectorBalance(sel) {
  let bracket = 0;
  let quote = null;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === '\\') {
      i++; // 跳过转义字符
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      quote = ch;
    } else if (ch === '[') {
      bracket++;
    } else if (ch === ']') {
      bracket--;
      if (bracket < 0) return '多余的 ]';
    }
  }
  if (quote) return `引号 ${quote} 未闭合`;
  if (bracket !== 0) return '方括号未闭合';
  return null;
}

/** 校验选择器：语法错误 fail，合法则计数 */
function checkSelector(file, label, sel) {
  if (typeof sel !== 'string' || sel.trim() === '') {
    fail(file, `${label} 选择器必须为非空字符串，实际: ${JSON.stringify(sel)}`);
    return;
  }
  const balanceError = checkSelectorBalance(sel);
  if (balanceError) {
    fail(file, `${label} 非法 CSS 选择器 "${sel}": ${balanceError}`);
    return;
  }
  try {
    probe.querySelector(sel);
    selectorCount++;
  } catch (e) {
    fail(file, `${label} 非法 CSS 选择器 "${sel}": ${e.message}`);
  }
}

/** 校验字符串数组字段 */
function checkStrArray(file, obj, key, label) {
  const v = obj?.[key];
  if (v === undefined) return;
  if (!Array.isArray(v) || v.length === 0 || v.some(s => typeof s !== 'string' || s.trim() === '')) {
    fail(file, `${label}.${key} 必须为非空字符串数组`);
    return;
  }
  if (key === 'login_paths') {
    for (const p of v) {
      if (!p.startsWith('/')) warn(file, `${label}.login_paths 建议以 / 开头的路径子串: "${p}"`);
    }
    return;
  }
  for (const sel of v) checkSelector(file, `${label}.${key}`, sel);
}

function lintLoginAssist(file, assist) {
  siteCount++;
  if (typeof assist !== 'object' || assist === null || Array.isArray(assist)) {
    fail(file, 'login_assist 必须为对象');
    return;
  }
  checkStrArray(file, assist, 'login_paths', 'login_assist');

  if (assist.captcha !== undefined) {
    const c = assist.captcha;
    if (typeof c !== 'object' || c === null || Array.isArray(c)) {
      fail(file, 'login_assist.captcha 必须为对象');
    } else {
      const hasImage = Array.isArray(c.image_selectors);
      const hasInput = Array.isArray(c.input_selectors);
      if (!hasImage && !hasInput) {
        warn(file, 'login_assist.captcha 未配置任何选择器，将被忽略');
      } else if (hasImage !== hasInput) {
        // 单侧配置在加载期被整块丢弃，提示贡献者补全
        warn(file, 'login_assist.captcha 图片与输入框选择器必须成对配置，当前仅一侧，加载时整块将被丢弃');
      }
      checkStrArray(file, c, 'image_selectors', 'captcha');
      checkStrArray(file, c, 'input_selectors', 'captcha');
    }
  }

  if (assist.two_factor !== undefined) {
    const t = assist.two_factor;
    if (typeof t !== 'object' || t === null || Array.isArray(t)) {
      fail(file, 'login_assist.two_factor 必须为对象');
    } else {
      checkStrArray(file, t, 'input_selectors', 'two_factor');
      if (t.segmented !== undefined) {
        const s = t.segmented;
        const segKeys = ['container_selector', 'digit_selector', 'hidden_input_selector'];
        if (typeof s !== 'object' || s === null || Array.isArray(s)) {
          fail(file, 'two_factor.segmented 必须为对象');
        } else {
          for (const k of segKeys) {
            const v = s[k];
            if (typeof v !== 'string' || v.trim() === '') {
              fail(file, `two_factor.segmented.${k} 必须为非空字符串`);
            } else {
              checkSelector(file, `segmented.${k}`, v);
            }
          }
        }
      }
    }
  }

  if (assist.login_paths === undefined && assist.captcha === undefined && assist.two_factor === undefined) {
    warn(file, 'login_assist 为空块，建议整块删除');
  }
}

for (const dir of ['commons', 'sites']) {
  const files = readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const full = join(ROOT, dir, f);
    const rel = `site_config/${dir}/${basename(f)}`;
    let data;
    try {
      data = JSON.parse(readFileSync(full, 'utf-8'));
    } catch (e) {
      fail(rel, `JSON 解析失败: ${e.message}`);
      continue;
    }
    if (data.login_assist !== undefined) {
      console.log(`检查 ${rel}`);
      lintLoginAssist(rel, data.login_assist);
    }
  }
}

console.log(`\n完成: ${siteCount} 个 login_assist 块, ${selectorCount} 个选择器通过, ${warnCount} 警告, ${errorCount} 错误`);
if (errorCount > 0) {
  process.exit(1);
}
