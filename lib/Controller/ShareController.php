<?php

/**
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\MailRoundcubeBridge\Controller;

use Gecka\Nextcloud\Nextbridge\Connector\Share\ShareController as BaseShareController;

/**
 * Share link creation API for the Roundcube connector.
 *
 * All logic lives in the shared base controller; this subclass only
 * anchors the endpoint in the app's OCA namespace for routing.
 */
class ShareController extends BaseShareController {
}
