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
use OCP\IAppConfig;
use OCP\Util;

/**
 * Main application class for the Nextbridge Roundcube Connector app.
 *
 * Provides integration between RoundCube (embedded via mail_roundcube)
 * and Nextcloud services (files, calendar).
 */
class Application extends App implements IBootstrap {
    /**
     * Application ID constant.
     */
    public const APP_ID = 'mail_roundcube_bridge';

    /**
     * Constructor.
     *
     * @param array $urlParams URL parameters.
     */
    public function __construct(array $urlParams = []) {
        parent::__construct(self::APP_ID, $urlParams);
    }

    /**
     * Register app services and event listeners.
     *
     * @param IRegistrationContext $context The registration context.
     *
     * @return void
     */
    public function register(IRegistrationContext $context): void {
        $this->registerConnectorAutoloader();
    }

    /**
     * Register the PSR-4 autoloader for the shared connector library.
     *
     * The library is vendored under connector/lib/ (git-subrepo). Nextcloud only
     * auto-maps the app's own OCA namespace, so the shared Gecka namespace is
     * registered here.
     *
     * @return void
     */
    private function registerConnectorAutoloader(): void {
        spl_autoload_register(static function (string $class): void {
            $prefix = 'Gecka\\Nextcloud\\Nextbridge\\Connector\\';
            if (!str_starts_with($class, $prefix)) {
                return;
            }
            $file = __DIR__ . '/../../connector/lib/'
                . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_file($file)) {
                require $file;
            }
        });
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
    public function boot(IBootContext $context): void {
        $appConfig = $context->getServerContainer()->get(IAppConfig::class);
        $enabled = $appConfig->getValueString(self::APP_ID, 'bridge_enabled', 'no') === 'yes';

        if ($enabled) {
            // Inject bridge script when mail_roundcube app is loaded
            Util::addScript(self::APP_ID, 'mail_roundcube_bridge-main');
        }
    }
}
