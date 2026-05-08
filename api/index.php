<?php

declare(strict_types=1);

require_once __DIR__ . '/../app/controller/ApiController.php';

use app\controller\ApiController;

$controller = new ApiController();
$controller->handle();
