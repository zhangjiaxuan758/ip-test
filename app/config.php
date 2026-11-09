<?php
declare(strict_types=1);

if (!defined('XUAN_APP')) {
    http_response_code(404);
    exit;
}

return [
    /*
     * 允许访问 API 的域名白名单（不带协议和端口）。
     * 留空 [] 时自动使用当前请求的 Host，即只允许同站调用。
     * 正式部署建议填写你的域名，例如：
     * ['ip.example.com', 'www.ip.example.com']
     */
    'allowed_hosts' => [],

    /*
     * 如果你的 Nginx 前面还有 CDN / 反向代理，把代理服务器 IP 填进来，
     * 才会信任 X-Forwarded-For 里的客户端 IP。直接面对用户的 Nginx 留空。
     */
    'trusted_proxies' => [],

    // 上游结果缓存秒数
    'cache_ttl' => [
        'geoip'  => 600,
        'whois'  => 600,
        'domain' => 120,
    ],

    // 上游请求超时（秒）
    'upstream_timeout' => 25,

    // 单个上游响应最大字节数，防止异常大响应占满内存
    'max_upstream_bytes' => 6 * 1024 * 1024,

    // 是否拒绝没有 Referer/Origin 的 API 请求。
    // 默认 false：允许 curl 直接调试。
    // 想更严格可设为 true。
    'require_referer' => false,
];
