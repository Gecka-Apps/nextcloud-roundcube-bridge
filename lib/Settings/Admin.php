<?php

/**
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\MailRoundcubeBridge\Settings;

use OCA\MailRoundcubeBridge\AppInfo\Application;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IConfig;
use OCP\IInitialStateService;
use OCP\Settings\ISettings;
use OCP\Util;

/**
 * Admin settings page for the RoundCube Bridge app.
 */
class Admin implements ISettings
{
    /**
     * Nextcloud configuration service.
     *
     * @var IConfig
     */
    private IConfig $config;

    /**
     * Initial state service for passing data to frontend.
     *
     * @var IInitialStateService
     */
    private IInitialStateService $initialStateService;

    /**
     * Constructor.
     *
     * @param IConfig              $config              The configuration service.
     * @param IInitialStateService $initialStateService The initial state service.
     */
    public function __construct(
        IConfig $config,
        IInitialStateService $initialStateService
    ) {
        $this->config = $config;
        $this->initialStateService = $initialStateService;
    }

    /**
     * Get the admin settings form.
     *
     * @return TemplateResponse The template response.
     */
    public function getForm(): TemplateResponse
    {
        $this->initialStateService->provideInitialState(
            Application::APP_ID,
            'admin',
            [
                'enabled' => $this->config->getAppValue(Application::APP_ID, 'bridge_enabled', 'no'),
            ]
        );

        Util::addScript(Application::APP_ID, 'mail_roundcube_bridge-admin');

        return new TemplateResponse(Application::APP_ID, 'admin', []);
    }

    /**
     * Get the settings section ID.
     *
     * @return string The section ID (uses mail_roundcube's section).
     */
    public function getSection(): string
    {
        // Use mail_roundcube's admin section
        return 'mail_roundcube';
    }

    /**
     * Get the settings priority.
     *
     * @return integer The priority (lower = appears after mail_roundcube's own settings).
     */
    public function getPriority(): int
    {
        // Lower priority = appears after mail_roundcube's own settings
        return 60;
    }
}
