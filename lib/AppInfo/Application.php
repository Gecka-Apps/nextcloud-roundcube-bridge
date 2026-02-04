<?php

/**
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\MailRoundcubeBridge\AppInfo;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\Util;

/**
 * Main application class for the RoundCube Bridge app.
 *
 * Provides integration between RoundCube (embedded via mail_roundcube)
 * and Nextcloud services (files, calendar).
 */
class Application extends App implements IBootstrap
{
    /**
     * Application ID constant.
     */
    public const APP_ID = 'mail_roundcube_bridge';

    /**
     * Constructor.
     *
     * @param array $urlParams URL parameters.
     */
    public function __construct(array $urlParams = [])
    {
        parent::__construct(self::APP_ID, $urlParams);
    }

    /**
     * Register app services and event listeners.
     *
     * @param IRegistrationContext $context The registration context.
     *
     * @return void
     */
    public function register(IRegistrationContext $context): void
    {
    }

    /**
     * Boot the application.
     *
     * Injects the bridge script when the app is enabled.
     *
     * @param IBootContext $context The boot context.
     *
     * @return void
     */
    public function boot(IBootContext $context): void
    {
        $config = \OC::$server->getConfig();
        $enabled = $config->getAppValue(self::APP_ID, 'bridge_enabled', 'no') === 'yes';

        if ($enabled) {
            // Inject bridge script when mail_roundcube app is loaded
            Util::addScript(self::APP_ID, 'mail_roundcube_bridge-main');
        }
    }
}
