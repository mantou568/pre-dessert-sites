#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""rousi.pro(肉丝) 适配器迁移脚本: 旧 NexusPHP 版 /api/* → PeerGo 版 /api/v1/*

背景
----
肉丝 2026-09 从 NexusPHP 换成 PeerGo, 旧的 `/api/me`、`/api/torrent/search`、
`/api/torrent/{id}`、`/api/announcements/latest`、`/api/messages`、`/api/user/{id}`
在站点上全部 404, 于是 MS(Media Saber) 报 `获取用户基本信息错误 ... 404 Not Found`,
站点显示不连通、统计数据不再落库。

PeerGo 给 API Key 留了一层**旧式兼容接口**(外层仍是 `{code, message, data}`),
所以字段映射基本沿用旧版, 只需换路径 + 少量 selector, 并开启 API 凭据头:

    GET  /api/v1/profile            ← /api/me              (data.username/uploaded/downloaded/karma/seeding_leeching_data)
    GET  /api/v1/torrents           ← /api/torrent/search  (page/page_size/keyword/category/sort; 关键字参数名是 keyword 不是 query)
    GET  /api/v1/torrents/{id}      ← /api/torrent/{id}
    POST /api/points/attendance     ← 旧签到口仍然可用, 且**不需要 CSRF**(实测)

认证: `Authorization: Bearer pgk_...`(注意 `X-API-Key` 无效)。要在 MS 里填到
站点设置的自定义请求头(site.custom_headers), 形如:

    [{"key":"Authorization","value":"Bearer pgk_xxxxxxxx"}]

然后本脚本为相关请求块写入 `use_api: true` + `required_headers: ["Authorization"]`,
否则 MS 不会带这个头, 新接口会返回 401。

无 key 面的接口(别人的资料页 / 站内信 / 公告 / passkey)在弹出的新 API 里没有对应实现,
脚本会把它们置为 `{"disabled": true}`, 避免 MS 反复刷错误日志。

用法
----
    python3 tools/rousi_adapter_peergo.py                      # 就地迁移 site_config/sites/rousi.json
    python3 tools/rousi_adapter_peergo.py 旧.json 新.json       # 指定输入输出

改完记得重启 MS 容器(适配器只在启动时加载), 并用站点的"连通性测试"验证:
    GET {MS}/api/v1/site/test?type=100&id=<siteId>   → data: {"success": true, ...}
"""
import json
import sys
from pathlib import Path

DEFAULT_SRC = Path(__file__).resolve().parent.parent / "site_config" / "sites" / "rousi.json"

API_HEADERS = {"use_api": True, "required_headers": ["Authorization"]}


def with_api(block: dict) -> dict:
    """给请求块打开 API 凭据头(MS 会从 site.custom_headers 取 Authorization)。"""
    out = {}
    for key, value in block.items():
        out[key] = value
        if key == "method":
            out.update(API_HEADERS)
    return out


def migrate(cfg: dict) -> dict:
    requests = cfg["requests"]

    # 1) 用户基本信息: /api/me → /api/v1/profile, 字段从 data.stats.* 抬到 data.*
    ubi = requests["user_basic_info"]
    fields = dict(ubi.get("fields", {}))
    for name, selector in (
        ("id", "data.username"),
        ("name", "data.username"),
        ("uploaded", "data.uploaded"),
        ("downloaded", "data.downloaded"),
        ("bonus", "data.karma"),
    ):
        if name in fields:
            fields[name]["selector"] = selector
    ubi["path"] = "/api/v1/profile"
    ubi["fields"] = fields
    requests["user_basic_info"] = with_api(ubi)

    # 2) 做种统计三块同源, 一并指向 profile
    for name in ("seeding_size", "seeding_count", "seeding_statistics"):
        block = requests.get(name)
        if isinstance(block, dict) and block.get("path"):
            block["path"] = "/api/v1/profile"
            requests[name] = with_api(block)

    # 3) passkey 接口在新 API 无对应实现, 且新下载口不再需要 passkey
    requests["get_security_info"] = {"disabled": True}

    # 4) 搜索
    search = requests.get("search")
    if isinstance(search, dict):
        search["path"] = "/api/v1/torrents"
        # MS 第一屏发 page=0, 而站方要求 page>=1 → 直接固定第 1 页(代价: 只取前 100 条)
        search["params"] = {
            "page": ["1"],
            "page_size": ["100"],
            "sort": ["created_at DESC"],
            "keyword": ["{keyword}"],
        }
        f = search.get("fields", {})
        if "category" in f:  # 旧版读的是 type, 新版字段名是 category
            f["category"]["selector"] = "category"
        if "details" in f:
            f["details"]["filters"] = [{"name": "append_left", "args": "/torrents/"}]
        if "download" in f:  # 新下载口不需要 {passkey}
            f["download"]["filters"] = [
                {"name": "append_left", "args": "/api/v1/torrents/"},
                {"name": "append_right", "args": "/download"},
            ]
        search["fields"] = f
        requests["search"] = with_api(search)

    # 5) 种子详情
    details = requests.get("details")
    if isinstance(details, dict):
        details["path"] = "/api/v1/torrents/{id}"
        requests["details"] = with_api(details)

    # 6) 其余旧接口在新 API 中不存在 → 关闭, 免得刷错
    for name in ("user_details", "notice", "messages"):
        requests[name] = {"disabled": True}

    # 7) 签到块保留(旧路径可用, 但必须带 API 凭据头)
    sign_in = requests.get("sign_in")
    if isinstance(sign_in, dict):
        requests["sign_in"] = with_api(sign_in)

    return cfg


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src
    if not src.exists():
        print(f"找不到输入文件: {src}", file=sys.stderr)
        return 1

    cfg = json.loads(src.read_text(encoding="utf-8"))
    if cfg.get("requests", {}).get("user_basic_info", {}).get("path", "").startswith("/api/v1/"):
        print("该配置已是 PeerGo 版, 无需迁移。")
        return 0

    out = migrate(cfg)
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"已写入 {dst}")
    for name, block in out["requests"].items():
        if block.get("disabled"):
            print(f"  {name:22s} DISABLED")
        else:
            print(f"  {name:22s} {block.get('method', 'GET'):4s} {block.get('path', '')}"
                  f"  api={bool(block.get('use_api'))}")
    print("\n记得: 站点自定义头里要有 Authorization: Bearer pgk_... 并重启 MS。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
