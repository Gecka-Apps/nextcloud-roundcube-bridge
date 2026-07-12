# 🪸 Nextbridge Connector

Reusable building blocks for **Nextcloud connector apps** — the shared server-side
(PHP / OCP) and frontend (Vue 3) foundation behind the Nextbridge connectors that
integrate email clients with Nextcloud.

It is **Nextcloud-only** (the PHP depends on `OCP\…`, the frontend on
`@nextcloud/vue`) but **client-agnostic**: the same code backs the Roundcube and
Thunderbird connectors, and can back any other.

## Modules

| Namespace | Provides |
|---|---|
| `Gecka\Nextcloud\Nextbridge\Connector\Share` | Public share link creation + consolidated sharing config |
| `Gecka\Nextcloud\Nextbridge\Connector\Calendar` | ICS parsing, event preview, CalDAV import |
| `Gecka\Nextcloud\Nextbridge\Connector\Talk` | Talk (spreed) room creation over OCS |
| `Gecka\Nextcloud\Nextbridge\Connector\Files` | File picker / save helpers |

The frontend counterpart lives under `src/` (Vue 3 components and composables),
exposing a neutral `submit` / `cancel` interface so each connector wires its own
transport (iframe bridge, popup pages, …).

## Installation

The library is vendored into each connector app with
[git-subrepo](https://github.com/ingydotnet/git-subrepo), so the app stays
self-contained (nothing extra to fetch when it is packaged or symlinked):

```sh
git subrepo clone git@github.com:Gecka-Apps/nextbridge-connector.git connector -b main
```

This drops the library under `connector/` in the app (PHP in `connector/lib/`,
frontend in `connector/src/`). Pull upstream changes with `git subrepo pull
connector`; push local edits back with `git subrepo push connector`.

Alternatively, once published on Packagist:

```sh
composer require gecka/nextbridge-connector
```

## Usage

### PHP autoloading

Nextcloud only auto-maps an app's own `OCA\<AppId>` namespace to `lib/`. Register
the shared namespace in your app's `Application::register()`:

```php
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
```

### Backend — expose an endpoint

Controllers are shipped as base classes. Subclass one in your OCA namespace and
wire a route to it — dependency injection resolves the inherited constructor:

```php
namespace OCA\MyConnector\Controller;

use Gecka\Nextcloud\Nextbridge\Connector\Share\ShareController as BaseShareController;

class ShareController extends BaseShareController {
}
```

```php
// appinfo/routes.php
['name' => 'share#create', 'url' => '/api/share', 'verb' => 'POST'],
```

Apps loaded over Basic Auth (e.g. from a desktop client) can add
`#[NoCSRFRequired]` by overriding the method and delegating to `parent`.

### Frontend

```ts
import { createLogger } from '../connector/src/logger'

const logger = createLogger('[My Connector]')
```

Point your bundler at `connector/src` (e.g. add `connector/src/**/*.ts` to the
TypeScript `include`).

## Used by

- [`mail_roundcube_bridge`](https://github.com/Gecka-Apps) — Roundcube connector
- [`thunderbird_files_bridge`](https://github.com/Gecka-Apps) — Thunderbird connector

## License

AGPL-3.0-or-later — see [LICENSE](LICENSE).

---
Built with 🥥 and ☕ by [Gecka](https://gecka.nc) — Kanaky-New Caledonia 🇳🇨
