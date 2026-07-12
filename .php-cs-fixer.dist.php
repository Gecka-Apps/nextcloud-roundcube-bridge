<?php

declare(strict_types=1);

require_once './vendor/autoload.php';

use Nextcloud\CodingStandard\Config;

$config = new Config();
// Keep 4-space indentation instead of the Nextcloud standard's tabs.
$config->setIndent('    ');
$config
    ->getFinder()
    ->ignoreVCSIgnored(true)
    ->notPath('build')
    ->notPath('l10n')
    ->exclude('connector')
    ->in(__DIR__);

return $config;
