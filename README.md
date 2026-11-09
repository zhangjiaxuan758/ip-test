# 小轩IP检测 · PHP 版

一个中文 IP 工具站：查询本机 IPv4 / IPv6、GeoIP、Whois / RDAP、域名解析、DNS 泄露检测、网络测速和 AZ 环境变量。

- 前端：原生 HTML / CSS / JavaScript，中文界面，响应式布局，无广告
- 后端：PHP 8 + cURL，代理上游查询并做缓存和同源保护
- 数据库：**不需要数据库**
- 测速：浏览器直接连接国内测速节点（阿里云 CDN + speedtest.cn），**不消耗你服务器的带宽**

---

## 0. 源码说明

这是一个已脱敏的通用版本，不包含任何真实域名、服务器地址、证书或后台凭据。

- `app/`：PHP 后端（路由、API、解析、缓存）
- `public/`：Web 根目录，只暴露这一层
- `deploy/nginx.conf`：站点配置示例（证书路径、PHP-FPM 路径请按实际服务器修改）
- `nginx.conf.example`：通用 Nginx 示例
- `storage/cache/`：只保留空目录和 `.gitkeep`，不含运行缓存

部署到自己的服务器时，只需要改：

1. `app/config.php` 的 `allowed_hosts`
2. `deploy/nginx.conf` 里的 `server_name`、`root`、证书路径、PHP-FPM socket
3. `public/.user.ini` 里的 `open_basedir`

---

## 1. 功能

| 页面 | 地址 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 当前 IPv4 / IPv6、ISP、ASN、位置、国旗 |
| GeoIP | `/geoip/` | 任意 IPv4 / IPv6 的地理位置与网络信息 |
| DNS | `/dns/` | DNS 泄露检测，列出递归 DNS 服务器 |
| 域名 | `/domain/` | 域名 A / AAAA 解析及每个 IP 的 GeoIP |
| Whois | `/whois/` | IP、CIDR、ASN、域名的 RDAP / WHOIS 查询 |
| 测速 | `/speedtest/` | 下载、上传、延迟、抖动、加载延迟 |
| AZ 环境变量 | `/azenv/` | 查看请求头与服务器环境 |
| 工具 | 顶部“工具”菜单 | AZ 环境变量 + 外部工具入口 |

统一搜索框会自动分流：

- IPv4 / IPv6 → `/geoip/?q=...`
- 域名 / ASN / CIDR → `/whois/?q=...`

---

## 2. 目录结构

```text
xiaoxuan-ip-server/
├── public/                     # Nginx Web 根目录，只暴露这一层
│   ├── index.html
│   ├── geoip.html
│   ├── dns.html
│   ├── domain.html
│   ├── whois.html
│   ├── speedtest.html
│   ├── azenv.html
│   ├── 404.html
│   ├── router.php              # 唯一允许执行的 PHP 入口
│   ├── .user.ini               # open_basedir 配置示例
│   └── assets/                 # CSS / JS / 字体 / 271 面国旗
├── app/                        # 不可通过 Web 访问
│   ├── bootstrap.php           # 路由、API、解析、缓存
│   └── config.php              # 站点配置
├── storage/                    # 运行时可写目录（不可通过 Web 访问）
│   └── cache/                  # 查询结果缓存（目录内为空）
├── deploy/
│   └── nginx.conf              # Nginx 站点配置示例
├── nginx.conf.example          # 通用 Nginx 示例配置
└── README.md                   # 本文档
```

> 关键原则：`public/` 是 Web 根目录，`app/` 和 `storage/` 必须放在 Web 根目录之外。

---

## 3. 环境要求（完整清单）

这一节是部署前必须核对的全部环境要求。3.10 给出了参考环境，方便对照。

### 3.1 服务器最低配置

| 项目 | 最低 | 推荐 |
| --- | --- | --- |
| CPU | 1 核 | 2 核及以上 |
| 内存 | 256 MB | 512 MB 及以上 |
| 磁盘 | 200 MB 可用 | 1 GB 及以上 |
| 操作系统 | Ubuntu 22.04+ / Debian 12+ / Rocky 9+ | Ubuntu 24.04 |
| 架构 | x86_64 / arm64 | 均可 |
| 数据库 | 不需要 | 不需要 |
|  swap | 可选 | 512 MB（内存较小时） |

说明：

- 源码和静态资源约 3 MB，其中 271 面国旗占大部分
- `storage/cache` 会缓存上游响应，单条最大 6 MB，长期运行建议留 1 GB
- 不需要 MySQL、Redis、Node.js、Python、Composer、npm
- 不需要 WebSocket、FFmpeg、Flash、Java

### 3.2 软件版本

| 软件 | 参考版本 | 要求 |
| --- | --- | --- |
| Ubuntu | 24.04.1 LTS | 22.04+ |
| Nginx | 1.30.5（宝塔） | 1.20+ |
| PHP | 8.2.33 | 8.0+，推荐 8.2 / 8.3 |
| PHP-FPM | 8.2 | 必须 |
| OpenSSL | 系统自带 | 1.1.1+ / 3.x |
| MySQL | 未使用 | 不需要 |
| Certbot / 面板证书 | 面板证书 | 任意有效证书 |

Nginx 必需的编译模块：

- `http_ssl_module`（HTTPS）
- `http_v2_module`（HTTP/2，可选但推荐）
- `headers`（安全响应头，默认内置）
- `gzip`（可选）
- `realip`（只有前面有 CDN 时才需要）
- `http_v3_module`（可选，示例中启用了 QUIC；没有就删掉 `listen 443 quic` 和 `http3 on`）

检查命令：

```bash
nginx -v
nginx -V 2>&1 | tr ' ' '\n' | grep -E 'http_ssl|http_v2|http_v3|realip|gzip'
php -v
php -m | grep -E '^(curl|mbstring|json|openssl)$'
```

宝塔环境对应的命令：

```bash
/www/server/nginx/sbin/nginx -v
/www/server/php/82/bin/php -v
/www/server/php/82/bin/php -m | grep -E 'curl|mbstring|json|openssl'
```

### 3.3 PHP 扩展与 php.ini

必须安装/启用的扩展：

| 扩展 | 用途 |
| --- | --- |
| `curl` | 请求 ip.sb 的上游接口 |
| `mbstring` | 中文/ UTF-8 字符串处理 |
| `json` | API 返回 JSON（PHP 8 内置） |
| `openssl` | HTTPS 上游请求（PHP 8 内置） |

`php.ini` 建议值：

```ini
expose_php = Off
display_errors = Off
log_errors = On
error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
max_execution_time = 60
memory_limit = 128M
post_max_size = 8M
upload_max_filesize = 8M
allow_url_fopen = Off
date.timezone = Asia/Shanghai
default_charset = "UTF-8"
session.auto_start = 0

; 可选：PHP 8 的 opcache
opcache.enable = 1
opcache.validate_timestamps = 1
```

关于 `open_basedir`：

```ini
; 必须与站点实际路径一致；不确定时可以留空
open_basedir = /var/www/xiaoxuan-ip/:/tmp/
```

- 如果站点不在 `/var/www/xiaoxuan-ip`，必须改成新路径，否则 PHP 会报 `open_basedir restriction in effect`
- 修改后需要 reload PHP-FPM

检查命令：

```bash
php -i | grep -E 'open_basedir|memory_limit|max_execution_time|allow_url_fopen|expose_php'
```

PHP-FPM 要求：

| 项目 | 要求 |
| --- | --- |
| 运行用户 | 宝塔通常 `www`，Ubuntu 通常 `www-data` |
| 监听方式 | Unix socket 或 `127.0.0.1:9000` 均可 |
| `pm.max_children` | ≥ 5（小站 5–10 足够） |
| `request_terminate_timeout` | 60s |
| `catch_workers_output` | `yes`（方便看错误日志，可选） |

PHP-FPM 用户必须对 `storage/` 有写权限，否则 API 返回 503。

### 3.4 Nginx 配置要求

核心要求：

```nginx
root /var/www/xiaoxuan-ip/public;   # 必须指向 public，不是项目根目录
index index.html;

location / {
    try_files $uri $uri/ /router.php?$query_string;
}

location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;  # 按实际版本修改
    fastcgi_read_timeout 60s;
}

client_max_body_size 1m;
server_tokens off;
fastcgi_hide_header X-Powered-By;
```

必须保留的安全配置：

```nginx
# 应用与缓存目录在 Web 根之外，这里是双保险
location ^~ /app/ { deny all; }
location ^~ /storage/ { deny all; }

# 禁止敏感文件和目录
location ~* (\.user\.ini|\.htaccess|\.env.*|\.git|\.svn|\.bak|\.old|\.sql|README\.md)$ {
    return 404;
}
```

必须添加的响应头：

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://ipv4.ip.sb https://ipv6.ip.sb https://api.ip.sb https://*.dnsprobe.ip.sb https://cdn.npmmirror.com https://node-223-160-155-255.speedtest.cn:51090 https://node-111-61-93-49.speedtest.cn:51090 https://node-111-20-163-124.speedtest.cn:51090 https://node-27-185-69-133.speedtest.cn:51090" always;
```

HTTPS 要求：

```nginx
ssl_certificate     /path/to/fullchain.pem;
ssl_certificate_key /path/to/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

**特别注意：不要保留 `error_page 404 /404.html;`。** 它会把 `/api/...` 返回的 404 JSON 替换成 HTML，前端就无法显示“未找到”。如果一定要自定义 404，只对非 `/api/` 路径生效。

宝塔 / aaPanel 的配置里通常还有这些 include：

```nginx
include enable-php-82.conf;
include /var/www/xiaoxuan-ip/deploy/well-known.conf;
include /var/www/xiaoxuan-ip/deploy/extension/*.conf;
include /var/www/xiaoxuan-ip/deploy/rewrite.conf;
```

- 这些文件不存在时，`nginx -t` 会失败；要么创建，要么删掉对应 include
- 面板重新生成站点配置后，可能覆盖 `root`、`try_files`、安全头；修改后要复查
- 本目录的 `deploy/nginx.conf` 是宝塔格式，不能直接复制到非宝塔服务器

### 3.5 文件权限

| 对象 | 要求 |
| --- | --- |
| 项目目录 | `www:www`（宝塔）或 `www-data:www-data`（Ubuntu） |
| 普通目录 | 755 |
| 普通文件 | 644 |
| `storage/` | PHP-FPM 用户可写；755（owner 即 FPM 用户）或 775 |
| `public/.user.ini` | 644，内容里的路径必须与实际一致 |
| 证书私钥 | 600，属主 root 或 Nginx 用户 |

设置示例（Ubuntu）：

```bash
chown -R www-data:www-data /var/www/xiaoxuan-ip
find /var/www/xiaoxuan-ip -type d -exec chmod 755 {} \;
find /var/www/xiaoxuan-ip -type f -exec chmod 644 {} \;
chmod -R 775 /var/www/xiaoxuan-ip/storage
```

检查：

```bash
sudo -u www-data test -w /var/www/xiaoxuan-ip/storage/cache && echo "storage writable"
namei -l /var/www/xiaoxuan-ip/public
```

不要使用 `chmod 777`。如果开了 SELinux，还需要：

```bash
chcon -R -t httpd_sys_rw_content_t /var/www/xiaoxuan-ip/storage
```

### 3.6 域名、DNS 与证书

- 一个域名，例如 `ip.example.com`
- A 记录指向服务器 IPv4；需要 IPv6 时再加 AAAA
- 服务器放行 80/tcp、443/tcp；使用 QUIC 时再放行 443/udp
- 有效证书（Let's Encrypt、宝塔面板证书、商业证书均可），必须使用 fullchain
- HTTP 自动跳转 HTTPS
- HSTS 可选，确认所有子域都支持 HTTPS 后再开
- 如果前面有 CDN / 反向代理：
  - 在 `app/config.php` 配置 `trusted_proxies`
  - Nginx 配置 `real_ip` / `X-Forwarded-For`
  - 否则 azenv 等接口看到的客户端 IP 会是 CDN 节点

申请证书示例：

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d ip.example.com
```

示例证书路径（仅作对照，换服务器必须改）：

```text
/etc/letsencrypt/live/ip.example.com/fullchain.pem
/etc/letsencrypt/live/ip.example.com/privkey.pem
```

### 3.7 网络、端口与出站

入站端口：

| 端口 | 协议 | 用途 |
| --- | --- | --- |
| 80 | TCP | HTTP，跳转 HTTPS / 证书验证 |
| 443 | TCP | HTTPS |
| 443 | UDP | QUIC/HTTP3，可选 |

服务器出站（PHP 查询上游需要）：

| 域名 | 用途 |
| --- | --- |
| `ip.sb` | GeoIP、Whois、域名解析 |
| `ipv4.ip.sb` | 服务器 IPv4 信息 |
| `ipv6.ip.sb` | 服务器 IPv6 信息（没有 IPv6 时可不通） |
| `api.ip.sb` | 备用接口 |

浏览器出站（测速 / DNS 泄露检测需要）：

| 域名 | 用途 |
| --- | --- |
| `ipv4.ip.sb` / `ipv6.ip.sb` | 本机 IP 检测 |
| `*.dnsprobe.ip.sb` | DNS 泄露检测 |
| `cdn.npmmirror.com` | 国内下载测速 |
| `node-*.speedtest.cn:51090` | 国内上传测速 |

其他：

- DNS 出站 53/udp、53/tcp
- NTP 123/udp 可选，保持时间同步
- 不需要开放 MySQL 3306；本站在线环境没有使用数据库，建议 3306 不对公网开放
- 如果服务器出站被限制，GeoIP / Whois / 域名查询会返回 502；测速是浏览器直连，不受服务器出站影响

UFW 示例：

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp   # 只有启用 QUIC 时需要
```

### 3.8 浏览器要求

- Chrome / Edge / Firefox / Safari 的近两年版本
- 支持 `fetch`、`ReadableStream`、`AbortController`、`performance.now`
- 测速建议使用多线程，并关闭代理 / VPN / 广告拦截器
- 测速流量由浏览器直接连接国内节点，不经过服务器
- 不需要 Flash、Java、WebAssembly

### 3.9 不需要安装的组件

以下都不是必需：

- MySQL / MariaDB / Redis / Memcached
- Node.js / npm / Composer
- Python / Go / Java
- WebSocket 服务
- 定时任务（缓存会自动过期；如需清理可自行加 cron）
- `fileinfo`、`gd`、`imagick` 等图像扩展
- `exec` / `shell_exec` / `system` 等 shell 函数（可以禁用）

### 3.10 参考环境

| 项目 | 参考值 |
| --- | --- |
| 操作系统 | Ubuntu 24.04 LTS |
| Nginx | 1.20+ |
| PHP | 8.2 / 8.3 |
| PHP 扩展 | curl、mbstring、json、openssl |
| 站点目录 | `/var/www/xiaoxuan-ip` |
| Web 根 | `/var/www/xiaoxuan-ip/public` |
| 属主 | `www-data:www-data`（宝塔为 `www:www`） |
| PHP-FPM | Unix socket 或 `127.0.0.1:9000` |
| 证书 | 任意有效证书，使用 fullchain |
| 数据库 | 未使用 |
| `allowed_hosts` | `[]`（留空时自动使用当前 Host） |
| Nginx 配置 | `deploy/nginx.conf` / `nginx.conf.example` |
| `open_basedir` | `public/.user.ini` |

### 3.11 环境自检与安装示例

上线前依次执行：

```bash
# 1. 版本
nginx -v
php -v
php -m | grep -E 'curl|mbstring|json|openssl'

# 2. Nginx 配置
nginx -t

# 3. 权限
sudo -u www-data test -w /var/www/xiaoxuan-ip/storage/cache && echo OK

# 4. 站点
curl -I https://ip.example.com/
curl "https://ip.example.com/api/domain?q=google.com"

# 5. 404 JSON 不被替换
curl -i "https://ip.example.com/api/domain?q=foo.invalid"
# 期望：HTTP 404，Content-Type: application/json，body {"ok":false,"error":"未找到"}
```

Ubuntu / Debian 安装示例：

```bash
apt-get update
apt-get install -y nginx php8.3-fpm php8.3-curl php8.3-mbstring php8.3-openssl
# json 是 PHP 8 内置；Ubuntu 22.04 默认没有 8.3，需要 ondrej PPA 或改用 8.1/8.2
```

CentOS / Rocky 安装示例：

```bash
dnf install -y nginx php-fpm php-cli php-curl php-mbstring php-json php-openssl
```

宝塔 / aaPanel 部署要点：

1. 新建站点，PHP 版本选 8.2 或 8.3
2. 把站点根目录改成 `.../public`
3. 在“网站目录”里确认运行目录是 `public`
4. 在“伪静态”或自定义配置里加入 `try_files $uri $uri/ /router.php?$query_string;`
5. 申请并强制 HTTPS
6. 检查 `enable-php-82.conf` 是否存在
7. 检查 `public/.user.ini` 的 `open_basedir` 是否是当前站点路径
8. 检查 `storage` 属主是否为 `www`
9. 面板若自动加了 `error_page 404 /404.html`，删掉或只对非 API 生效
10. 面板重建配置后，复查 root、路由、CSP

### 3.12 上线检查清单

- [ ] 域名 A/AAAA 已解析到服务器
- [ ] 80/443 已放行
- [ ] Nginx 1.20+，SSL/HTTP2 模块可用
- [ ] PHP 8.0+，curl/mbstring/json/openssl 已启用
- [ ] `display_errors=Off`、`expose_php=Off`
- [ ] `open_basedir` 与站点路径一致（或留空）
- [ ] Nginx `root` 指向 `public`
- [ ] `try_files` 指向 `/router.php`
- [ ] `fastcgi_read_timeout` ≥ 30s（建议 60s）
- [ ] 没有 `error_page 404 /404.html`
- [ ] `app/`、`storage/` 不可通过 Web 访问
- [ ] `storage/` 对 PHP-FPM 用户可写
- [ ] `app/config.php` 的 `allowed_hosts` 是正式域名
- [ ] CSP 包含 ip.sb、dnsprobe、npmmirror、speedtest 节点
- [ ] 证书有效，HTTP 跳 HTTPS
- [ ] 服务器能出站访问 ip.sb
- [ ] 浏览器能访问 npmmirror 和 speedtest.cn 节点（测速）
- [ ] 备份了旧站点和旧 Nginx 配置

---

## 4. 快速部署

### 4.1 上传并解压

```bash
mkdir -p /var/www/xiaoxuan-ip
cd /var/www/xiaoxuan-ip
unzip xiaoxuan-ip-php.zip
# 如果解压后多一层 xiaoxuan-ip-php 目录，把里面的内容移到当前目录
```

最终应得到：

```text
/var/www/xiaoxuan-ip/public/
/var/www/xiaoxuan-ip/app/
/var/www/xiaoxuan-ip/storage/
```

### 4.2 设置权限

```bash
chown -R www-data:www-data /var/www/xiaoxuan-ip
find /var/www/xiaoxuan-ip -type d -exec chmod 755 {} \;
find /var/www/xiaoxuan-ip -type f -exec chmod 644 {} \;
chmod -R 775 /var/www/xiaoxuan-ip/storage
```

> PHP-FPM 的运行用户必须对 `storage/` 有写权限，否则 API 会返回 503。
> 宝塔面板的 PHP-FPM 用户通常是 `www`，请按实际情况替换 `www-data`。

### 4.3 修改配置

编辑 `app/config.php`，至少修改：

```php
'allowed_hosts' => ['ip.example.com'],
```

如果前面有 CDN / 反向代理：

```php
'trusted_proxies' => ['CDN 节点 IP 或网段'],
```

### 4.4 配置 Nginx

复制 `nginx.conf.example` 到 Nginx 站点配置目录，修改：

- `server_name`
- PHP-FPM socket 路径（`php8.3-fpm.sock` 按版本修改）
- `root` 必须是 `.../public`

```bash
nginx -t
systemctl reload nginx
```

如果使用宝塔 / aaPanel，请确认面板生成的站点配置中：

```nginx
root /var/www/xiaoxuan-ip/public;
location / {
    try_files $uri $uri/ /router.php?$query_string;
}
```

**注意：不要在站点配置里保留 `error_page 404 /404.html;`。** 否则 `/api/domain` 等接口返回的 `404 JSON` 会被 Nginx 替换成 HTML 404 页面，前端就无法显示“未找到”。如需自定义 404 页面，请只对非 `/api/` 请求生效，或直接依赖 `router.php` 输出的 404 页面。

### 4.5 HTTPS

页面默认会从 HTTP 跳转到 HTTPS。申请证书：

```bash
certbot --nginx -d ip.example.com
```

启用 HTTPS 后，可在 Nginx 中打开 HSTS（示例配置里已预留）。

### 4.6 验证

```bash
curl -I https://ip.example.com/
curl "https://ip.example.com/api/geoip?q=8.8.8.8"
curl "https://ip.example.com/api/domain?q=google.com"
```

---

## 5. 配置说明（app/config.php）

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `allowed_hosts` | `[]` | API 允许的域名。空数组表示只允许当前请求的 Host；正式环境建议填写域名 |
| `trusted_proxies` | `[]` | 信任的代理 IP。只有这些 IP 发来的 `X-Forwarded-For` 才会被使用 |
| `cache_ttl` | geoip 600 / whois 600 / domain 120 | 上游结果缓存秒数 |
| `upstream_timeout` | 25 | 上游请求超时 |
| `max_upstream_bytes` | 6 MB | 单次上游响应最大字节数 |
| `require_referer` | false | 是否拒绝没有 Referer / Origin 的 API 请求 |

---

## 6. API 文档

所有接口均为 `GET`，返回 JSON，不发送 CORS 通配头。

| 接口 | 参数 | 说明 |
| --- | --- | --- |
| `/api/addrinfo` | `family=4` 或 `6` | 服务器出口 IP 信息 |
| `/api/geoip` | `q=IP` | 任意 IP 的 GeoIP |
| `/api/whois` | `q=IP/CIDR/ASN/域名` | RDAP / WHOIS |
| `/api/domain` | `q=域名` | 域名解析 + 每个 IP 的 GeoIP |
| `/api/dns/<uuid>` | 32 位十六进制 | DNS 泄露检测轮询 |
| `/api/azenv` | `uri=/azenv/` | 请求环境变量 |

错误格式：

```json
{"ok": false, "error": "未找到"}
```

常见状态码：

- `400` 参数无效
- `403` 来源不被允许
- `404` 未找到
- `502` 上游暂时不可用
- `503` 存储目录不可写

---

## 7. 安全与保护

已内置：

- **同源校验**：校验 `Referer` / `Origin`，其他网站盗用接口返回 403
- **缓存**：减少回源，降低被刷的压力
- **输入校验**：IP / 域名 / UUID 严格校验
- **上游限制**：只允许 HTTPS、超时、最大响应体积
- **Web 根隔离**：`app/`、`storage/` 不在 Web 根目录
- **敏感路径**：`.user.ini`、`.env`、`.git`、`app/`、`storage/` 等被 Nginx 拒绝
- **安全头**：CSP、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy
- **TLS**：建议只启用 TLS 1.2 / 1.3
- **PHP**：关闭 `display_errors`、隐藏 `X-Powered-By`

可选增强：

- Nginx Basic Auth 整站密码
- Nginx `allow / deny` IP 白名单
- 面板自带的“访问密码”
- Cloudflare 代理 + `trusted_proxies` / `real_ip`

---

## 8. 测速说明（重要）

**测速不会经过你的服务器。**

测速时：

- 页面和 JS 由你的服务器加载（几百 KB）
- 实际下载 / 上传数据由浏览器直接连接国内测速节点
- 因此服务器带宽低不会影响测速结果

当前使用的国内端点（`public/assets/speedtest.js`）：

```js
// 下载 / 延迟：阿里云 npmmirror CDN，约 46 MB，支持 CORS
w=["https://cdn.npmmirror.com/binaries/node/v20.0.0/node-v20.0.0-linux-x64.tar.gz"]

// 上传：页面加载时会探测下面 4 个 speedtest.cn 国内节点，自动选最快的一个
S=["https://node-223-160-155-255.speedtest.cn:51090/upload?r=xuan"]
```

参数说明：

- `w`：下载 / 延迟测试地址，需要支持 CORS、返回较大的 `Content-Length`
- `S`：上传测试地址；speedtest.cn 节点不返回 CORS 头，所以代码用 `mode:'no-cors'` 发送请求，浏览器拿不到响应内容，但能准确测到请求体发送完成所需时间
- 页面加载后会向 4 个候选节点各发送 1 MB 探测包，4.2 秒内选出发送最快的节点，再把它写入 `S`
- 默认使用多线程；单线程只使用 1 路连接，千兆网络建议保持多线程
- `ze=6`、`J=6`：多线程模式下下载 / 上传各 6 路并发，便于跑满千兆带宽
- `H()` 会自动判断 URL 是否已有 `?`，用 `?` 或 `&` 追加随机参数

候选上传节点：

```text
https://node-223-160-155-255.speedtest.cn:51090
https://node-111-61-93-49.speedtest.cn:51090
https://node-111-20-163-124.speedtest.cn:51090
https://node-27-185-69-133.speedtest.cn:51090
```

CSP 的 `connect-src` 必须包含：

```text
https://cdn.npmmirror.com
https://node-223-160-155-255.speedtest.cn:51090
https://node-111-61-93-49.speedtest.cn:51090
https://node-111-20-163-124.speedtest.cn:51090
https://node-27-185-69-133.speedtest.cn:51090
```

如果节点失效或你想换节点：

1. 下载地址换成一个国内、支持 CORS、文件足够大（建议 ≥ 20 MB）的地址
2. 上传地址换成另一个 speedtest.cn 节点，或支持 CORS POST 的上传端点
3. 同步修改 Nginx CSP 的 `connect-src`
4. 修改 HTML 中的 `speedtest.js?v=...` 版本号，避免浏览器缓存旧脚本

之前出现“测试服务器不可达”，原因是原 jsDelivr 测速对象在当前网络被拦截；现在下载走阿里云 CDN、上传走国内 speedtest.cn 节点，不再依赖 jsDelivr 或 Cloudflare。

---

## 9. 常见问题

### 9.1 测速提示“测试服务器不可达”

- 检查浏览器控制台是否有 CSP 拦截
- 检查 `https://cdn.npmmirror.com` 和 `https://node-*.speedtest.cn:51090` 是否可访问
- 确认 `connect-src` 包含上述测速端点
- 换一个网络或关闭广告拦截器再试

### 9.2 域名查询显示“未找到”

- 域名格式正确但没有解析记录，或上游返回 404
- 前端会显示“未找到”，不会再出现“上游返回 HTTP 404”

### 9.3 接口返回 403“来源不被允许”

- `allowed_hosts` 没填对
- 通过 IP / 其他域名访问，但配置只允许正式域名
- 前面有 CDN，但没有配置 `trusted_proxies`

### 9.4 接口返回 503

- `storage/` 不可写
- 检查 `chown` / `chmod`，PHP-FPM 用户必须能写

### 9.5 修改 JS/CSS 后浏览器还是旧版

Nginx 对静态资源设置了缓存。修改后在 HTML 中给资源加版本号：

```html
<link rel="stylesheet" href="/assets/site.css?v=20261023">
<script src="/assets/speedtest.js?v=20261023e" defer></script>
```

### 9.6 宝塔面板修改站点后配置被重置

面板重新生成站点配置时，可能覆盖：

- `root` 指向 `public`
- `location / { try_files ... /router.php }`
- 安全响应头

修改后请检查并恢复。建议保留一份 `ip.example.com.conf` 备份。

---

## 10. 备份与回滚

部署前备份站点目录和 Nginx 配置：

```bash
cp -a /var/www/xiaoxuan-ip /var/www/xiaoxuan-ip.bak-$(date +%Y%m%d-%H%M%S)
cp -a /var/www/xiaoxuan-ip/deploy/ip-test.conf \
     /var/www/xiaoxuan-ip/deploy/ip-test.conf.bak-$(date +%Y%m%d-%H%M%S)
```

回滚：

```bash
rm -rf /var/www/xiaoxuan-ip
mv /var/www/xiaoxuan-ip.bak-XXXX /var/www/xiaoxuan-ip
cp /var/www/xiaoxuan-ip/deploy/ip-test.conf.bak-XXXX \
   /var/www/xiaoxuan-ip/deploy/ip-test.conf
nginx -t && nginx -s reload
```

---

## 11. 本机调试

```bash
cd xiaoxuan-ip-php
php -S 127.0.0.1:8000 -t public public/router.php
```

打开 <http://127.0.0.1:8000/>。

> 不要直接双击 `index.html` 用 `file://` 打开：页面会失去样式，GeoIP / Whois / DNS 等接口也无法工作。必须通过 PHP 服务访问。

---

## 12. 数据来源与声明

- IP 地理位置、ASN、Whois 等数据来自 ip.sb / MaxMind 等公开数据源
- 本站仅做前端整合与结果缓存，与 ip.sb 官方无隶属关系
- 请遵守上游服务的使用条款，不要高频抓取
- 建议用于个人学习与自用，公开运营前请确认数据授权与合规要求

---

## 13. 更新记录

### 2026-10-23

- 完成 PHP 版并部署上线
- 测速改为国内节点：阿里云 npmmirror CDN 下载 / 延迟，speedtest.cn 国内节点上传，并自动选择最快的国内节点；多线程 6 路；测速流量不经过本站服务器
- 修复“工具”下拉箭头：点击关闭后箭头会转回原位，菜单不再被 hover 卡住
- 域名查询上游 404 统一显示“未找到”，不再显示“上游返回 HTTP 404”
- 增加完整部署文档、Nginx 示例与同源保护
