<?php

/**
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\MailRoundcubeBridge\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;
use OCP\Constants;
use OCP\Files\IRootFolder;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\IUserSession;
use OCP\Share\IManager as IShareManager;
use OCP\Share\IShare;
use Psr\Log\LoggerInterface;

/**
 * Share link creation API.
 *
 * Creates public share links for files with configurable options
 * (password, expiry, permissions, etc.).
 */
class ShareController extends Controller {
    private IShareManager $shareManager;
    private IRootFolder $rootFolder;
    private IUserSession $userSession;
    private IURLGenerator $urlGenerator;
    private LoggerInterface $logger;

    public function __construct(
        string $appName,
        IRequest $request,
        IShareManager $shareManager,
        IRootFolder $rootFolder,
        IUserSession $userSession,
        IURLGenerator $urlGenerator,
        LoggerInterface $logger,
    ) {
        parent::__construct($appName, $request);
        $this->shareManager = $shareManager;
        $this->rootFolder = $rootFolder;
        $this->userSession = $userSession;
        $this->urlGenerator = $urlGenerator;
        $this->logger = $logger;
    }

    /**
     * Create a public share link for a file.
     *
     * @NoAdminRequired
     *
     * @param string $path File path relative to user root.
     * @param string|null $password Optional share password.
     * @param string|null $expireDate Optional expiration date (Y-m-d).
     * @param string|null $label Optional share label.
     * @param string|null $note Optional note for the recipient.
     * @param bool|null $hideDownload Whether to hide the download button.
     * @param int|null $permissions Permission bitfield (default: read-only = 1).
     * @param bool|null $sendPasswordByTalk Whether to verify identity via Talk.
     *
     * @return JSONResponse
     */
    public function create(
        string $path,
        ?string $password = null,
        ?string $expireDate = null,
        ?string $label = null,
        ?string $note = null,
        ?bool $hideDownload = null,
        ?int $permissions = null,
        ?bool $sendPasswordByTalk = null,
    ): JSONResponse {
        $user = $this->userSession->getUser();
        if ($user === null) {
            return new JSONResponse(
                ['error' => 'Not authenticated'],
                Http::STATUS_UNAUTHORIZED
            );
        }

        $userId = $user->getUID();

        try {
            $userFolder = $this->rootFolder->getUserFolder($userId);
            $node = $userFolder->get($path);

            $share = $this->shareManager->newShare();
            $share->setNode($node);
            $share->setShareType(IShare::TYPE_LINK);
            $share->setPermissions(
                ($permissions !== null && $permissions > 0) ? $permissions : Constants::PERMISSION_READ
            );
            $share->setSharedBy($userId);

            if ($password !== null && $password !== '') {
                $share->setPassword($password);
            }

            if ($expireDate !== null && $expireDate !== '') {
                $share->setExpirationDate(new \DateTime($expireDate));
            }

            if ($label !== null && $label !== '') {
                $share->setLabel($label);
            }

            if ($note !== null && $note !== '') {
                $share->setNote($note);
            }

            if ($hideDownload === true) {
                $share->setHideDownload(true);
            }

            if ($sendPasswordByTalk === true) {
                $share->setSendPasswordByTalk(true);
            }

            $created = $this->shareManager->createShare($share);

            $url = $this->urlGenerator->linkToRouteAbsolute(
                'files_sharing.sharecontroller.showShare',
                ['token' => $created->getToken()]
            );

            $response = [
                'url' => $url,
                'token' => $created->getToken(),
            ];

            if ($password !== null && $password !== '') {
                $response['password'] = $password;
            }

            $expiration = $created->getExpirationDate();
            if ($expiration !== null) {
                $response['expireDate'] = $expiration->format('Y-m-d');
            }

            if ($label !== null && $label !== '') {
                $response['label'] = $label;
            }

            $createdNote = $created->getNote();
            if ($createdNote !== null && $createdNote !== '') {
                $response['note'] = $createdNote;
            }

            if ($created->getHideDownload()) {
                $response['hideDownload'] = true;
            }

            $response['permissions'] = $created->getPermissions();

            return new JSONResponse($response);
        } catch (\OCP\Files\NotFoundException $e) {
            return new JSONResponse(
                ['error' => 'File not found'],
                Http::STATUS_NOT_FOUND
            );
        } catch (\Exception $e) {
            $this->logger->error('Failed to create share link', [
                'exception' => $e,
                'path' => $path,
            ]);
            return new JSONResponse(
                [
                    'error' => 'Failed to create share link',
                    'detail' => $e->getMessage(),
                ],
                Http::STATUS_INTERNAL_SERVER_ERROR
            );
        }
    }
}
