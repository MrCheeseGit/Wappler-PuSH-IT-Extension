# PuSH-IT Extension 

> ## ⚠️ NPM users — please read first (important)
>
> Mr Cheese extensions were built for **Git copy install** first. Wappler's **npm** lane (Project Settings → Extensions) puts the package in `node_modules` but **does not automatically copy** Server Connect modules, App Connect JS/CSS, or other files into your project folders. **Project Updater alone is not enough.**
>
> **If you use npm, follow the full [npm install](#npm-install-wappler-project-settings) section below.** Quick summary:
>
> 1. Add this extension in **Wappler → Project Settings → Extensions**, then run **`npm install`** in your project root.
> 2. **Verify** the package landed: `ls node_modules/wappler-push-it/package.json` (if this fails, fix registration before copying anything).
> 3. Run the copy script from the **[Mr Cheese npm install assistant](https://www.mrcheese.co.uk/extensions/install/npm)** — choose **Both** — into `extensions/`, `lib/modules/`, and `public/`.
> 4. Run **Project Updater → Update** after copying.
> 5. **Quit Wappler completely** (including the tray icon) and reopen your project.
>
> Mr Cheese is working on a combined solution and has proposed **[`wappler-install.json`](https://github.com/MrCheeseGit/Wappler-Git-Extension-Manifest-Standard)** so install tools (and hopefully Wappler itself) can deploy extensions the same way from Git or npm. Until then, sorry for the extra steps — this is one reason these extensions were never intended to rely on npm alone.
>
> **Prefer Git?** Use the [Git Extension Installer](https://www.mrcheese.co.uk/extensions/install) — the most complete path, no npm required.

Web Push notifications for **Wappler Server Connect (Node)** using **VAPID** — **no paid push API**, no Firebase project, no per-message fees. Browsers use Google/Mozilla push services for free; you only host your own keys and subscription rows.

- **Prepare** — parse browser subscription JSON into flat fields for native **Database Insert**
- **Send** — notify one subscription or a **query result set** (query-first, like ClickSend / Wap-Lastic)
- **Subscribe UI** — App Connect component with optional **database-led status** (`status-url`) for per-user green/red on reload — **[read this first for portals](#subscription-status--per-user-ui-critical)**

Browser-only in v1.0 (no Capacitor / native FCM / APNs). Optional **ClickSend SMS** works as a **separate** extension step — see [examples/notify-with-sms-fallback.json](examples/notify-with-sms-fallback.json).

### Extension repo conventions

This repository is a **generic product** for any Wappler project. Docs, comments, and examples use **placeholder names only** — e.g. `userProfile`, `yourPortal`, `getUser` — never a specific client app, private route, or real install UUID. Consumer projects (portals, APIs, security providers) wire their own names in their own repos.

---

## Install

Pick **one** install path and follow it completely:

| Path | Best for |
|------|----------|
| **Git** (recommended) | Most reliable; uses `git clone` + copy from the repo |
| **npm** | You already use Wappler Project Settings → Extensions |

Both paths copy files into `extensions/`, `lib/modules/`, and `public/`. The npm path also requires verifying `node_modules/wappler-push-it` exists **before** you run any copy commands. PuSH-IT needs **Both** Server Connect and App Connect.

### Git install — Extension Installer (recommended)

This repo ships **`wappler-install.json`** at the root — a machine-readable install map (copy paths, folders, and post-install notes) for tools that understand the [Git extension manifest standard](https://www.mrcheese.co.uk/extensions/manifest-builder).

**Quickest path:**

1. Open the **[Mr Cheese Extension Installer](https://www.mrcheese.co.uk/extensions/install)**.
2. Choose **Both** (Server Connect + App Connect) — PuSH-IT needs both layers.
3. Select **PuSH-IT** and leave **Use wappler-install.json from the repository** enabled.
4. Enter your Wappler project path, copy the generated scripts, run them locally, then follow the on-screen notes.

Manual copy steps below still work if you prefer.

### Manual install (Git) — Server Connect

Run from your **Wappler project root** (the folder that contains `package.json`). Skip `git clone` if you already have this repo cloned alongside your project.

```bash
git clone https://github.com/MrCheeseGit/Wappler-PuSH-IT-Extension.git ../Wappler-PuSH-IT-Extension

cp ../Wappler-PuSH-IT-Extension/server_connect/modules/pushit.js lib/modules/pushit.js
cp ../Wappler-PuSH-IT-Extension/server_connect/modules/pushit.js extensions/server_connect/modules/pushit.js
cp ../Wappler-PuSH-IT-Extension/server_connect/modules/pushit_prepare.hjson extensions/server_connect/modules/
cp ../Wappler-PuSH-IT-Extension/server_connect/modules/pushit_send.hjson extensions/server_connect/modules/
cp ../Wappler-PuSH-IT-Extension/server_connect/modules/pushit_deactivate.hjson extensions/server_connect/modules/
cp ../Wappler-PuSH-IT-Extension/server_connect/modules/pushit_service_worker.js public/pushit_service_worker.js
```

### Manual install (Git) — App Connect (Subscribe component)

Copy manually from your **Wappler project root** (or use the Git Extension Installer with **Both**):

```bash
git clone https://github.com/MrCheeseGit/Wappler-PuSH-IT-Extension.git ../Wappler-PuSH-IT-Extension

cp ../Wappler-PuSH-IT-Extension/app_connect/components.hjson extensions/app_connect/components/pushit_components.hjson
cp ../Wappler-PuSH-IT-Extension/includes/dmx-pushit-subscribe.js public/js/
cp ../Wappler-PuSH-IT-Extension/includes/dmx-pushit-subscribe.css public/css/
cp ../Wappler-PuSH-IT-Extension/includes/pushit_service_worker.js public/pushit_service_worker.js
```

Quit Wappler completely and reopen. Add **PuSH-IT Subscribe** from the **Mr Cheese** component group.

See [examples/pushit-subscribe-component.html](examples/pushit-subscribe-component.html).

**Copy `pushit.js` to both paths.** Wappler loads `extensions/server_connect/modules/` before `lib/modules/`; keeping both in sync avoids “works in IDE, wrong code in Docker” surprises.

**Copy `pushit_service_worker.js` to `public/`.** Web Push needs a service worker on your origin. PuSH-IT ships a ready-made file — you **register** it from JavaScript (there is no `<script src>` for service workers).

Restart the Wappler development server (or **redeploy** if you use WDP/Docker). Wappler installs `web-push` from the step `usedModules` metadata on first use.

### npm install (Wappler Project Settings)

Use this when you register the extension through **Wappler → Project Settings → Extensions**. The npm package registers PuSH-IT in Wappler but **does not copy runtime files** into your project folders.

1. **Register in Wappler** — Project Settings → Extensions → Add → enter `wappler-push-it` or this repository's GitHub URL.
2. **Install dependencies** — from your Wappler project root:
   ```bash
   npm install
   ```
3. **Verify before copying** (required):
   ```bash
   ls node_modules/wappler-push-it/package.json
   ```
   If this command fails, stop here. Fix `.wappler/project.json` registration or `npm install` before copying anything.
4. **Copy files** — open the **[npm install assistant](https://www.mrcheese.co.uk/extensions/install/npm)**, select **PuSH-IT**, choose **Both**, copy the generated script, and run it from your project root.
5. Run **Project Updater → Update** after the copy script.
6. **Quit Wappler completely** (tray icon too) and reopen your project.

#### Local `file:` development (optional)

```json
"devDependencies": {
  "wappler-push-it": "file:../path/to/PuSH-IT-Extension"
}
```

After you change extension source, run `npm install wappler-push-it` again, run the npm install assistant copy script, Project Updater, and restart Wappler.

---

## Environment variables (Wappler)

PuSH-IT reads credentials from **Wappler project environment** — not from files in the extension repo. Set them in the **Wappler project** where you install the extension (never commit keys to GitHub).

### Where to set them in Wappler

1. Open your **Wappler Node project** (the site that will send push, not the extension folder).
2. **Project Settings** (gear) → **Environment** — or select your **Target** (e.g. Development, DigitalOcean) → **Environment**.
3. Add each variable below. Use the **same names exactly** (case-sensitive).
4. Set values **per target** if Development and Production differ (local port vs live domain).
5. **Save**, then **restart** the dev server or **redeploy** (WDP/Docker) so `process.env` picks them up.

In Server Connect APIs, reference env in steps as `{{$_ENV.VARIABLE_NAME}}` — e.g. a `vapid_public` API with a Set Value step: `{{$_ENV.VAPID_PUBLIC_KEY}}`.

| Variable | Required | Description |
|----------|----------|-------------|
| `VAPID_PUBLIC_KEY` | Yes | Public key for `PushManager.subscribe()` in the browser |
| `VAPID_PRIVATE_KEY` | Yes | Server-only; never expose to the client or front-end |
| `VAPID_SUBJECT` | Yes | Contact URI — prefer your live site URL, e.g. `https://yoursite.com/` (not `localhost`) |
| `PUSH_IT_DEFAULT_ICON` | No | Default notification icon URL |
| `PUSH_IT_DEFAULT_URL` | No | Default click-through URL when Send step has no `url` |

**Security:** `VAPID_PRIVATE_KEY` stays server-side only. Expose **only** the public key to the browser (env in a read-only API or inline on the subscribe page).

### Generate VAPID keys

One-time, on your machine:

```bash
npx web-push generate-vapid-keys
```

Example output:

```
Public Key:
BGx…

Private Key:
abc…
```

- Paste **Public Key** → Wappler env `VAPID_PUBLIC_KEY`
- Paste **Private Key** → Wappler env `VAPID_PRIVATE_KEY`
- Set `VAPID_SUBJECT` → `https://your-production-domain.com/` (or `mailto:you@yoursite.com`)

VAPID is a free key pair — no Firebase project, no paid push API, no per-message fee.

### WDP / Docker note

If you deploy with **Wappler Deployment Pipeline (WDP)**, env vars may also live in the target’s **`.env`** / deploy config — keep Wappler **Environment** and deploy env **in sync** for each target. After changing env on a running container, **redeploy**; a simple file sync is not enough for env changes already baked into the image unless your compose mounts env at runtime.

### Quick test that env is loaded

Create a minimal API (or use your `vapid_public` step) and run it — response should include the public key string, not empty. If `pushit` send fails with *Missing VAPID_* env*, the server was not restarted/redeployed after saving Environment.

---

## Database: MySQL table

Create a table to store browser subscriptions. PuSH-IT does not create tables for you — run this once (also in [examples/sql/push_subscriptions.mysql.sql](examples/sql/push_subscriptions.mysql.sql)):

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  subscription_uuid CHAR(36) NOT NULL,
  endpoint VARCHAR(512) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_uuid VARCHAR(64) NULL COMMENT 'Portal user id, if logged in',
  entity_id VARCHAR(64) NULL COMMENT 'Scoped resource e.g. property id',
  event_types VARCHAR(255) NULL COMMENT 'Optional comma list: reservation,account',
  subscription_json TEXT NOT NULL COMMENT 'Full browser PushSubscription JSON backup',
  user_agent VARCHAR(512) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_date DATETIME NOT NULL,
  updated_date DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_subscriptions_endpoint (endpoint),
  KEY idx_push_subscriptions_entity_active (entity_id, active),
  KEY idx_push_subscriptions_active_id (active, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

| Column | Purpose |
|--------|---------|
| `endpoint` | Push service URL (unique per browser install) |
| `p256dh`, `auth` | Encryption keys for Web Push |
| `user_uuid` | Logged-in portal user (optional) |
| `entity_id` | Scoped resource — property, account, etc. |
| `event_types` | Optional filter, e.g. `reservation,account` |
| `subscription_json` | Full `PushSubscription` JSON backup |
| `active` | **`1`** = subscribed and eligible to receive push; **`0`** = opted out or expired (HTTP 410) |

**Important:** store and compare `active` as the **number `1` or `0`** in Wappler (MySQL `TINYINT`). Do **not** use boolean `true` / `false` in query rules — they often fail to match rows where the column is `1`.

**Subscribe pattern:** upsert on `endpoint` (update if the same browser re-subscribes; insert if new). Set `active = 1` on insert/update. Deactivate other `active` rows when a user re-enables on a new device if you only want one live subscription per scope.

**Per user:** each portal account has its own `user_uuid` and its own row(s). User A with `active = 1` sees “Notifications enabled”; User B with no row (or `active = 0`) sees “Enable notifications”. That is correct behaviour.

---

## Getting started checklist

A practical order that matches a first real install:

| Step | What to do |
|------|------------|
| 1 | Copy extension files (both `pushit.js` paths + HJSON) |
| 2 | Run the MySQL `CREATE TABLE` above |
| 3 | Generate VAPID keys; set env vars; restart server |
| 4 | **API** `vapid_public` — returns `{{$_ENV.VAPID_PUBLIC_KEY}}` for the browser |
| 5 | **API** `subscribe` — Prepare → Insert/Update; set `nocsrf: true` if posting JSON from the client |
| 6 | Copy **`pushit_service_worker.js`** to `public/` (see below) |
| 7 | **Subscribe UI** — drop **PuSH-IT Subscribe** (`dmx-pushit-subscribe`) on a portal page **or** hand-roll JS (see [App Connect](#app-connect--push-it-subscribe)) |
| 8 | **API** `subscription_status` + **`status-url`** on the component — see [Subscription status & per-user UI](#subscription-status--per-user-ui-critical) (strongly recommended for portals) |
| 9 | **API** `test` or production send — Query active rows → condition → PuSH-IT Send |
| 10 | **Redeploy** WDP/Docker after API or `public/` changes |

See [examples/subscribe-entity-scoped.json](examples/subscribe-entity-scoped.json) for the subscribe API shape.

---

## Typical flows

### 1. User opts in (subscribe API)

1. Browser page: service worker + `PushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
2. POST subscription JSON to your API (`Content-Type: application/json`)
3. **PuSH-IT Prepare Subscription** — bind `{{$_POST.subscription}}`, optional `entityId`, `userUUID`
4. **Database Insert** (or update on duplicate `endpoint`) — map `{{pushPrepare.endpoint}}`, `{{pushPrepare.p256dh}}`, `{{pushPrepare.auth}}`, `{{pushPrepare.subscriptionJson}}`, etc.

### 2. Staff creates a record → notify portal users

1. **Database Query** — `active = 1` and your scope (`entity_id`, `user_uuid`, …)
2. **PuSH-IT Send Notification** — mode **Send to query results**
3. Optional: deactivate rows where `results[].expired === true` (HTTP 410)

See [examples/notify-on-create.json](examples/notify-on-create.json).

### 3. SMS fallback (optional)

Run **ClickSend Send SMS** in a follow-up step for users without push. PuSH-IT does not call ClickSend — wire two steps in Wappler.

See [examples/notify-with-sms-fallback.json](examples/notify-with-sms-fallback.json).

---

## PuSH-IT Send — Wappler step settings

Common rookie pitfalls (from real installs):

### Set mode to **Send to query results**

If `mode` is missing, Send defaults to **single** and looks for one `subscription` field — you get `no_subscription` even when your query returned rows.

### Bind query output and use **column names**

| Option | Example |
|--------|---------|
| `sourceData` | `{{yourQuery}}` |
| `endpointColumn` | `endpoint` |
| `p256dhColumn` | `p256dh` |
| `authColumn` | `auth` |

Use the **column name** (`endpoint`), not only a picker value. The module accepts `{{query[0].endpoint}}` pickers too, but plain names are clearest in API JSON.

Either store **`subscription_json`** alone **or** the three columns `endpoint` + `p256dh` + `auth` — not both unless you know why.

### Query `LIMIT` in Wappler

For a dev “send test” API, limit to the newest row in the **query builder JSON**:

```json
"orders": [{ "table": "push_subscriptions", "column": "id", "direction": "desc" }],
"limit": 1
```

A `LIMIT` only in the raw `query` string is often **ignored** — Wappler builds SQL from the JSON object.

---

## Service worker (`pushit_service_worker.js`)

Web push notifications are **OS notifications** (Windows action centre, Ubuntu tray, macOS corner) — **not** in-page alerts like `alert()`.

PuSH-IT includes **[pushit_service_worker.js](pushit_service_worker.js)** — copy it to `public/` and register from your opt-in page:

```javascript
// On your subscribe / portal page — not a <script src> tag
const reg = await navigator.serviceWorker.register('/pushit_service_worker.js', {
  scope: '/',
});
await navigator.serviceWorker.ready;
```

The file handles:

- **`push`** — reads JSON from PuSH-IT Send (`title`, `body`, `url`, `icon`, `tag`, `data`)
- **`notificationclick`** — opens `url` (or focuses an open tab)
- Optional **`postMessage`** to the page (`source: 'pushit-service-worker'`) for test-page debugging — disable with `PUSH_IT_NOTIFY_PAGE = false` at the top of the file

Edit the constants at the top of `pushit_service_worker.js` if you want different default title, click URL, or notification tag.

**Already have a service worker?** Do not register two workers for the same scope. Copy the `push` and `notificationclick` listeners from `pushit_service_worker.js` into your existing `sw.js` instead.

**Redeploy** after copying to `public/` if you use Docker/WDP — static files are baked into the image unless your compose mounts `public/`.

**Ubuntu / GNOME:** **Do Not Disturb** blocks notification banners even when Chrome reports `notification shown`. Check system settings if the server log says `sent` but nothing appears.

---

## Testing

### Subscribe API

Wappler **API Run** often sends an **empty POST body**. Test subscribe with **curl** or a real browser page:

```bash
curl -X POST http://localhost:3000/api/pushNotifications/subscribe \
  -H 'Content-Type: application/json' \
  -d '{"subscription":{"endpoint":"https://fcm.googleapis.com/fcm/send/…","keys":{"p256dh":"…","auth":"…"}},"entityId":"test-1"}'
```

Fake endpoints from curl return **`410 Gone`** on send — that is expected. Use a **real browser subscription** for end-to-end notification tests.

### Send API

Build a test API from [examples/test-send.json](examples/test-send.json) (default **title** / **body**):

- **Title:** `Mr Cheese`
- **Body:** `I hope you are enjoying this extension.  Please Buy Me a Coffee if you can afford it.  Doing this really helps me to create further extensions like this one`

```bash
curl http://localhost:3000/api/pushNotifications/test
```

Interpret `pushSend.results[]`:

| `status` | Meaning |
|----------|---------|
| `sent` | FCM/push service accepted the message |
| `failed` | Often `410` = expired subscription — deactivate row |
| `no_subscription` | Send step could not read subscription data (check mode + columns) |

### Local notification test

Before debugging the server, call `registration.showNotification(...)` from your page (via the registered service worker). If that does not appear, fix **browser permission** and **OS Do Not Disturb** first.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `no_subscription`, empty `endpoint` in results | Send mode is **single**, or wrong column bindings | Set **fromQuery**, `sourceData`, column names |
| Subscribe works in browser, fails on second click | Duplicate `endpoint` insert | Upsert on `endpoint`; unique key on table |
| API `sent` but no popup | OS **Do Not Disturb** / Focus Assist | Disable DND; check notification centre |
| `sent` + SW log `notification shown`, still no popup | Same as above, or duplicate `tag` | Unique tag per test; minimize browser |
| `410` / `expired: true` | Dead subscription (fake curl row or user cleared site data) | Deactivate row; re-subscribe in browser |
| `pushit.js` syntax error in Docker only | Truncated or stale file in container | Copy full file to **both** paths; redeploy |
| New APIs 404 or redirect | Route not in running container | Redeploy WDP after adding `app/api/...` |
| Wappler API Run subscribe fails | No POST body | Use curl or browser page |
| Status API returns `0` / `1` only | Condition step with boolean output | Use query-only status API — see [Subscription status](#subscription-status--per-user-ui-critical) |
| Status API returns `{ findActive: { active: 1 } }` but UI errors | Old `dmx-pushit-subscribe.js` | Update to **v1.2.9+**; hard-refresh browser |
| Subscribed in DB, UI shows Enable after reload | No `status-url`, or `active = true` in query | Add `status-url`; filter **`active = 1`** (number) |
| User A enabled, User B incorrectly enabled too | Status query not scoped to session | Security provider + `user_uuid = {{identity}}` |

---

## Actions

### PuSH-IT Prepare Subscription (`pushit` / `prepare`)

**Input:** subscription JSON from the browser (usually `{{$_POST.subscription}}`).

**Output:** `endpoint`, `p256dh`, `auth`, `subscriptionJson`, `insertRow`, `rows[]`, plus optional passthrough fields.

### PuSH-IT Deactivate Subscription (`pushit` / `deactivate`)

**Input:** subscription JSON or `endpoint` from POST (same shape as subscribe).

**Output:** `endpoint`, `userUUID`, `entityId`, `valid` — bind to **Database Update** (`active = 0`).

See [examples/unsubscribe-api.json](examples/unsubscribe-api.json). Used by the App Connect component **Unsubscribe API** property.

### PuSH-IT Send Notification (`pushit` / `send`)

**Modes:**

- **Single subscription** — one JSON blob
- **Send to query results** — bind a prior query step; map subscription JSON column **or** `endpoint` + `p256dh` + `auth` columns

**Output:**

```json
{
  "success": true,
  "sent": 2,
  "failed": 0,
  "no_subscription": 0,
  "total": 2,
  "results": [
    { "userId": "…", "entityId": "…", "endpoint": "…", "status": "sent", "error": "", "expired": false }
  ]
}
```

`status` values: `sent`, `failed`, `no_subscription`.

---

## Browser subscribe (minimal sketch)

Expose `VAPID_PUBLIC_KEY` via a small read-only API (`vapid_public`). Register a service worker that handles `push` and `notificationclick`.

```javascript
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const reg = await navigator.serviceWorker.register('/pushit_service_worker.js', { scope: '/' });
const key = await fetch('/api/pushNotifications/vapid_public').then((r) => r.json());
const vapidKey = key.vapidPublic?.publicKey ?? key.vapidPublic ?? key.publicKey;

const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(vapidKey),
});

await fetch('/api/pushNotifications/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subscription: sub.toJSON(),
    entityId: 'your-scope-id',
  }),
});
```

---

## App Connect — PuSH-IT Subscribe

**v1.2+** · Component **`dmx-pushit-subscribe`** in the **Mr Cheese** group (search “push” or “subscribe”).

Opt-in UI without hand-written subscribe JavaScript: registers `pushit_service_worker.js`, fetches your VAPID public key API, subscribes via `PushManager`, POSTs to your subscribe API, and restores existing browser subscriptions on page load.

### Install

**Recommended:** Wappler **Project Settings → Extensions** → add `wappler-push-it` (npm), quit/reopen Wappler, run **Project Updater** so `copyFiles` / `linkFiles` sync JS, CSS, and the service worker.

**Manual:** copy `app_connect/` + `public/js` / `public/css` as in [Install](#app-connect-subscribe-component) above; register the extension in `.wappler/project.json` if the picker stays empty.

Reference page: [examples/pushit-subscribe-component.html](examples/pushit-subscribe-component.html). Authoring guide: [creating-app-connect-extensions.md](../creating-app-connect-extensions.md).

### Drop on a page

```html
<dmx-pushit-subscribe
  id="pushSubscribe"
  vapid-public-url="/api/pushNotifications/vapid_public"
  subscribe-url="/api/pushNotifications/subscribe"
  unsubscribe-url="/api/pushNotifications/unsubscribe"
  status-url="/api/pushNotifications/subscription_status"
  service-worker-url="/pushit_service_worker.js"
  dmx-bind:user-uuid="currentUser.data.uuid"
  dmx-bind:entity-id="currentUser.data.subscriptionId"
  event-types="admin"
  dmx-on:success='notifications.success("Browser notifications enabled.")'
  dmx-on:unsubscribed='notifications.info("Browser notifications turned off.")'
  dmx-on:error="notifications.danger(pushSubscribe.data.error)"
></dmx-pushit-subscribe>
```

**`status-url`** + **`user-uuid`** are what make the green/red dot follow **your database** on every page load (not just the browser’s last click). See [Subscription status & per-user UI](#subscription-status--per-user-ui-critical).

Use **one instance per page** — multiple components share a single browser subscription and will fight over UI state.

### User feedback (toasts / notifications)

The extension does **not** ship toast UI — it only fires **events** (`success`, `unsubscribed`, `error`, etc.). You wire feedback in your own layout or page.

1. Add a Wappler feedback component to your **layout** (or parent page), e.g.  
   `<dmx-notifications id="notifications" position="top-end" closable="true"></dmx-notifications>`  
   or Bootstrap toasts: `<div is="dmx-bs5-toasts" id="toasts" position="top-end"></div>`  
   Enable the matching extension in Project Settings (`dmxNotifications` and/or `dmxBootstrap5Toasts`).
2. On `dmx-pushit-subscribe`, wire **dmx-on** handlers to that component, e.g.  
   `dmx-on:success='notifications.success("Saved")'`  
   Use **single quotes** on the attribute when the message is in double quotes — nested `"` inside `dmx-on="…"` breaks the HTML attribute.
3. Alternatively use `toasts.showSimple({message: '…'})` on `#toasts`, or register your own `dmx.Actions` action if you need a project-specific helper.

i18n: bind label attributes (`subscribed-text`, `denied-text`, …) or bake copy server-side; wire toast messages the same way (static strings, `dmx-bind`, or server-rendered `dmx-on` values).

### UI states

| `data.status` | What the user sees |
|---------------|-------------------|
| `idle` / after unsubscribe | Red dot · “Notifications disabled” · small **Enable** button |
| `subscribed` | Green dot · “Notifications enabled” · **Turn off notifications** |
| `denied` | Red dot · “Notifications disabled” only (browser blocked permission) |
| `loading` | Working… on the action button |
| `unsupported` / `error` | Enable button + alert card when relevant |

Preview in a **real browser** (HTTPS or localhost). The design canvas is not a secure push context — the button may look wrong there.

### Properties (main)

| Property | Attribute | Notes |
|----------|-----------|--------|
| VAPID public key API | `vapid-public-url` | Route picker → read-only key API |
| Subscribe API | `subscribe-url` | Prepare → Insert/Update (`active = 1`) |
| Unsubscribe API | `unsubscribe-url` | Deactivate → `active = 0` |
| **Subscription status API** | **`status-url`** | Database query for this user’s active row — see [below](#subscription-status--per-user-ui-critical) |
| Service worker URL / scope | `service-worker-url`, `service-worker-scope` | Default `/pushit_service_worker.js`, `/` |
| **User UUID** | `user-uuid` | **`dataBindings: true`** — use expression picker → `dmx-bind:user-uuid` |
| **Entity ID** | `entity-id` | Same — e.g. property or account scope |
| Event types | `event-types` | Optional, sent as `eventTypes` in POST |
| Enable / unsubscribe button | `button-text`, `unsubscribe-text` | **`dataBindings: true`** (v1.2.7+) |
| Subscribed / inactive status | `subscribed-text`, `denied-text` | Green dot / red dot labels — **`dataBindings: true`** |
| Unsupported | `unsupported-text` | Shown on the enable button when push is unavailable |
| Show unsubscribe | `show-unsubscribe` | Default `true` |

### i18n (labels and status dots)

| UI | Property | Attribute |
|----|----------|-----------|
| Green dot + label (subscribed) | **Subscribed status text** | `subscribed-text` |
| Red dot + label (idle, after unsubscribe, or browser denied) | **Inactive status text** | `denied-text` |
| Enable button | **Enable button text** | `button-text` |
| Turn off button | **Unsubscribe button text** | `unsubscribe-text` |

**Server-rendered copy (EJS, etc.):** set static attributes at render time, e.g. `subscribed-text="<%= t.push.enabled %>"`. Static values win over `dmx-bind:` on the same attribute.

**App Connect bindings:** use the expression picker on any label property (v1.2.7+), e.g. `dmx-bind:subscribed-text="myLocale.push.enabledLabel"`. Labels re-resolve on each render when bound data changes.

Subscribe POST context (`user-uuid`, `entity-id`) still uses the stricter `readContextField()` rules from v1.2.6 — do not mix those with label binding behaviour.

### Data bindings (important)

**User UUID** and **Entity ID** must be **bound values**, not literal path strings.

| Correct | Wrong |
|---------|--------|
| `dmx-bind:user-uuid="userProfile.data.getUser.uuid"` | `user-uuid="userProfile.data.getUser.uuid"` |
| `user-uuid="literal-id"` (static only, no `dmx-bind` on the same attr) | **Both** `dmx-bind:user-uuid="…"` **and** `user-uuid="…"` on one element |

Use the **expression picker** for dynamic values, **or** type a static value (Wappler should not leave both bind + static on the same attribute). v1.2.6+ uses the static attribute when present; otherwise evaluates `dmx-bind:` live at subscribe click time.

POST body shape: `{ subscription, entityId?, userUUID?, eventTypes? }` — same as manual subscribe JS.

### Methods, data, events

| | |
|--|--|
| **Methods** | `subscribe()`, `unsubscribe()`, `refresh()` |
| **Data** | `{{pushSubscribe.data.status}}`, `subscribed`, `endpoint`, `error`, `permission`, `loading` |
| **Events** | `success`, `subscribed`, `unsubscribed`, `denied`, `error` |

Wire events under the component’s **PuSH-IT Subscribe** group in App Connect (e.g. `notifications.success(…)` on `success` / `unsubscribed`). `dmx-on` only sees App Connect component methods and registered `dmx.Actions` — not arbitrary `window` helpers unless you register them.

### Server APIs to pair with the component

| API | Server Connect steps |
|-----|---------------------|
| `vapid_public` | Set Value → `{{$_ENV.VAPID_PUBLIC_KEY}}` |
| `subscribe` | PuSH-IT **Prepare** → Database Insert/Update on `endpoint` |
| `unsubscribe` | PuSH-IT **Deactivate** → Database Update `active = 0` |
| `subscription_status` | Security provider → Database Query — full walkthrough in [Subscription status](#subscription-status--per-user-ui-critical) |

Examples: [subscribe-entity-scoped.json](examples/subscribe-entity-scoped.json), [unsubscribe-api.json](examples/unsubscribe-api.json), [subscription-status-api.json](examples/subscription-status-api.json). Set `nocsrf: true` on subscribe/unsubscribe/status if posting JSON from the browser.

---

## Subscription status & per-user UI (CRITICAL)

If you ship PuSH-IT on a **logged-in portal**, read this section. It explains how the green/red dot stays correct **per user** after reload, and how to build the status API in Wappler without fighting the designer.

### The problem without `status-url`

Without a status API, the component only knows what the **browser** last did in this session. After reload, or on a second user account, the UI can disagree with your database — e.g. green “enabled” while `active = 0`, or “Enable notifications” while the user already subscribed yesterday.

**Fix:** wire **`status-url`** and a small read-only API that checks `push_subscriptions` for the **logged-in user**.

### Three APIs, three jobs

| API | When it runs | What it does | `active` column |
|-----|----------------|--------------|-----------------|
| **`subscribe`** | User clicks **Enable** | Insert or update row from browser subscription | Set **`1`** |
| **`unsubscribe`** | User clicks **Turn off** | Deactivate row(s) for that endpoint/user | Set **`0`** |
| **`subscription_status`** | **Every page load** (component bootstrap) | **Read only** — is this user subscribed? | Filter **`= 1`** in WHERE |

**Do not** block the subscribe API with a condition like “only if not already subscribed”. Let subscribe **always write**. Use the **status** API and send APIs to **read** the truth.

### Per-user behaviour (expected)

Push is **per portal user** and **per browser**:

- **User A** has a row with `user_uuid = their id` and `active = 1` → green dot, “Notifications enabled”.
- **User B** has no row (or `active = 0`) → red dot, **Enable notifications** button.
- Same person, new browser → subscribe again; upsert on `endpoint` updates the row.

The status API must filter by **session identity** (e.g. `{{yourPortal.identity}}`), not a hard-coded UUID.

### Build `subscription_status` in Wappler (step by step)

1. **New Server Connect API** — e.g. `/api/pushNotifications/subscription_status`.
2. **Settings** → enable **`nocsrf`** (component POSTs JSON from the browser).
3. **Step 1 — Security provider** for your portal (same provider as other logged-in APIs).
4. **Step 2 — Database Query** (single row):
   - Table: `push_subscriptions`
   - Columns: `endpoint`, `user_uuid`, `active` (optional but useful for debugging)
   - WHERE **`user_uuid`** `=` **`{{yourPortal.identity}}`** (match your security provider’s identity field)
   - WHERE **`active`** `=` **`1`** — type **number**, value **`1`** (not boolean `true`)
   - Limit: `1`
5. **Turn Output ON** for this query step.

   In the Wappler API designer you **need Output enabled** on the database step to see the step result when you test the API. That is normal. **v1.2.9+** of the component is built for this shape — you do **not** need an extra Set Value or Condition step unless you want a custom JSON format.

6. **Save** and restart/redeploy the Node server.

Full example flow: [examples/subscription-status-api.json](examples/subscription-status-api.json).

### What the API returns (and what the component expects)

**Recommended (Wappler query with Output ON)** — step name e.g. `findActive`:

```json
{
  "findActive": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/…",
    "user_uuid": "8cdf3466-1688-4e86-8842-42b9834b46db",
    "active": 1
  }
}
```

| `findActive` contents | Meaning | UI |
|------------------------|---------|-----|
| `active` is **`1`** (and/or `endpoint` present) | Subscribed in DB | Green · “Notifications enabled” |
| Empty object `{}` or no `endpoint` | Not subscribed | Red · **Enable notifications** |

**Also accepted (optional custom shape):**

```json
{ "subscribed": true, "endpoint": "https://fcm.googleapis.com/fcm/send/…" }
```

```json
{ "subscribed": false }
```

The component (v1.2.9+) interprets **`active: 1`** as subscribed. You do **not** need to map the row to `subscribed: true` yourself unless you prefer that response style.

### Wire the component

| Property | Attribute | Required |
|----------|-----------|----------|
| Status API | `status-url="/api/pushNotifications/subscription_status"` | Yes, for DB-led UI. Use the **web path** `/api/...` (not a filesystem path). v1.2.10+ normalizes Wappler route-picker paths automatically. |
| User id | `dmx-bind:user-uuid="userProfile.data.getUser.uuid"` | Yes — must match what you store in `user_uuid` on subscribe |
| Entity scope | `dmx-bind:entity-id="…"` | If you scope subscriptions |

On page load the component POSTs:

```json
{ "userUUID": "…", "entityId": "…", "endpoint": "…" }
```

The status API should still resolve the user from the **session** (`{{yourPortal.identity}}`). The POST `userUUID` is for your logging or extra validation; the query must not trust a spoofed UUID without matching the security provider.

**Load order:** bind `user-uuid` to a Server Connect that loads the profile. v1.2.12+ waits for the binding to become ready (no console errors while `userProfile` is still loading) and re-checks when `user-uuid` changes.

### Page load flow

```
Page load
  → component reads user-uuid binding
  → POST status-url
  → API: security provider + query (user_uuid = identity AND active = 1)
  → response findActive.active === 1 ?
       yes → green “Notifications enabled” (survives reload)
       no  → red “Enable notifications”
```

### Sending notifications (same table)

Before **PuSH-IT Send**, query `push_subscriptions` with the same rules (`active = 1`, your `user_uuid` / `entity_id` scope) → **condition** → Send only when rows exist. The extension does not auto-filter for you on send.

### Common mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| No `status-url` on component | Wrong UI after reload; second user looks “broken” | Add `status-url` + status API |
| Query uses `active = true` (boolean) | Always “not subscribed” though DB has `1` | Use **`active = 1`** (number) |
| `user_uuid` in DB ≠ session identity | Status says not subscribed after successful subscribe | Store `{{pushPrepare.userUUID}}` from same field as `dmx-bind:user-uuid` |
| Status API has no security provider | Wrong user’s row or no row | Add portal security provider; filter `{{identity}}` |
| Extra Condition with **Output type boolean** | API returns `0` or `1` instead of JSON | Remove it; use query Output only, or return `{ subscribed: true/false }` from a **Response** step |
| Turned Output **off** on query to “fix” API | Fine for runtime, but hard to debug in Wappler | Keep Output **on** on the query — component supports `findActive` wrapper (v1.2.9+) |
| Literal `user-uuid="profile.data…"` without `dmx-bind` | Wrong UUID stored on subscribe | Use expression picker → `dmx-bind:user-uuid` |

### Without `status-url` (legacy)

Omit `status-url` to keep **browser-only** UI: if `Notification.permission === 'granted'` and a push subscription exists in the browser, show enabled. Simpler, but **not** aligned with `push_subscriptions.active` after reload or across users. Portals should use **`status-url`**.

---

## Compatibility

Pairs with Redirect-IT on login flows. See [Mr Cheese extension docs](https://github.com/MrCheeseGit/Wappler-Extension-Docs/blob/main/extension-compatibility.md) for push step order and troubleshooting.

## License

[Mr Cheese Extension License v1.0](https://www.mrcheese.co.uk/extension-license) — see [LICENSE](LICENSE). © [Mr Cheese](https://www.mrcheese.co.uk)
