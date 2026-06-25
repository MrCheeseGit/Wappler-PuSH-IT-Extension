/**
 * PuSH-IT service worker — copy to your Wappler public/ folder.
 *
 * Install (from your Wappler project root):
 *   cp ../Wappler-PuSH-IT-Extension/pushit_service_worker.js public/pushit_service_worker.js
 *
 * Register from your subscribe page (not a <script src> — use register()):
 *   navigator.serviceWorker.register('/pushit_service_worker.js', { scope: '/' })
 *
 * Handles payloads from PuSH-IT Send (title, body, url, icon, tag, data).
 * Already have a service worker? Copy the push + notificationclick listeners into it.
 */

const PUSH_IT_SW_VERSION = '1.0.0';
const PUSH_IT_DEFAULT_TITLE = 'Notification';
const PUSH_IT_DEFAULT_URL = '/';
const PUSH_IT_DEFAULT_TAG = 'pushit';
const PUSH_IT_NOTIFY_PAGE = true; // postMessage to open tabs for debugging; set false in production if you prefer

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

function postToClients(message, extra) {
    if (!PUSH_IT_NOTIFY_PAGE) return Promise.resolve();
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
            client.postMessage({
                source: 'pushit-service-worker',
                version: PUSH_IT_SW_VERSION,
                message,
                extra: extra || null,
            });
        });
    });
}

function parsePushPayload(event) {
    if (!event.data) {
        return {
            title: PUSH_IT_DEFAULT_TITLE,
            body: '',
        };
    }

    try {
        return event.data.json();
    } catch {
        const text = event.data.text();
        try {
            return JSON.parse(text);
        } catch {
            return {
                title: PUSH_IT_DEFAULT_TITLE,
                body: text || '',
            };
        }
    }
}

self.addEventListener('push', (event) => {
    const payload = parsePushPayload(event);
    const title = payload.title || PUSH_IT_DEFAULT_TITLE;
    const body = payload.body || '';
    const clickUrl =
        payload.url ||
        (payload.data && typeof payload.data === 'object' && payload.data.url) ||
        PUSH_IT_DEFAULT_URL;

    const options = {
        body,
        tag: payload.tag || PUSH_IT_DEFAULT_TAG,
        renotify: true,
        data: { url: clickUrl },
    };

    if (payload.icon) {
        options.icon = payload.icon;
    }

    event.waitUntil(
        (async () => {
            await postToClients('push event received', { title, body });
            try {
                await self.registration.showNotification(title, options);
                await postToClients('notification shown', { title });
            } catch (error) {
                await postToClients('showNotification failed: ' + (error.message || error));
                await self.registration.showNotification(PUSH_IT_DEFAULT_TITLE, {
                    body: body || 'You have a new notification.',
                    tag: PUSH_IT_DEFAULT_TAG + '-fallback',
                    renotify: true,
                    data: { url: clickUrl },
                });
            }
        })()
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || PUSH_IT_DEFAULT_URL;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});
