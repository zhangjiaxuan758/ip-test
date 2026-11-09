<?php
declare(strict_types=1);

if (!defined('XUAN_APP')) {
    http_response_code(404);
    exit;
}

ini_set('display_errors', '0');
error_reporting(E_ALL);

define('XUAN_ROOT', dirname(__DIR__));
define('XUAN_PUBLIC', XUAN_ROOT . '/public');
define('XUAN_STORAGE', XUAN_ROOT . '/storage');
define('XUAN_UA', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

$GLOBALS['XUAN_CONFIG'] = require __DIR__ . '/config.php';

function config(): array
{
    return $GLOBALS['XUAN_CONFIG'];
}

function json_response(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function deny(int $status, string $message): void
{
    json_response($status, ['ok' => false, 'error' => $message]);
}

function ensure_dir(string $dir): bool
{
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return is_dir($dir) && is_writable($dir);
}

function client_ip(array $config): string
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $trusted = $config['trusted_proxies'] ?? [];
    if ($trusted && in_array($remote, $trusted, true)) {
        $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
        if ($xff !== '') {
            $first = trim(explode(',', $xff)[0]);
            if (filter_var($first, FILTER_VALIDATE_IP)) {
                return $first;
            }
        }
    }
    return $remote;
}

function check_origin(array $config): void
{
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $host = preg_replace('/:\d+$/', '', $host) ?: '';

    $allowed = $config['allowed_hosts'] ?? [];
    if (!$allowed) {
        $allowed = $host !== '' ? [$host] : [];
    }
    if ($host === '' || !in_array($host, $allowed, true)) {
        deny(403, '来源不被允许。');
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    foreach ([$origin, $referer] as $url) {
        if ($url === '') {
            continue;
        }
        $refHost = parse_url($url, PHP_URL_HOST);
        if (!$refHost || !in_array(strtolower($refHost), $allowed, true)) {
            deny(403, '来源不被允许。');
        }
    }

    if (!empty($config['require_referer']) && $origin === '' && $referer === '') {
        deny(403, '缺少来源信息。');
    }
}

function cache_file(string $key): string
{
    return XUAN_STORAGE . '/cache/' . hash('sha256', $key) . '.json';
}

function cache_get(string $key)
{
    $file = cache_file($key);
    if (!is_file($file)) {
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['expires']) || (int)$data['expires'] < time()) {
        @unlink($file);
        return null;
    }
    return $data['value'] ?? null;
}

function cache_set(string $key, $value, int $ttl): void
{
    $dir = XUAN_STORAGE . '/cache';
    if (!ensure_dir($dir)) {
        return;
    }
    $file = $dir . '/' . hash('sha256', $key) . '.json';
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $payload = json_encode(
        ['expires' => time() + $ttl, 'value' => $value],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    if ($payload !== false && @file_put_contents($tmp, $payload, LOCK_EX) !== false) {
        @rename($tmp, $file);
    }
    @unlink($tmp);
}

/**
 * 请求 ip.sb 上游，返回 [HTTP 状态码, 响应体]。
 *
 * @return array{0:int,1:string}
 */
function http_get(string $url, int $timeout, ?int $maxBytes = null): array
{
    $config = config();
    $maxBytes = $maxBytes ?? (int)$config['max_upstream_bytes'];
    $body = '';

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('curl 初始化失败');
    }

    $options = [
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 2,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => XUAN_UA,
        CURLOPT_HTTPHEADER => [
            'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
            'Accept: text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
            'Referer: https://ip.sb/',
            'Origin: https://ip.sb',
            'Cache-Control: no-cache',
        ],
        CURLOPT_WRITEFUNCTION => function ($curl, string $chunk) use (&$body, $maxBytes): int {
            if (strlen($body) + strlen($chunk) > $maxBytes) {
                return 0;
            }
            $body .= $chunk;
            return strlen($chunk);
        },
    ];

    if (defined('CURLOPT_PROTOCOLS_STR')) {
        $options[CURLOPT_PROTOCOLS_STR] = 'https';
        $options[CURLOPT_REDIR_PROTOCOLS_STR] = 'https';
    } else {
        $options[CURLOPT_PROTOCOLS] = CURLPROTO_HTTPS;
        $options[CURLOPT_REDIR_PROTOCOLS] = CURLPROTO_HTTPS;
    }

    curl_setopt_array($ch, $options);
    $ok = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);

    if ($ok === false) {
        throw new RuntimeException('网络请求失败：' . $error);
    }
    return [$status, $body];
}

function clean_text(string $value): string
{
    $value = preg_replace('/<br\s*\/?>/i', "\n", $value) ?? $value;
    $value = strip_tags($value);
    $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $lines = array_map('trim', preg_split('/\R/', $value) ?: []);
    return trim(implode("\n", $lines));
}

function localize_href(string $href): ?string
{
    if (str_starts_with($href, '/whois/')) {
        return '/whois/?q=' . rawurlencode(rawurldecode(substr($href, 7)));
    }
    if (str_starts_with($href, '/geoip/')) {
        return '/geoip/?q=' . rawurlencode(rawurldecode(substr($href, 7)));
    }
    return null;
}

function parse_rows_fragment(string $fragment): array
{
    $rows = [];
    if (!preg_match_all(
        '/<div class="row([^"]*)">\s*<span class="lbl">(.*?)<\/span>\s*<span class="val([^"]*)">(.*?)<\/span>/s',
        $fragment,
        $matches,
        PREG_SET_ORDER
    )) {
        return $rows;
    }

    foreach ($matches as $match) {
        $label = clean_text($match[2]);
        if ($label === '') {
            continue;
        }
        $valHtml = $match[4];
        $flag = null;
        if (preg_match('~/assets/flags/([a-z0-9_-]+)\.~', $valHtml, $fm) && strlen($fm[1]) === 2) {
            $flag = strtolower($fm[1]);
        }
        $href = null;
        if (preg_match('/href="([^"]+)"/', $valHtml, $hm)) {
            $href = localize_href($hm[1]);
        }
        $valClass = $match[3] ?? '';
        $rows[] = [
            'label' => $label,
            'text' => clean_text($valHtml),
            'href' => $href,
            'flag' => $flag,
            'mono' => str_contains($valClass, 'mono'),
            'strong' => str_contains($valClass, 'strong'),
        ];
    }
    return $rows;
}

function parse_cards(string $page): array
{
    $cards = [];
    if (!preg_match_all('/<section class="card([^"]*)">(.*?)<\/section>/s', $page, $matches, PREG_SET_ORDER)) {
        return $cards;
    }

    foreach ($matches as $match) {
        $classes = trim($match[1]);
        $inner = $match[2];
        if (str_contains($classes, 'faq') || str_contains($inner, '<form') || str_contains($inner, 'whois-raw')) {
            continue;
        }
        $rows = parse_rows_fragment($inner);
        if (!$rows) {
            continue;
        }

        $head = '';
        if (preg_match('/<div class="card-head([^"]*)">(.*?)<\/div>\s*(?=<div class="row|<button|<pre|<section|$)/s', $inner, $hm)) {
            $head = $hm[2];
        }
        $title = preg_match('/<h2[^>]*>(.*?)<\/h2>/s', $head, $tm) ? clean_text($tm[1]) : '';
        $status = '';
        $statusClass = 'wait';
        if (preg_match('/<span class="status ([a-z]+)"[^>]*>(.*?)<\/span>/s', $head, $sm)) {
            $statusClass = $sm[1];
            $status = clean_text($sm[2]);
        }

        $cards[] = [
            'title' => $title,
            'status' => $status,
            'statusClass' => $statusClass,
            'rows' => $rows,
        ];
    }
    return $cards;
}

function extract_raw(string $page): string
{
    if (preg_match('/<pre class="whois-raw"[^>]*>(.*?)<\/pre>/s', $page, $match)) {
        return trim(clean_text($match[1]));
    }
    return '';
}

function classify(string $value): string
{
    $text = trim($value);
    if (preg_match('/^AS\d+$/i', $text)) {
        return 'asn';
    }
    if (str_contains($text, '/')) {
        [$ip, $prefix] = explode('/', $text, 2);
        if (filter_var(trim($ip, '[]'), FILTER_VALIDATE_IP) && ctype_digit($prefix)) {
            return 'cidr';
        }
    }
    if (filter_var(trim($text, '[]'), FILTER_VALIDATE_IP)) {
        return 'ip';
    }
    return 'domain';
}

function error_from_page(string $page): string
{
    if (preg_match('/<p class="(?:whois-error|hero-error|result-error)"[^>]*>(.*?)<\/p>/s', $page, $match)) {
        $message = clean_text($match[1]);
        if ($message !== '') {
            return $message;
        }
    }
    if (str_contains($page, 'class="notfound"')) {
        return '未找到相关记录。';
    }
    return '';
}

function api_addrinfo(string $family): array
{
    $url = $family === '6' ? 'https://ipv6.ip.sb/addrinfo' : 'https://ipv4.ip.sb/addrinfo';
    [$status, $body] = http_get($url, $family === '6' ? 3 : 8);
    if ($status !== 200) {
        throw new RuntimeException('上游返回 HTTP ' . $status);
    }
    $data = json_decode($body, true);
    if (!is_array($data)) {
        throw new RuntimeException('上游数据格式异常');
    }
    return $data;
}

function whois_path_encode(string $value): string
{
    return implode('/', array_map('rawurlencode', explode('/', $value)));
}

function api_geoip(string $query): array
{
    $text = trim($query);
    if (!filter_var(trim($text, '[]'), FILTER_VALIDATE_IP)) {
        return [400, ['ok' => false, 'error' => '请输入有效的 IPv4 或 IPv6 地址。']];
    }

    $key = 'geoip:' . strtolower($text);
    $cached = cache_get($key);
    if (is_array($cached)) {
        return [200, $cached];
    }

    [$status, $body] = http_get('https://ip.sb/geoip/' . rawurlencode(trim($text, '[]')), 20);
    if ($status !== 200) {
        return [502, ['ok' => false, 'error' => '上游返回 HTTP ' . $status . '，请稍后重试。']];
    }

    $cards = parse_cards($body);
    if (!$cards) {
        $message = error_from_page($body) ?: '没有找到该 IP 的地理位置信息。';
        return [404, ['ok' => false, 'error' => $message]];
    }

    $payload = [
        'ok' => true,
        'query' => $text,
        'kind' => classify($text),
        'cards' => $cards,
    ];
    cache_set($key, $payload, (int)(config()['cache_ttl']['geoip'] ?? 600));
    return [200, $payload];
}

function api_whois(string $query): array
{
    $text = preg_replace('/\s+/u', '', $query) ?? '';
    $text = str_replace("\u{3000}", '', $text);
    if ($text === '' || mb_strlen($text, 'UTF-8') > 255) {
        return [400, ['ok' => false, 'error' => '请输入要查询的 IP、CIDR、ASN 或域名。']];
    }
    if (preg_match('/[\x00-\x1F\x7F]/', $text)) {
        return [400, ['ok' => false, 'error' => '查询内容无效。']];
    }

    $key = 'whois:' . strtolower($text);
    $cached = cache_get($key);
    if (is_array($cached)) {
        return [200, $cached];
    }

    [$status, $body] = http_get('https://ip.sb/whois/' . whois_path_encode($text), 25);
    if ($status !== 200) {
        return [502, ['ok' => false, 'error' => '上游返回 HTTP ' . $status . '，请稍后重试。']];
    }

    $cards = parse_cards($body);
    $raw = extract_raw($body);
    if (!$cards && $raw === '') {
        $message = error_from_page($body) ?: '没有找到相关记录。';
        return [404, ['ok' => false, 'error' => $message]];
    }

    $payload = [
        'ok' => true,
        'query' => $text,
        'kind' => classify($text),
        'cards' => $cards,
        'raw' => $raw,
    ];
    cache_set($key, $payload, (int)(config()['cache_ttl']['whois'] ?? 600));
    return [200, $payload];
}

function api_domain(string $query): array
{
    $text = trim($query);
    if (
        $text === '' || mb_strlen($text, 'UTF-8') > 253 || !str_contains($text, '.')
        || str_contains($text, ' ') || str_starts_with($text, '-') || str_contains($text, '..')
        || !preg_match('/^[A-Za-z0-9\x{0080}-\x{FFFF}](?:[A-Za-z0-9\x{0080}-\x{FFFF}.-]{0,252})$/u', $text)
    ) {
        return [400, ['ok' => false, 'error' => '请输入有效的域名，例如 example.com。']];
    }

    $key = 'domain:' . strtolower($text);
    $cached = cache_get($key);
    if (is_array($cached)) {
        return [200, $cached];
    }

    [$status, $body] = http_get('https://ip.sb/domain/' . rawurlencode($text), 25);
    if ($status === 404) {
        return [404, ['ok' => false, 'error' => '未找到']];
    }
    if ($status !== 200) {
        return [502, ['ok' => false, 'error' => '上游返回 HTTP ' . $status . '，请稍后重试。']];
    }

    $summary = [];
    foreach (parse_cards($body) as $card) {
        $labels = array_column($card['rows'], 'label');
        if (in_array('IPv4', $labels, true) && in_array('IPv6', $labels, true)) {
            foreach ($card['rows'] as $row) {
                if ($row['label'] === 'IPv4' || $row['label'] === 'IPv6') {
                    $summary[] = [
                        'label' => $row['label'],
                        'text' => $row['text'],
                        'href' => null,
                        'flag' => null,
                        'mono' => true,
                        'strong' => false,
                    ];
                }
            }
            break;
        }
    }

    $addresses = [];
    $chunks = explode('<div class="acc-item">', $body);
    array_shift($chunks);
    foreach ($chunks as $chunk) {
        $end = strpos($chunk, '</section>');
        if ($end !== false) {
            $chunk = substr($chunk, 0, $end);
        }
        if (!preg_match('/<span class="acc-ip mono">(.*?)<\/span>/s', $chunk, $im)) {
            continue;
        }
        $ip = clean_text($im[1]);
        $fam = preg_match('/<span class="acc-fam">(.*?)<\/span>/s', $chunk, $fm) ? clean_text($fm[1]) : '';
        $loc = preg_match('/<span class="acc-loc">(.*?)<\/span>/s', $chunk, $lm) ? clean_text($lm[1]) : '';

        $bodyStart = strpos($chunk, '<div class="acc-body"');
        $accBody = $bodyStart !== false ? substr($chunk, $bodyStart) : '';

        $sections = [];
        $marker = '<div class="row row-sub">';
        $pos = strpos($accBody, $marker);
        if ($pos !== false) {
            $sections[] = ['title' => '', 'rows' => parse_rows_fragment(substr($accBody, 0, $pos))];
            $sections[] = ['title' => '网络信息', 'rows' => parse_rows_fragment(substr($accBody, $pos))];
        } else {
            $sections[] = ['title' => '', 'rows' => parse_rows_fragment($accBody)];
        }

        $addresses[] = [
            'ip' => $ip,
            'family' => $fam,
            'location' => $loc,
            'sections' => $sections,
        ];
    }

    if (!$summary && !$addresses) {
        $message = error_from_page($body) ?: '没有找到该域名的解析记录。';
        return [404, ['ok' => false, 'error' => $message]];
    }

    $payload = [
        'ok' => true,
        'query' => $text,
        'summary' => $summary,
        'addresses' => $addresses,
    ];
    cache_set($key, $payload, (int)(config()['cache_ttl']['domain'] ?? 120));
    return [200, $payload];
}

function api_dns(string $uuid): array
{
    if (!preg_match('/^[0-9a-f]{32}$/', $uuid)) {
        return [400, ['ok' => false, 'error' => '无效的检测标识。']];
    }
    [$status, $body] = http_get('https://ip.sb/api/dns/' . $uuid, 12);
    if ($status !== 200) {
        return [502, ['ok' => false, 'error' => '上游返回 HTTP ' . $status]];
    }
    $data = json_decode($body, true);
    if (!is_array($data)) {
        return [502, ['ok' => false, 'error' => '上游数据格式异常。']];
    }
    foreach ($data['resolvers'] ?? [] as $i => $resolver) {
        $code = strtolower((string)($resolver['country_code'] ?? ''));
        if (strlen($code) === 2) {
            $data['resolvers'][$i]['flag'] = '/assets/flags/' . $code . '.svg';
        }
        $data['resolvers'][$i]['location'] = '';
    }
    return [200, $data];
}

function api_azenv(string $requestUri): array
{
    $config = config();
    $uri = preg_replace('/[\r\n]/', '', mb_substr($requestUri, 0, 512, 'UTF-8')) ?: '/azenv/';
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';

    $rows = [
        ['key' => 'REMOTE_ADDR', 'value' => client_ip($config)],
        ['key' => 'REMOTE_PORT', 'value' => (string)($_SERVER['REMOTE_PORT'] ?? '')],
        ['key' => 'REQUEST_METHOD', 'value' => $_SERVER['REQUEST_METHOD'] ?? 'GET'],
        ['key' => 'REQUEST_URI', 'value' => $uri],
        ['key' => 'REQUEST_SCHEME', 'value' => $scheme],
        ['key' => 'REQUEST_TIME', 'value' => (string)time()],
    ];

    $skip = ['HTTP_COOKIE', 'HTTP_AUTHORIZATION', 'HTTP_PROXY_AUTHORIZATION', 'HTTP_X_API_KEY'];
    foreach ($_SERVER as $name => $value) {
        if (!is_string($value) || !str_starts_with($name, 'HTTP_')) {
            continue;
        }
        if (in_array($name, $skip, true)) {
            continue;
        }
        $rows[] = ['key' => $name, 'value' => $value];
    }

    return ['ok' => true, 'rows' => $rows];
}

function handle_api(string $path, array $params): void
{
    $config = config();
    check_origin($config);

    try {
        if ($path === '/api/addrinfo') {
            $family = ($params['family'] ?? '4') === '6' ? '6' : '4';
            json_response(200, api_addrinfo($family));
        }

        if ($path === '/api/geoip') {
            [$status, $payload] = api_geoip((string)($params['q'] ?? ''));
            json_response($status, $payload);
        }

        if ($path === '/api/whois') {
            [$status, $payload] = api_whois((string)($params['q'] ?? ''));
            json_response($status, $payload);
        }

        if ($path === '/api/domain') {
            [$status, $payload] = api_domain((string)($params['q'] ?? ''));
            json_response($status, $payload);
        }

        if (preg_match('#^/api/dns/([0-9a-f]{32})$#', $path, $match)) {
            [$status, $payload] = api_dns($match[1]);
            json_response($status, $payload);
        }

        if ($path === '/api/azenv') {
            json_response(200, api_azenv((string)($params['uri'] ?? '/azenv/')));
        }

        deny(404, '接口不存在。');
    } catch (Throwable $e) {
        error_log('[xiaoxuan-ip] ' . $e->getMessage());
        json_response(502, ['ok' => false, 'error' => '查询服务暂时不可用，请稍后重试。']);
    }
}

function serve_page(string $file, bool $headOnly = false): void
{
    $path = XUAN_PUBLIC . '/' . $file;
    if (!is_file($path)) {
        not_found();
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('X-Content-Type-Options: nosniff');
    if ($headOnly) {
        header('Content-Length: ' . filesize($path));
        exit;
    }
    readfile($path);
    exit;
}

function redirect_to(string $url, int $status = 302): void
{
    header('Location: ' . $url, true, $status);
    exit;
}

function not_found(): void
{
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><title>页面不存在 - 小轩IP检测</title>'
        . '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no,viewport-fit=cover">'
        . '<link rel="stylesheet" href="/assets/style.css"><link rel="stylesheet" href="/assets/site.css?v=20261109b">'
        . '</head><body><main><div class="notfound"><div class="nf-code">404</div>'
        . '<h1 class="nf-title">页面不存在</h1><p class="nf-msg">你访问的页面已被移动或删除。</p>'
        . '<p class="nf-actions"><a class="hero-btn" href="/">返回首页</a></p></div></main>'
        . '<script>(function(){function s(e){if(e.cancelable)e.preventDefault()}var t=0;document.addEventListener("gesturestart",s,{passive:false});document.addEventListener("gesturechange",s,{passive:false});document.addEventListener("gestureend",s,{passive:false});document.addEventListener("touchmove",function(e){if(e.touches&&e.touches.length>1)s(e)},{passive:false});document.addEventListener("touchend",function(e){var n=Date.now();if(n-t<=300)s(e);t=n},{passive:false});document.addEventListener("wheel",function(e){if(e.ctrlKey)s(e)},{passive:false});document.addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&["+","-","=","0"].indexOf(e.key)!==-1)s(e)})})();</script>'
        . '</body></html>';
    exit;
}

function handle_request(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'HEAD'], true)) {
        header('Allow: GET, HEAD');
        deny(405, '只允许 GET 请求。');
    }
    $headOnly = $method === 'HEAD';

    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $path = rawurldecode(parse_url($uri, PHP_URL_PATH) ?: '/');
    $params = $_GET;

    if (str_starts_with($path, '/api/')) {
        handle_api($path, $params);
    }

    if ($path === '/search') {
        redirect_to('/search/', 301);
    }
    if ($path === '/search/') {
        $q = trim((string)($params['q'] ?? ''));
        if ($q === '') {
            redirect_to('/');
        }
        $kind = classify($q);
        $target = ($kind === 'ip' ? '/geoip/' : '/whois/') . '?q=' . rawurlencode($q);
        redirect_to($target);
    }

    $pages = [
        '/' => 'index.html',
        '/index.html' => 'index.html',
        '/geoip/' => 'geoip.html',
        '/dns/' => 'dns.html',
        '/domain/' => 'domain.html',
        '/whois/' => 'whois.html',
        '/speedtest/' => 'speedtest.html',
        '/azenv/' => 'azenv.html',
    ];
    if (isset($pages[$path])) {
        serve_page($pages[$path], $headOnly);
    }

    foreach (['/geoip', '/dns', '/domain', '/whois', '/speedtest', '/azenv'] as $base) {
        if ($path === $base) {
            redirect_to($base . '/', 301);
        }
    }

    if (str_starts_with($path, '/geoip/') && $path !== '/geoip/') {
        $q = substr($path, 7);
        redirect_to('/geoip/?q=' . rawurlencode($q));
    }
    if (str_starts_with($path, '/domain/') && $path !== '/domain/') {
        $q = substr($path, 8);
        redirect_to('/domain/?q=' . rawurlencode($q));
    }
    if (str_starts_with($path, '/whois/') && $path !== '/whois/') {
        $q = substr($path, 7);
        redirect_to('/whois/?q=' . rawurlencode($q));
    }
    if ($path === '/favicon.ico') {
        header('Content-Type: image/svg+xml');
        header('Cache-Control: public, max-age=604800');
        readfile(XUAN_PUBLIC . '/assets/favicon.svg');
        exit;
    }

    not_found();
}
