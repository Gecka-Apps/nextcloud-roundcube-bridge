<?php

/**
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\MailRoundcubeBridge\Controller;

use OCP\App\IAppManager;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\Constants;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IUserSession;
use OCP\Share\IManager as IShareManager;

/**
 * Consolidated sharing configuration for public links.
 *
 * Merges data from IShareManager settings and app availability
 * into a single JSON response, so the frontend doesn't need to
 * juggle multiple sources (capabilities, OC.appConfig, etc.).
 */
class ShareConfigController extends Controller {
    private IShareManager $shareManager;
    private IAppManager $appManager;
    private IAppConfig $appConfig;
    private IUserSession $userSession;

    public function __construct(
        string $appName,
        IRequest $request,
        IShareManager $shareManager,
        IAppManager $appManager,
        IAppConfig $appConfig,
        IUserSession $userSession,
    ) {
        parent::__construct($appName, $request);
        $this->shareManager = $shareManager;
        $this->appManager = $appManager;
        $this->appConfig = $appConfig;
        $this->userSession = $userSession;
    }

    /**
     * Return consolidated sharing settings for public links.
     *
     * @NoAdminRequired
     *
     * @return JSONResponse
     */
    public function get(): JSONResponse {
        $user = $this->userSession->getUser();
        $userId = $user?->getUID();

        return new JSONResponse([
            'sharingEnabled' => $this->shareManager->shareApiEnabled(),
            'publicLinksEnabled' => $this->shareManager->shareApiAllowLinks($user),
            'sharingDisabled' => $userId !== null
                ? $this->shareManager->sharingDisabledForUser($userId)
                : true,
            'password' => [
                'enabledByDefault' => $this->appConfig->getValueBool(
                    'core',
                    'shareapi_enable_link_password_by_default'
                ),
                'enforced' => $this->shareManager->shareApiLinkEnforcePassword(),
            ],
            'expireDate' => [
                'enabled' => $this->shareManager->shareApiLinkDefaultExpireDate(),
                'enforced' => $this->shareManager->shareApiLinkDefaultExpireDateEnforced(),
                'days' => $this->shareManager->shareApiLinkDefaultExpireDays(),
            ],
            'defaultPermissions' => (int)$this->appConfig->getValueString(
                'core',
                'shareapi_default_permissions',
                (string)Constants::PERMISSION_ALL
            ),
            'publicUpload' => $this->shareManager->shareApiLinkAllowPublicUpload(),
            'allowViewWithoutDownload' => $this->shareManager->allowViewWithoutDownload(),
            'talkEnabled' => $this->appManager->isEnabledForUser('spreed'),
        ]);
    }
}
