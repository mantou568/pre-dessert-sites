/**
 * 站点配置 lint 脚本（ms-site-adapt skill 随附，供 CI 与智能体适配自检共用）
 * - 校验 site_config/commons + sites 全量 JSON：命名三要素、必填字段、schema/parser/过滤器白名单
 * - 未知过滤器名 / 未知 schema 会让后端直接 panic，一律 error（exit 1，CI 拦截发版）
 * - 命名、字段名、历史遗留键等问题：警告（后端对未知键静默忽略，不致命）
 * - login_assist 的选择器语法由 scripts/lint_selectors.mjs 负责，此处不重复
 *
 * 白名单依据 media-saber 后端源码核对：
 * - 过滤器注册表 internal/modules/btsite/filter/filter.go
 * - schema 注册表 internal/modules/btsite/client.go + constants.go
 * - 解析器分发 internal/modules/btsite/parser/parser.go
 * - 请求键 internal/modules/btsite/constants.go 及各 *_client.go
 *
 * 用法：npm run lint:configs
 *   或：node .agents/skills/ms-site-adapt/scripts/lint_configs.mjs [--root <仓库根>]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 仓库根默认取本脚本向上 4 级（.agents/skills/ms-site-adapt/scripts -> 仓库根）
const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const argRootIdx = process.argv.indexOf('--root');
const ROOT = argRootIdx > 0 ? resolve(process.argv[argRootIdx + 1]) : resolve(SCRIPT_DIR, '..', '..', '..', '..');
const CONFIG_DIR = join(ROOT, 'site_config');
const FAVICON_DIR = join(ROOT, 'site_favicon');
// 图标目录真实文件名集合（精确大小写；后端按 {id}.png 精确查找，Linux 上大小写敏感）
const FAVICON_FILES = new Set(existsSync(FAVICON_DIR) ? readdirSync(FAVICON_DIR) : []);

/** 后端 filter/filter.go 注册表全部过滤器（未注册名会 panic("unknown filter type")） */
const KNOWN_FILTERS = new Set([
  're_search', 'split', 'replace', 'strip', 'append_left', 'append_right', 'append_field_right',
  'querystring', 'regex', 'byte_size', 'timestamp', 'timezone', 'eq', 'case',
  'not_blank', 'blank', 'constant', 'user_profile_holder', 'pad_zero',
]);

/** 后端 parser/parser.go 分发支持的解析器（精确大小写，未知值运行时报“不支持的解析器类型”） */
const KNOWN_PARSERS = new Set(['CssSelector', 'XPath', 'Xml', 'JsonPath', 'None']);

/** 后端 client.go schema 注册表（未知 schema 会 panic("未知的站点客户端")；缺省按 NexusPHP） */
const KNOWN_SCHEMAS = new Set([
  'NexusPHP', 'mTorrent', 'zhuQue', 'rousi', 'bt', 'telegram', 'gying', 'hdsky',
  'chdbits', 'ttg', 'pt52pt', 'u2', 'opencd', 'nullbr', 'attendance_captcha',
]);

/** 后端消费的请求键（constants.go + 各架构客户端专用键） */
const KNOWN_RD_KEYS = new Set([
  // constants.go 通用键
  'user_basic_info', 'user_details', 'search', 'seeding_statistics', 'seeding_count', 'seeding_size',
  'favicon', 'my_hr', 'messages', 'message_detail', 'notice', 'get_rss', 'rss',
  'sign_in', 'details', 'get_subtitle_url', 'shoutbox', 'download_link', 'token_refresh', 'user_profile',
  // 各架构客户端专用键
  'chdbits_sign_in_page', 'chdbits_sign_in_submit', 'gen_dl_token', 'image', 'mark_as_read',
  'my_peer_statistics', 'profile', 'sign_in_action', 'sign_in_image_code', 'sign_in_page',
  'sign_in_showup', 'sign_in_submit', 'sys_role_list', 'ttg_sign_in_start_page', 'ttg_sign_in_submit',
  'u2_sign_in_page', 'u2_sign_in_submit',
]);

/** 历史遗留、当前后端已不消费的请求键（允许存在但提示） */
const LEGACY_RD_KEYS = new Set(['my_bonus', 'infos', 'get_security_info', 'get_genshin_character', 'download_file']);

/** 后端 core.Config 消费的顶层键 */
const TOP_KEYS = new Set([
  'id', 'name', 'domain', 'additional_domain', 'api', 'requests', 'torrent_id_filters', 'public',
  'schema', 'reuse_schema', 'required', 'category', 'search_box', 'meta', 'custom_config',
  'first_page_offset', 'login_assist',
]);

/** 历史遗留、当前后端已不消费的顶层键（静默忽略，不告警） */
const LEGACY_TOP_KEYS = new Set([
  'count_message', 'encoding', 'my_hr', 'sign_in_required', 'cookie', 'timezone', 'required_headers', 'id_cookie_name',
]);

const CATEGORY_KEYS = new Set(['movie', 'tv', '9kg', 'music', 'query', 'Single']);
const META_KEYS = new Set(['has_free', 'has_2x_free', 'has_hr', 'has_cover', 'shoutbox']);
const REQUIRED_KEYS = new Set(['user_id', 'sign_in', 'cookie']);

/** 文档已过时、后端实际消费键不同的字段名（警告并提示正确写法） */
const STALE_FIELD_HINTS = {
  search: { imdbid: '后端消费键为 imdb_id' },
  my_hr: { downloaded_time: '后端消费键为 download_time' },
};

let errorCount = 0;
let warnCount = 0;
let fileCount = 0;

const fail = (file, msg) => {
  errorCount++;
  console.error(`  ✗ ${file}: ${msg}`);
};
const warn = (file, msg) => {
  warnCount++;
  console.warn(`  ⚠ ${file}: ${msg}`);
};

/** 深度收集一个 Field 内出现的全部过滤器引用（含 any/fields 嵌套与 list.next_page） */
function collectFieldFilters(field, cb) {
  if (!field || typeof field !== 'object') return;
  for (const f of field.filters ?? []) cb(f, 'field.filters');
  for (const a of field.any ?? []) collectFieldFilters(a, cb);
  if (field.fields && typeof field.fields === 'object') {
    for (const child of Object.values(field.fields)) collectFieldFilters(child, cb);
  }
  if (field.list) collectFieldFilters(field.list.next_page, cb);
}

/** 校验单个请求定义 */
function lintRequestDefinition(file, label, rd) {
  if (!rd || typeof rd !== 'object' || Array.isArray(rd)) {
    fail(file, `requests.${label} 必须为对象`);
    return;
  }
  if (rd.parser !== undefined && rd.parser !== '' && !KNOWN_PARSERS.has(rd.parser)) {
    const hint = rd.parser === 'XML' ? '（大小写敏感，应写 "Xml"）' : '';
    fail(file, `requests.${label}.parser 非法: "${rd.parser}"，可选 ${[...KNOWN_PARSERS].join(' / ')} ${hint}`);
  }
  const checkFilter = (f, where) => {
    if (!f || typeof f !== 'object' || typeof f.name !== 'string') {
      fail(file, `requests.${label} ${where} 过滤器项缺少 name`);
      return;
    }
    if (!KNOWN_FILTERS.has(f.name)) {
      fail(file, `requests.${label} ${where} 未知过滤器 "${f.name}"（后端将 panic），可用: ${[...KNOWN_FILTERS].sort().join(', ')}`);
    }
  };
  collectFieldFilters(rd, checkFilter);
  if (rd.flat_map_fields?.fields) {
    for (const child of Object.values(rd.flat_map_fields.fields)) collectFieldFilters(child, checkFilter);
  }
  // 文档过时字段名提醒
  const hints = STALE_FIELD_HINTS[label];
  if (hints && rd.fields) {
    for (const stale of Object.keys(hints)) {
      if (rd.fields[stale] !== undefined) warn(file, `requests.${label} 字段 "${stale}": ${hints[stale]}`);
    }
  }
}

/** 校验 requests 映射 */
function lintRequests(file, requests) {
  if (!requests || typeof requests !== 'object' || Array.isArray(requests)) {
    fail(file, 'requests 必须为对象');
    return;
  }
  for (const [key, rd] of Object.entries(requests)) {
    if (!KNOWN_RD_KEYS.has(key)) {
      if (LEGACY_RD_KEYS.has(key)) {
        warn(file, `requests.${key} 为历史遗留请求键，当前后端不消费（仅当自定义客户端需要时保留）`);
      } else {
        warn(file, `requests.${key} 非后端已知请求键，运行时将被忽略（若为拼写错误请修正；新增键需后端代码支持）`);
      }
    }
    if (rd && rd.disabled !== true) lintRequestDefinition(file, key, rd);
  }
}

/** 校验顶层 torrent_id_filters */
function lintTorrentIdFilters(file, filters) {
  if (!Array.isArray(filters)) {
    fail(file, 'torrent_id_filters 必须为数组');
    return;
  }
  for (const f of filters) {
    if (!f || typeof f !== 'object' || typeof f.name !== 'string') {
      fail(file, 'torrent_id_filters 过滤器项缺少 name');
      continue;
    }
    if (!KNOWN_FILTERS.has(f.name)) {
      fail(file, `torrent_id_filters 未知过滤器 "${f.name}"（后端将 panic），可用: ${[...KNOWN_FILTERS].sort().join(', ')}`);
    }
  }
}

/** 校验站点配置（sites/*.json） */
function lintSite(file, data) {
  const id = data.id;
  if (typeof id !== 'string' || id.trim() === '') {
    fail(file, '缺少顶层 id 或类型非字符串');
    return;
  }
  if (!/^[a-z0-9_]+$/.test(id)) {
    fail(file, `id "${id}" 不符合 snake_case（小写字母/数字/下划线）`);
  }
  const base = basename(file).replace(/\.json$/, '');
  if (id !== base) fail(file, `id "${id}" 与文件名 "${base}" 不一致（三要素：文件名 = id = 图标名）`);
  if (!FAVICON_FILES.has(`${id}.png`)) {
    warn(file, `缺少站点图标 site_favicon/${id}.png（128×128，发布前请补齐；注意文件名大小写须与 id 一致）`);
  }
  if (typeof data.name !== 'string' || data.name.trim() === '') fail(file, '缺少顶层 name 或类型非字符串');
  if (typeof data.domain !== 'string' || !/^https?:\/\//.test(data.domain)) {
    fail(file, `domain 必须以 http(s):// 开头，实际: ${JSON.stringify(data.domain)}`);
  }
  if (data.schema === undefined || data.schema === '') {
    warn(file, '未声明 schema，后端缺省按 NexusPHP 处理，建议显式声明');
  } else if (!KNOWN_SCHEMAS.has(data.schema)) {
    fail(file, `未知 schema "${data.schema}"（后端将 panic），可用: ${[...KNOWN_SCHEMAS].sort().join(', ')}`);
  }
  if (data.reuse_schema !== undefined && data.reuse_schema !== null && data.reuse_schema !== '' && !KNOWN_SCHEMAS.has(data.reuse_schema)) {
    warn(file, `reuse_schema "${data.reuse_schema}" 非已知架构，回退查找将永远落空`);
  }
  if (data.public !== undefined && typeof data.public !== 'boolean') warn(file, 'public 应为布尔值');
  if (data.required !== undefined) {
    for (const [k, v] of Object.entries(data.required)) {
      if (!REQUIRED_KEYS.has(k)) warn(file, `required.${k} 非已知键（${[...REQUIRED_KEYS].join(' / ')}）`);
      else if (typeof v !== 'boolean') warn(file, `required.${k} 应为布尔值`);
    }
  }
  if (data.category !== undefined && data.category && typeof data.category === 'object') {
    const unknown = Object.keys(data.category).filter(k => !CATEGORY_KEYS.has(k));
    if (unknown.length > 0) {
      warn(file, `category 含后端不消费的分类键: ${unknown.join(', ')}（已知: ${[...CATEGORY_KEYS].join(' / ')}；注意 Single 为大写首字母）`);
    }
  }
  if (data.meta !== undefined && data.meta && typeof data.meta === 'object') {
    const unknown = Object.keys(data.meta).filter(k => !META_KEYS.has(k));
    if (unknown.length > 0) {
      warn(file, `meta 含后端不消费的键: ${unknown.join(', ')}（已知: ${[...META_KEYS].join(' / ')}）`);
    }
  }
  if (data.torrent_id_filters !== undefined) {
    warn(file, '站点级 torrent_id_filters 在架构继承时会被公共配置整体覆盖（后端 InitConfig 无条件用架构值覆盖站点值）');
    lintTorrentIdFilters(file, data.torrent_id_filters);
  }
  for (const k of Object.keys(data)) {
    if (!TOP_KEYS.has(k) && !LEGACY_TOP_KEYS.has(k)) {
      warn(file, `顶层键 "${k}" 后端不消费（未知键被静默忽略，若为拼写错误请修正）`);
    }
  }
  // requests 缺失合法：站点未定义的请求键会从架构公共配置整份复制（纯继承站点）
  if (data.requests !== undefined) lintRequests(file, data.requests);
}

/** 校验公共架构配置（commons/*.json） */
function lintCommon(file, data) {
  if (typeof data.id !== 'string' || data.id.trim() === '') {
    fail(file, '缺少顶层 id（公共配置以 id 作为继承注册键）');
    return;
  }
  if (data.torrent_id_filters !== undefined) lintTorrentIdFilters(file, data.torrent_id_filters);
  lintRequests(file, data.requests);
}

for (const dir of ['commons', 'sites']) {
  const dirPath = join(CONFIG_DIR, dir);
  if (!existsSync(dirPath)) {
    fail(`site_config/${dir}`, '目录不存在');
    continue;
  }
  const files = readdirSync(dirPath).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const rel = `site_config/${dir}/${f}`;
    fileCount++;
    let data;
    try {
      data = JSON.parse(readFileSync(join(dirPath, f), 'utf-8'));
    } catch (e) {
      fail(rel, `JSON 解析失败: ${e.message}`);
      continue;
    }
    if (dir === 'sites') lintSite(rel, data);
    else lintCommon(rel, data);
  }
}

console.log(`\n完成: ${fileCount} 个配置文件, ${warnCount} 警告, ${errorCount} 错误`);
if (errorCount > 0) {
  process.exit(1);
}
