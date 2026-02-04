<?php

/**
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\MailRoundcubeBridge\Controller;

use OCA\MailRoundcubeBridge\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;

/**
 * Controller for admin settings management.
 */
class SettingsController extends Controller
{
    /**
     * Nextcloud configuration service.
     *
     * @var IConfig
     */
    private IConfig $config;

    /**
     * Map URL key to config key (to avoid conflict with Nextcloud's 'enabled' key).
     */
    private const KEY_MAP = [
        'enabled' => 'bridge_enabled',
    ];

    /**
     * Constructor.
     *
     * @param string   $appName The application name.
     * @param IRequest $request The request object.
     * @param IConfig  $config  The configuration service.
     */
    public function __construct(
        string $appName,
        IRequest $request,
        IConfig $config
    ) {
        parent::__construct($appName, $request);
        $this->config = $config;
    }

    /**
     * Set an admin setting value.
     *
     * @param string $key   The setting key.
     * @param mixed  $value The setting value.
     *
     * @return JSONResponse The response.
     */
    public function setAdmin(string $key, mixed $value): JSONResponse
    {
        if (!isset(self::KEY_MAP[$key])) {
            return new JSONResponse(['error' => 'Invalid key'], 400);
        }

        $configKey = self::KEY_MAP[$key];
        $this->config->setAppValue(Application::APP_ID, $configKey, $value);

        return new JSONResponse(['status' => 'ok']);
    }
}
