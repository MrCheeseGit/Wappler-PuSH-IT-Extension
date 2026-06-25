/**
 * PuSH-IT Subscribe — App Connect component
 * Registers service worker, subscribes via PushManager, POSTs to your subscribe API.
 */
(function () {
    'use strict';

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
    }

    function extractVapidKey(payload) {
        if (!payload || typeof payload !== 'object') return '';
        if (typeof payload === 'string') return payload.trim();
        return (
            payload.vapidPublic?.publicKey ||
            payload.vapidPublic ||
            payload.publicKey ||
            payload.data?.vapidPublic?.publicKey ||
            payload.data?.vapidPublic ||
            payload.data?.publicKey ||
            ''
        );
    }

    function isPushSupported() {
        return !!(
            typeof window !== 'undefined' &&
            window.isSecureContext &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window
        );
    }

    function isDesignView() {
        return !!(
            typeof document !== 'undefined' &&
            document.body &&
            (document.body.classList.contains('design-mode') ||
                document.body.classList.contains('wappler-design-mode'))
        );
    }

    function isPlaceholder(value) {
        return typeof value === 'string' && value.indexOf('@@') !== -1;
    }

    function propString(value, fallback) {
        if (value == null || value === '') return fallback;
        if (isPlaceholder(value)) return fallback;
        return String(value);
    }

    /** Wappler route picker may store /home/.../app/api/foo.json — convert to /api/foo */
    function normalizeApiUrl(url) {
        let path = unwrapLiteralQuotes(String(url == null ? '' : url)).trim();
        if (!path || isPlaceholder(path)) return '';

        if (path.startsWith('file://')) {
            try {
                path = decodeURIComponent(path.replace(/^file:\/\/+/, ''));
            } catch (_e) {
                path = path.replace(/^file:\/\/+/, '');
            }
            if (/^\/[A-Za-z]:\//.test(path)) {
                path = path.slice(1);
            }
        }

        const appApi = path.match(/\/app\/api\/(.+?)(?:\.json)?\/?$/i);
        if (appApi) {
            return '/api/' + appApi[1].replace(/\.json$/i, '');
        }

        if (path.startsWith('/api/')) {
            return path.replace(/\.json$/i, '');
        }
        if (/^api\//i.test(path)) {
            return '/' + path.replace(/\.json$/i, '');
        }

        if (path.endsWith('.json')) {
            path = path.slice(0, -5);
        }
        if (!path.startsWith('/') && !/^https?:\/\//i.test(path)) {
            path = '/' + path;
        }
        return path;
    }

    function resolveApiUrl(prop, fallback) {
        const normalized = normalizeApiUrl(propString(prop, fallback));
        if (normalized) return normalized;
        return normalizeApiUrl(fallback);
    }

    function propBool(value, fallback) {
        if (isPlaceholder(value)) return fallback;
        if (value === true || value === 'true' || value === '1') return true;
        if (value === false || value === 'false' || value === '0') return false;
        if (value == null || value === '') return fallback;
        return fallback;
    }

    function unwrapLiteralQuotes(value) {
        const text = String(value == null ? '' : value).trim();
        if (
            (text.startsWith("'") && text.endsWith("'")) ||
            (text.startsWith('"') && text.endsWith('"'))
        ) {
            return text.slice(1, -1);
        }
        return text;
    }

    function looksLikeBindingExpression(value) {
        return /^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)+$/.test(value);
    }

    function isSimpleDotBinding(expr) {
        return /^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)+$/.test(String(expr || '').trim());
    }

    function getReactiveKey(store, key) {
        if (store == null) {
            return undefined;
        }
        if (typeof store.get === 'function') {
            try {
                return store.get(key);
            } catch (_e) {
                return undefined;
            }
        }
        return store[key];
    }

    /**
     * Resolve a top-level binding id (e.g. userProfile) without dmx.parse.
     * dmx.parse on the root id throws while the server connect is still mounting.
     */
    function resolveBindingRoot(id) {
        if (!id || typeof dmx === 'undefined' || !dmx.app) {
            return { found: false, value: null };
        }

        if (typeof dmx.app.find === 'function') {
            const comp = dmx.app.find(id);
            if (comp && comp.data != null) {
                return { found: true, value: comp.data };
            }
        }

        const scoped = getReactiveKey(dmx.app.data, id);
        if (scoped != null) {
            return { found: true, value: scoped };
        }

        return { found: false, value: null };
    }

    function walkBindingPath(root, parts, startIndex) {
        let current = root;
        for (let i = startIndex; i < parts.length; i += 1) {
            const key = parts[i];
            if (current == null) {
                return { ready: false, value: '' };
            }
            current = getReactiveKey(current, key);
            if (i < parts.length - 1 && (current == null || current === '')) {
                return { ready: false, value: '' };
            }
        }
        if (current == null || current === '') {
            return { ready: true, value: '' };
        }
        return { ready: true, value: String(current).trim() };
    }

    /**
     * Resolve dmx-bind dot paths without dmx.parse (avoids Wappler errors.js spam).
     * Returns { ready: false } while the server connect or nested data is still loading.
     */
    function walkBindingExpression(expr) {
        const text = String(expr || '').trim();
        if (!text) {
            return { ready: false, value: '' };
        }

        if (!isSimpleDotBinding(text)) {
            if (typeof dmx === 'undefined' || typeof dmx.parse !== 'function' || !dmx.app) {
                return { ready: false, value: '' };
            }
            const root = resolveBindingRoot(text.split('.')[0]);
            if (!root.found) {
                return { ready: false, value: '' };
            }
            try {
                const live = dmx.parse(text, dmx.app, {});
                if (live == null || live === '') {
                    return { ready: true, value: '' };
                }
                return { ready: true, value: String(live).trim() };
            } catch (_e) {
                return { ready: false, value: '' };
            }
        }

        const parts = text.split('.');
        const root = resolveBindingRoot(parts[0]);
        if (!root.found) {
            return { ready: false, value: '' };
        }
        return walkBindingPath(root.value, parts, 1);
    }

    /**
     * Read userUuid / entityId / eventTypes for the subscribe POST.
     * 1. Static HTML attribute (user-uuid="…") wins when set — not shadowed by dmx-bind.
     * 2. Else live-evaluate dmx-bind:user-uuid at click time.
     * 3. Else props (no binding path strings — those are never POSTed).
     */
    function readContextField(component, htmlAttr, propName) {
        const node = component._node;
        const bindExpr = node ? (node.getAttribute('dmx-bind:' + htmlAttr) || '').trim() : '';
        const staticAttr = node ? (node.getAttribute(htmlAttr) || '').trim() : '';
        const fromProps = unwrapLiteralQuotes(propString(component.props[propName], ''));

        if (staticAttr && !isPlaceholder(staticAttr) && !looksLikeBindingExpression(staticAttr)) {
            return unwrapLiteralQuotes(staticAttr);
        }

        if (bindExpr) {
            const walked = walkBindingExpression(bindExpr);
            if (walked.ready && walked.value && !looksLikeBindingExpression(walked.value)) {
                return walked.value;
            }
            if (!walked.ready) {
                return '';
            }
        }

        if (fromProps && !isPlaceholder(fromProps) && !looksLikeBindingExpression(fromProps)) {
            return fromProps;
        }

        return '';
    }

    function readContextBindingState(component, htmlAttr) {
        const node = component._node;
        const bindExpr = node ? (node.getAttribute('dmx-bind:' + htmlAttr) || '').trim() : '';
        if (!bindExpr) {
            return { hasBinding: false, ready: true, value: '' };
        }
        const walked = walkBindingExpression(bindExpr);
        return {
            hasBinding: true,
            ready: walked.ready,
            value: walked.value,
        };
    }

    /**
     * Resolve user-visible label props (button text, status dots, etc.).
     * Static HTML attribute wins, then live dmx-bind, then props. Unlike POST
     * context fields, binding path strings are parsed for display when needed.
     */
    function readLabelField(component, htmlAttr, propName, fallback) {
        const node = component._node;
        const bindExpr = node ? (node.getAttribute('dmx-bind:' + htmlAttr) || '').trim() : '';
        const staticAttr = node ? (node.getAttribute(htmlAttr) || '').trim() : '';
        const fromProps = unwrapLiteralQuotes(propString(component.props[propName], ''));

        if (staticAttr && !isPlaceholder(staticAttr)) {
            return unwrapLiteralQuotes(staticAttr);
        }

        if (bindExpr) {
            const walked = walkBindingExpression(bindExpr);
            if (walked.ready && walked.value) {
                return walked.value;
            }
        }

        if (fromProps && !isPlaceholder(fromProps)) {
            if (looksLikeBindingExpression(fromProps)) {
                const walked = walkBindingExpression(fromProps);
                if (walked.ready && walked.value) {
                    return walked.value;
                }
            } else {
                return fromProps;
            }
        }

        return fallback;
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function isActiveFlag(value) {
        return value === 1 || value === true || value === '1';
    }

    function isInactiveFlag(value) {
        return value === 0 || value === false || value === '0';
    }

    function parseRowSubscription(row) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
        if (isActiveFlag(row.active)) return true;
        if (isInactiveFlag(row.active)) return false;
        return !!(row.endpoint && String(row.endpoint).trim());
    }

    function parseSubscribedStatus(payload) {
        if (payload === true || payload === 1 || payload === '1') return true;
        if (payload === false || payload === 0 || payload === '0') return false;
        if (!payload || typeof payload !== 'object') return null;

        // Wappler database step with Output enabled: { findActive: { endpoint, active: 1 } }
        if (Object.prototype.hasOwnProperty.call(payload, 'findActive')) {
            return parseRowSubscription(payload.findActive);
        }

        if (payload.data && typeof payload.data === 'object') {
            const nested = parseSubscribedStatus(payload.data);
            if (nested !== null) return nested;
        }

        if (typeof payload.subscribed === 'boolean') return payload.subscribed;
        if (isActiveFlag(payload.subscribed) || payload.subscribed === 'true') return true;
        if (isInactiveFlag(payload.subscribed) || payload.subscribed === 'false') return false;
        if (isActiveFlag(payload.active)) return true;
        if (isInactiveFlag(payload.active)) return false;
        if (payload.endpoint && String(payload.endpoint).trim()) return true;
        return null;
    }

    function extractStatusEndpoint(payload) {
        if (!payload || typeof payload !== 'object') return '';
        if (payload.findActive?.endpoint) return String(payload.findActive.endpoint).trim();
        if (payload.data?.endpoint) return String(payload.data.endpoint).trim();
        if (payload.endpoint) return String(payload.endpoint).trim();
        return '';
    }

    dmx.Component('pushit-subscribe', {
        initialData: {
            status: 'idle',
            permission: '',
            error: '',
            endpoint: '',
            loading: false,
            subscribed: false,
        },

        attributes: {
            vapidPublicUrl: { type: String, default: '/api/pushNotifications/vapid_public' },
            subscribeUrl: { type: String, default: '/api/pushNotifications/subscribe' },
            unsubscribeUrl: { type: String, default: '/api/pushNotifications/unsubscribe' },
            statusUrl: { type: String, default: '' },
            serviceWorkerUrl: { type: String, default: '/pushit_service_worker.js' },
            serviceWorkerScope: { type: String, default: '/' },
            entityId: { type: String, default: '' },
            userUuid: { type: String, default: '' },
            eventTypes: { type: String, default: '' },
            buttonText: { type: String, default: 'Enable notifications' },
            subscribedText: { type: String, default: 'Notifications enabled' },
            deniedText: { type: String, default: 'Notifications disabled' },
            unsupportedText: { type: String, default: 'Push not supported in this browser' },
            buttonClass: { type: String, default: 'btn btn-primary' },
            unsubscribeText: { type: String, default: 'Turn off notifications' },
            unsubscribeClass: { type: String, default: 'btn btn-outline-secondary btn-sm' },
            showUnsubscribe: { type: Boolean, default: true },
            hideWhenSubscribed: { type: Boolean, default: false },
            autoSubscribe: { type: Boolean, default: false },
            disabled: { type: Boolean, default: false },
        },

        methods: {
            subscribe() {
                return this._runSubscribe();
            },
            unsubscribe() {
                return this._runUnsubscribe();
            },
            refresh() {
                return this._bootstrap();
            },
        },

        events: {
            success: Event,
            error: Event,
            denied: Event,
            subscribed: Event,
            unsubscribed: Event,
        },

        init(node) {
            this._node = node;
            this._onClick = this._onClick.bind(this);
            this._onUnsubClick = this._onUnsubClick.bind(this);
            this._errorContext = '';
            this._lastStatusUserUuid = '';
            this._bootstrapPromise = null;
            this._bindingRetryCount = 0;
            this._bindingRetryMax = 8;
            this._bindingRetryTimer = null;
            this._render();
            const startBootstrap = () => this._scheduleBootstrap();
            if (typeof dmx !== 'undefined' && typeof dmx.nextTick === 'function') {
                dmx.nextTick(startBootstrap);
            } else {
                setTimeout(startBootstrap, 0);
            }
        },

        destroy() {
            this._clearBindingRetry();
            if (this._button) {
                this._button.removeEventListener('click', this._onClick);
            }
            if (this._unsubButton) {
                this._unsubButton.removeEventListener('click', this._onUnsubClick);
            }
        },

        _clearBindingRetry() {
            if (this._bindingRetryTimer) {
                clearTimeout(this._bindingRetryTimer);
                this._bindingRetryTimer = null;
            }
        },

        _hasStaticContextAttr(htmlAttr, propName) {
            const node = this._node;
            const staticAttr = node ? (node.getAttribute(htmlAttr) || '').trim() : '';
            if (staticAttr && !isPlaceholder(staticAttr) && !looksLikeBindingExpression(staticAttr)) {
                return true;
            }
            const fromProps = unwrapLiteralQuotes(propString(this.props[propName], ''));
            return !!(fromProps && !isPlaceholder(fromProps) && !looksLikeBindingExpression(fromProps));
        },

        _scheduleBootstrap() {
            this._clearBindingRetry();

            const statusUrl = resolveApiUrl(this.props.statusUrl, '');
            const userBinding = readContextBindingState(this, 'user-uuid');
            const needsProfileWait =
                statusUrl && userBinding.hasBinding && !this._hasStaticContextAttr('user-uuid', 'userUuid');

            if (needsProfileWait && !userBinding.ready) {
                if (this._bindingRetryCount < this._bindingRetryMax) {
                    const delay = Math.min(100 * Math.pow(2, this._bindingRetryCount), 800);
                    this._bindingRetryCount += 1;
                    this._bindingRetryTimer = setTimeout(() => this._scheduleBootstrap(), delay);
                    return;
                }
            }

            this._bindingRetryCount = 0;
            this._bootstrap();
        },

        performUpdate() {
            const statusUrl = resolveApiUrl(this.props.statusUrl, '');
            const userUuid = readContextField(this, 'user-uuid', 'userUuid');
            if (statusUrl && userUuid !== this._lastStatusUserUuid) {
                this._lastStatusUserUuid = userUuid;
                this._bootstrap();
                return;
            }
            this._render();
        },

        _setStatus(status, extra) {
            const patch = Object.assign({ status }, extra || {});
            Object.keys(patch).forEach((key) => this.set(key, patch[key]));
            this._render();
        },

        async _bootstrap() {
            if (this._bootstrapPromise) {
                return this._bootstrapPromise;
            }
            this._bootstrapPromise = this._bootstrapInner().finally(() => {
                this._bootstrapPromise = null;
            });
            return this._bootstrapPromise;
        },

        async _bootstrapInner() {
            if (isDesignView()) {
                this._setStatus('idle', { permission: '', error: '', subscribed: false });
                return;
            }
            if (!isPushSupported()) {
                this._setStatus('unsupported', { permission: '', error: '', subscribed: false });
                return;
            }

            const permission = Notification.permission || '';
            this.set('permission', permission);

            if (permission === 'denied') {
                this._setStatus('denied', { error: '', subscribed: false });
                return;
            }

            const statusUrl = resolveApiUrl(this.props.statusUrl, '');
            if (statusUrl) {
                await this._applyDatabaseSubscriptionStatus(statusUrl);
            } else if (permission === 'granted') {
                await this._restoreExistingSubscription();
            } else {
                this._setStatus('idle', { error: '', endpoint: '', subscribed: false });
            }

            if (propBool(this.props.autoSubscribe, false) && this.data.status === 'idle') {
                this._runSubscribe();
            }
        },

        async _applyDatabaseSubscriptionStatus(statusUrl) {
            const userBinding = readContextBindingState(this, 'user-uuid');
            const userUuid = readContextField(this, 'user-uuid', 'userUuid');
            this._lastStatusUserUuid = userUuid;

            if (!userUuid) {
                const showBindError =
                    userBinding.hasBinding && userBinding.ready && !userBinding.value;
                this._setStatus('idle', {
                    error: showBindError
                        ? 'Bind user-uuid so PuSH-IT can check subscription status in your database.'
                        : '',
                    endpoint: '',
                    subscribed: false,
                });
                return;
            }

            try {
                const body = Object.assign({}, this._buildPostContext());
                let browserEndpoint = '';
                try {
                    const subscription = await this._readBrowserSubscription();
                    if (subscription && subscription.endpoint) {
                        browserEndpoint = subscription.endpoint;
                        body.endpoint = browserEndpoint;
                    }
                } catch (_err) {
                    /* optional */
                }

                const res = await fetch(statusUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                if (!res.ok) {
                    throw new Error('Subscription status API failed (' + res.status + ')');
                }

                let payload = null;
                try {
                    payload = await res.json();
                } catch (_e) {
                    payload = null;
                }

                const subscribed = parseSubscribedStatus(payload);
                if (subscribed === null) {
                    throw new Error('Subscription status API did not return subscribed (true/false)');
                }

                const endpoint = extractStatusEndpoint(payload) || browserEndpoint || '';

                if (subscribed) {
                    this._setStatus('subscribed', {
                        loading: false,
                        endpoint,
                        error: '',
                        subscribed: true,
                    });
                } else {
                    this._setStatus('idle', {
                        loading: false,
                        endpoint: '',
                        error: '',
                        subscribed: false,
                    });
                }
            } catch (err) {
                const message = err && err.message ? err.message : String(err);
                this._errorContext = 'status';
                this._setStatus('error', {
                    loading: false,
                    error: message,
                    subscribed: false,
                });
            }
        },

        async _getRegistration() {
            const swUrl = propString(this.props.serviceWorkerUrl, '/pushit_service_worker.js');
            const scope = propString(this.props.serviceWorkerScope, '/');
            const registration = await navigator.serviceWorker.register(swUrl, { scope });
            await navigator.serviceWorker.ready;
            return registration;
        },

        async _readBrowserSubscription() {
            const registration = await this._getRegistration();
            return registration.pushManager.getSubscription();
        },

        async _restoreExistingSubscription() {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    const subscription = await this._readBrowserSubscription();
                    if (subscription) {
                        this._setStatus('subscribed', {
                            loading: false,
                            endpoint: subscription.endpoint || '',
                            error: '',
                            subscribed: true,
                        });
                        return;
                    }
                } catch (_err) {
                    /* retry */
                }
                if (attempt < 2) await delay(250);
            }
            this._setStatus('idle', { error: '', loading: false, endpoint: '', subscribed: false });
        },

        _render() {
            const host = this._node;
            if (!host) return;

            const status = this.data.status;
            const hideWhenSubscribed = propBool(this.props.hideWhenSubscribed, false);
            const hide =
                !isDesignView() &&
                hideWhenSubscribed &&
                (status === 'subscribed' || status === 'denied' || status === 'unsupported');

            host.classList.add('dmx-pushit-subscribe');
            host.classList.toggle('dmx-pushit-hidden', !!hide);

            if (!this._actionsEl) {
                this._actionsEl = document.createElement('div');
                this._actionsEl.className = 'dmx-pushit-actions';
                host.appendChild(this._actionsEl);

                this._idleEl = document.createElement('div');
                this._idleEl.className = 'dmx-pushit-idle';
                this._actionsEl.appendChild(this._idleEl);

                this._button = document.createElement('button');
                this._button.type = 'button';
                this._button.className = 'dmx-pushit-enable';
                this._button.addEventListener('click', this._onClick);
                this._idleEl.appendChild(this._button);

                this._activeEl = document.createElement('div');
                this._activeEl.className = 'dmx-pushit-active';
                this._actionsEl.appendChild(this._activeEl);

                this._subscribedRow = document.createElement('div');
                this._subscribedRow.className = 'dmx-pushit-status-row';
                this._activeEl.appendChild(this._subscribedRow);

                this._statusDot = document.createElement('span');
                this._statusDot.className = 'dmx-pushit-status-dot';
                this._statusDot.setAttribute('aria-hidden', 'true');
                this._subscribedRow.appendChild(this._statusDot);

                this._statusLabel = document.createElement('span');
                this._statusLabel.className = 'dmx-pushit-status-label';
                this._subscribedRow.appendChild(this._statusLabel);

                this._unsubButton = document.createElement('button');
                this._unsubButton.type = 'button';
                this._unsubButton.className = 'dmx-pushit-unsub';
                this._unsubButton.addEventListener('click', this._onUnsubClick);
                this._activeEl.appendChild(this._unsubButton);

                this._inactiveEl = document.createElement('div');
                this._inactiveEl.className = 'dmx-pushit-inactive';
                this._actionsEl.appendChild(this._inactiveEl);

                this._inactiveRow = document.createElement('div');
                this._inactiveRow.className = 'dmx-pushit-status-row';
                this._inactiveEl.appendChild(this._inactiveRow);

                this._inactiveDot = document.createElement('span');
                this._inactiveDot.className = 'dmx-pushit-status-dot dmx-pushit-status-dot--denied';
                this._inactiveDot.setAttribute('aria-hidden', 'true');
                this._inactiveRow.appendChild(this._inactiveDot);

                this._inactiveLabel = document.createElement('span');
                this._inactiveLabel.className = 'dmx-pushit-status-label';
                this._inactiveRow.appendChild(this._inactiveLabel);

                this._statusEl = document.createElement('div');
                this._statusEl.className = 'dmx-pushit-alert';
                this._statusEl.setAttribute('role', 'alert');
                this._statusEl.setAttribute('aria-live', 'polite');
                this._statusEl.hidden = true;
                host.appendChild(this._statusEl);
            }

            const showUnsubscribe = propBool(this.props.showUnsubscribe, true);
            const isSubscribed = status === 'subscribed';
            const isDenied = status === 'denied';
            const loading = this.data.loading;
            const showActive = isSubscribed && showUnsubscribe;
            const showInactive =
                !isDesignView() &&
                !showActive &&
                (status === 'idle' || status === 'denied' || status === 'loading');
            const showIdleOnly =
                isDesignView() || status === 'unsupported' || status === 'error';

            host.setAttribute('data-pushit-status', status);

            this._idleEl.classList.toggle('dmx-pushit-is-hidden', !showIdleOnly);
            this._activeEl.classList.toggle('dmx-pushit-is-hidden', !showActive);
            this._inactiveEl.classList.toggle('dmx-pushit-is-hidden', !showInactive);

            const subscribedLabel = readLabelField(
                this,
                'subscribed-text',
                'subscribedText',
                'Notifications enabled'
            );
            const inactiveLabel = readLabelField(
                this,
                'denied-text',
                'deniedText',
                'Notifications disabled'
            );
            const enableLabel = readLabelField(
                this,
                'button-text',
                'buttonText',
                'Enable notifications'
            );
            const unsupportedLabel = readLabelField(
                this,
                'unsupported-text',
                'unsupportedText',
                'Push not supported in this browser'
            );
            const unsubscribeLabel = readLabelField(
                this,
                'unsubscribe-text',
                'unsubscribeText',
                'Turn off notifications'
            );

            if (showActive) {
                this._statusLabel.textContent = subscribedLabel;
            }

            if (showInactive) {
                this._inactiveLabel.textContent = inactiveLabel;
                if (!isDenied) {
                    if (this._button.parentNode !== this._inactiveEl) {
                        this._inactiveEl.appendChild(this._button);
                    }
                    this._button.classList.remove('dmx-pushit-is-hidden');
                } else {
                    this._button.classList.add('dmx-pushit-is-hidden');
                }
            } else if (showIdleOnly) {
                if (this._button.parentNode !== this._idleEl) {
                    this._idleEl.appendChild(this._button);
                }
                this._button.classList.remove('dmx-pushit-is-hidden');
            }

            this._button.disabled =
                propBool(this.props.disabled, false) ||
                loading ||
                isDenied ||
                (!isDesignView() && status === 'unsupported');
            const buttonClass = propString(this.props.buttonClass, 'btn btn-primary') || 'btn btn-primary';
            const enableClass =
                showInactive && !isDenied
                    ? buttonClass + (buttonClass.indexOf('btn-sm') === -1 ? ' btn-sm' : '')
                    : buttonClass;
            this._button.className = 'dmx-pushit-enable ' + enableClass;

            let label = enableLabel;
            if (loading && !isSubscribed) label = 'Working…';
            else if (status === 'unsupported') {
                label = unsupportedLabel;
            } else if (status === 'error') {
                label = enableLabel;
            }
            this._button.textContent = label;

            this._unsubButton.disabled = propBool(this.props.disabled, false) || loading;
            this._unsubButton.className =
                'dmx-pushit-unsub ' +
                (propString(this.props.unsubscribeClass, 'btn btn-outline-secondary btn-sm') ||
                    'btn btn-outline-secondary btn-sm');
            this._unsubButton.textContent = loading ? 'Working…' : unsubscribeLabel;

            this._updateAlert(status, this.data.error);
        },

        _updateAlert(status, err) {
            const el = this._statusEl;
            if (!el) return;

            const alerts = {
                unsupported: {
                    variant: 'info',
                    icon: 'fa-circle-info',
                    title: 'Push not available here',
                    text: 'Open this page over HTTPS or localhost in Chrome, Firefox, or Edge to enable browser notifications.',
                },
            };

            if (status === 'error' && err) {
                let title = 'Something went wrong';
                if (this._errorContext === 'unsubscribe') {
                    title = 'Could not turn off notifications';
                } else if (this._errorContext === 'subscribe') {
                    title = 'Could not subscribe';
                } else if (this._errorContext === 'status') {
                    title = 'Could not load notification status';
                }
                this._fillAlert(el, 'danger', 'fa-triangle-exclamation', title, err);
                return;
            }

            if (status === 'denied') {
                el.hidden = true;
                el.className = 'dmx-pushit-alert';
                el.textContent = '';
                return;
            }

            if (status === 'idle' && err && resolveApiUrl(this.props.statusUrl, '')) {
                this._fillAlert(el, 'info', 'fa-circle-info', 'Subscription status', err);
                return;
            }

            const preset = alerts[status];
            if (preset) {
                this._fillAlert(el, preset.variant, preset.icon, preset.title, preset.text);
                return;
            }

            el.hidden = true;
            el.className = 'dmx-pushit-alert';
            el.textContent = '';
        },

        _fillAlert(el, variant, iconClass, title, text) {
            el.hidden = false;
            el.className = 'dmx-pushit-alert alert alert-' + variant;
            el.innerHTML =
                '<div class="dmx-pushit-alert__inner">' +
                '<span class="dmx-pushit-alert__icon" aria-hidden="true"><i class="fas ' +
                iconClass +
                '"></i></span>' +
                '<div class="dmx-pushit-alert__content">' +
                '<div class="dmx-pushit-alert__title">' +
                title +
                '</div>' +
                '<p class="dmx-pushit-alert__text">' +
                text +
                '</p>' +
                '</div></div>';
        },

        _onClick(event) {
            event.preventDefault();
            this._runSubscribe();
        },

        _onUnsubClick(event) {
            event.preventDefault();
            this._runUnsubscribe();
        },

        _buildPostContext() {
            const userUuid = readContextField(this, 'user-uuid', 'userUuid');
            const entityId = readContextField(this, 'entity-id', 'entityId');
            const eventTypes = readContextField(this, 'event-types', 'eventTypes');
            const body = {};
            if (entityId) body.entityId = entityId;
            if (userUuid) body.userUUID = userUuid;
            if (eventTypes) body.eventTypes = eventTypes;
            return body;
        },

        async _runSubscribe() {
            if (this.data.loading) return;
            this._errorContext = 'subscribe';

            if (!isPushSupported()) {
                this._setStatus('unsupported');
                this.dispatchEvent('error', null, { message: 'Web Push is not supported' });
                return;
            }

            this._setStatus('loading', { loading: true, error: '' });

            try {
                const permission = await Notification.requestPermission();
                this.set('permission', permission);

                if (permission !== 'granted') {
                    this._setStatus('denied', { loading: false });
                    this.dispatchEvent('denied');
                    return;
                }

                const registration = await this._getRegistration();
                let subscription = await registration.pushManager.getSubscription();

                const vapidRes = await fetch(
                    resolveApiUrl(
                        this.props.vapidPublicUrl,
                        '/api/pushNotifications/vapid_public'
                    )
                );
                if (!vapidRes.ok) {
                    throw new Error('Could not load VAPID public key (' + vapidRes.status + ')');
                }
                const vapidPayload = await vapidRes.json();
                const vapidKey = extractVapidKey(vapidPayload);
                if (!vapidKey) {
                    throw new Error('VAPID public key missing in API response');
                }

                if (!subscription) {
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(vapidKey),
                    });
                }

                const body = Object.assign(
                    { subscription: subscription.toJSON() },
                    this._buildPostContext()
                );

                const saveRes = await fetch(
                    resolveApiUrl(this.props.subscribeUrl, '/api/pushNotifications/subscribe'),
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    }
                );

                if (!saveRes.ok) {
                    let detail = '';
                    try {
                        const errJson = await saveRes.json();
                        detail = errJson.message || errJson.error || JSON.stringify(errJson);
                    } catch (_e) {
                        detail = await saveRes.text();
                    }
                    throw new Error('Subscribe API failed (' + saveRes.status + '): ' + detail);
                }

                const endpoint = subscription.endpoint || '';
                this._lastStatusUserUuid = readContextField(this, 'user-uuid', 'userUuid');
                this._setStatus('subscribed', {
                    loading: false,
                    endpoint,
                    error: '',
                    subscribed: true,
                });

                let responseData = null;
                try {
                    responseData = await saveRes.json();
                } catch (_e) {
                    responseData = null;
                }

                this.dispatchEvent('subscribed', null, { endpoint, subscription: subscription.toJSON() });
                this.dispatchEvent('success', null, { endpoint, response: responseData });
            } catch (err) {
                const message = err && err.message ? err.message : String(err);
                this._setStatus('error', { loading: false, error: message });
                this.dispatchEvent('error', null, { message });
            }
        },

        async _runUnsubscribe() {
            if (this.data.loading) return;
            this._errorContext = 'unsubscribe';

            if (!isPushSupported()) {
                this._setStatus('unsupported');
                this.dispatchEvent('error', null, { message: 'Web Push is not supported' });
                return;
            }

            this._setStatus('subscribed', { loading: true, error: '' });

            try {
                const subscription = await this._readBrowserSubscription();
                const endpoint =
                    (subscription && subscription.endpoint) || propString(this.data.endpoint, '');

                const body = Object.assign({}, this._buildPostContext());
                if (subscription) {
                    body.subscription = subscription.toJSON();
                }
                if (endpoint) {
                    body.endpoint = endpoint;
                }

                if (endpoint || subscription) {
                    const unsubUrl = resolveApiUrl(
                        this.props.unsubscribeUrl,
                        '/api/pushNotifications/unsubscribe'
                    );
                    const saveRes = await fetch(unsubUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });

                    if (!saveRes.ok) {
                        let detail = '';
                        try {
                            const errJson = await saveRes.json();
                            detail = errJson.message || errJson.error || JSON.stringify(errJson);
                        } catch (_e) {
                            detail = await saveRes.text();
                        }
                        throw new Error('Unsubscribe API failed (' + saveRes.status + '): ' + detail);
                    }
                }

                if (subscription) {
                    await subscription.unsubscribe();
                }

                this._lastStatusUserUuid = readContextField(this, 'user-uuid', 'userUuid');
                this._setStatus('idle', {
                    loading: false,
                    endpoint: '',
                    error: '',
                    subscribed: false,
                });

                this.dispatchEvent('unsubscribed', null, { endpoint: endpoint || '' });
            } catch (err) {
                const message = err && err.message ? err.message : String(err);
                this._setStatus('error', { loading: false, error: message });
                this.dispatchEvent('error', null, { message });
            }
        },
    });
})();
