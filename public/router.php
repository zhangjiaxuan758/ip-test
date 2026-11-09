<?php
declare(strict_types=1);

define('XUAN_APP', true);
require __DIR__ . '/../app/bootstrap.php';

// 仅在使用 PHP 内置服务器调试时生效：
// 已存在的静态文件交给内置服务器处理，其余请求进入路由。
if (PHP_SAPI === 'cli-server') {
    $requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $file = __DIR__ . rawurldecode($requestPath);
    if (is_file($file)) {
        return false;
    }
}

handle_request();
