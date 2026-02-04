<?php

/**
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

declare(strict_types=1);

return [
    'routes' => [
        [
            'name' => 'settings#set_admin',
            'url' => '/settings/admin/{key}',
            'verb' => 'POST',
        ],
        [
            'name' => 'calendar#add_event',
            'url' => '/api/calendar/event',
            'verb' => 'POST',
        ],
    ],
];
