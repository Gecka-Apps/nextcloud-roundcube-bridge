# RoundCube Bridge

[![GitHub release](https://img.shields.io/github/v/release/Gecka-Apps/nextcloud-roundcube-bridge)](https://github.com/Gecka-Apps/nextcloud-roundcube-bridge/releases)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Nextcloud](https://img.shields.io/badge/Nextcloud-32+-0082c9?logo=nextcloud&logoColor=white)](https://nextcloud.com)
[![PHP](https://img.shields.io/badge/PHP-8.2+-777BB4?logo=php&logoColor=white)](https://php.net)

A Nextcloud app that provides a communication bridge between RoundCube (embedded via the `mail_roundcube` app) and Nextcloud services.

## Features

- **Attach files from Nextcloud** - Pick files from your Nextcloud storage and attach them to emails
- **Save attachments to Nextcloud** - Save email attachments directly to your Nextcloud files
- **Insert share links** - Create and insert public share links into your emails
- **Calendar integration** - Add calendar invitations (.ics files) directly to your Nextcloud Calendar

## Requirements

- Nextcloud 32+
- PHP 8.2+
- [mail_roundcube](https://github.com/rotdrop/nextcloud-roundcube) app installed and configured
- [NextBridge](https://github.com/Gecka-Apps/NextBridge) plugin installed in RoundCube

## How It Works

The bridge uses `postMessage` API to communicate between Nextcloud and the RoundCube iframe:

1. **Bridge Client Injection** - When RoundCube loads in the iframe, the bridge injects a `NextcloudBridge` JavaScript object
2. **RoundCube Plugin** - The NextBridge plugin in RoundCube uses this object to request file operations
3. **Nextcloud Handlers** - The bridge app handles these requests using Nextcloud's APIs (WebDAV, CalDAV, OCS Sharing)

```
┌────────────────────────────────────────────────────────────┐
│                    Nextcloud                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                mail_roundcube_bridge                │   │
│  │  ┌─────────────┐    postMessage    ┌─────────────┐  │   │
│  │  │  Vue App    │◄──────────────────│ Injected    │  │   │
│  │  │  (Bridge)   │                   │ Client      │  │   │
│  │  └──────┬──────┘                   └──────┬──────┘  │   │
│  └─────────┼────────────────────────────────┼──────────┘   │
│            │                                │              │
│     WebDAV/CalDAV                    ┌──────┴──────┐       │
│     OCS APIs                         │  RoundCube  │       │
│                                      │  (iframe)   │       │
│                                      │  NextBridge │       │
│                                      │   plugin    │       │
│                                      └─────────────┘       │
└────────────────────────────────────────────────────────────┘
```

## API Reference

The injected `NextcloudBridge` object provides:

```javascript
// Files
NextcloudBridge.pickFiles({ multiple: true, mimeTypes: ['image/*'] })
NextcloudBridge.saveFile(filename, base64Content, mimeType)
NextcloudBridge.saveFiles([{ filename, content, mimeType }])
NextcloudBridge.createShareLink()

// Calendar
NextcloudBridge.getCalendars()
NextcloudBridge.addToCalendar(calendarUrl, icsContent)

// Utils
NextcloudBridge.blobToBase64(blob)
NextcloudBridge.base64ToBlob(base64, mimeType)
```

## Installation

### From App Store

1. Go to Nextcloud Apps or visit the [App Store page](https://apps.nextcloud.com/apps/mail_roundcube_bridge)
2. Search for "RoundCube Bridge"
3. Click Install

### Manual Installation

```bash
cd /path/to/nextcloud/apps
git clone https://github.com/Gecka-Apps/nextcloud-roundcube-bridge mail_roundcube_bridge
cd mail_roundcube_bridge
make build
```

Then enable the app in Nextcloud settings.

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install

# Development build (with source maps)
make dev

# Production build (minified)
make build

# Watch mode (auto-rebuild on changes)
make watch
```

### Code Quality

```bash
# PHP CodeSniffer
make phpcs

# PHP Mess Detector
make phpmd
```

### Available Make Targets

| Target      | Description                                      |
|-------------|--------------------------------------------------|
| `help`      | Show available targets                           |
| `build`     | Build production assets                          |
| `dev`       | Build development assets                         |
| `watch`     | Build and watch for changes                      |
| `phpcs`     | Run PHP CodeSniffer                              |
| `phpmd`     | Run PHP Mess Detector                            |
| `appstore`  | Create app store package                         |
| `clean`     | Remove build artifacts                           |
| `distclean` | Remove build artifacts and dependencies          |

## License

This app is released under the [GNU Affero General Public License Version 3](https://www.gnu.org/licenses/agpl-3.0.html).

## Authors

- **Laurent Dinclaux** <laurent@gecka.nc> - Gecka

## Related Projects

- [mail_roundcube](https://github.com/rotdrop/nextcloud-roundcube) - Nextcloud app that embeds RoundCube
- [NextBridge](https://github.com/Gecka-Apps/NextBridge) - RoundCube plugin that uses this bridge

---

Built with 🥥 and ☕ by [Gecka](https://gecka.nc) — Kanaky-New Caledonia 🇳🇨
