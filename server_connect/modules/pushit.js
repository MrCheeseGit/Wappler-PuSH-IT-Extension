/**
 * PuSH-IT — Web Push (VAPID) for Wappler Server Connect (Node).
 * Credentials: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in project env.
 * sync-marker: 2026-06-07-column-resolve
 */

const webpush = require('web-push');

/**
 * @param {unknown} value
 * @returns {Array<Record<string, unknown>>}
 */
function parseGrid(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
        try {
            return parseGrid(JSON.parse(value));
        } catch {
            return [];
        }
    }
    if (typeof value === 'object') {
        return Object.keys(value)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => value[k])
            .filter((row) => row && typeof row === 'object');
    }
    return [];
}

/**
 * @param {unknown} input
 * @returns {string}
 */
function resolveFieldName(input) {
    const s = String(input || '').trim();
    if (!s) return '';

    const binding = s.match(/\{\{([^}]+)\}\}/);
    const path = binding ? binding[1].trim() : s;

    if (path.includes('{{')) return '';

    const pathMatch = path.match(/(?:^|[.\[])([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (pathMatch) return pathMatch[1];

    if (path.includes('.')) {
        const parts = path.split('.').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : '';
    }

    return path;
}

/**
 * Resolve a query column option to a row field name.
 * Wappler may evaluate {{query[0].endpoint}} to the cell value before the module runs.
 *
 * @param {unknown} input
 * @param {Record<string, unknown>|undefined} sampleRow
 * @returns {string}
 */
function resolveColumnName(input, sampleRow) {
    const fromBinding = resolveFieldName(input);
    const raw = String(input ?? '').trim();

    if (sampleRow && typeof sampleRow === 'object') {
        if (fromBinding && rowHasField(sampleRow, fromBinding)) {
            return fromBinding;
        }
        if (raw && !raw.includes('{{')) {
            const byValue = Object.keys(sampleRow).find((k) => String(sampleRow[k]) === raw);
            if (byValue) return byValue;
        }
    }

    return fromBinding;
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} fieldName
 * @returns {boolean}
 */
function rowHasField(row, fieldName) {
    if (!fieldName || !row) return false;
    if (Object.prototype.hasOwnProperty.call(row, fieldName)) return true;
    return Object.keys(row).some((k) => k.toLowerCase() === fieldName.toLowerCase());
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} fieldName
 * @returns {unknown}
 */
function getRowFieldValue(row, fieldName) {
    if (!fieldName || !row) return '';
    if (Object.prototype.hasOwnProperty.call(row, fieldName)) {
        return row[fieldName];
    }
    const key = Object.keys(row).find((k) => k.toLowerCase() === fieldName.toLowerCase());
    return key ? row[key] : '';
}

/**
 * @param {unknown} value
 * @returns {object|null}
 */
function parseSubscriptionJson(value) {
    if (!value) return null;

    let obj = value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
            obj = JSON.parse(trimmed);
        } catch {
            return null;
        }
    }

    if (!obj || typeof obj !== 'object') return null;

    const endpoint = String(obj.endpoint || '').trim();
    if (!endpoint) return null;

    const keys = obj.keys && typeof obj.keys === 'object' ? obj.keys : obj;
    const p256dh = String(keys.p256dh || keys.p256dh_key || '').trim();
    const auth = String(keys.auth || keys.auth_key || '').trim();

    if (!p256dh || !auth) return null;

    return {
        endpoint,
        expirationTime: obj.expirationTime ?? null,
        keys: { p256dh, auth },
    };
}

/**
 * @returns {{ publicKey: string, privateKey: string, subject: string }}
 */
function getVapidConfig() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
        throw new Error(
            'Missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT. Add them in Wappler Project Settings → Environment, then restart the server.'
        );
    }

    return {
        publicKey: String(publicKey).trim(),
        privateKey: String(privateKey).trim(),
        subject: String(subject).trim(),
    };
}

function configureWebPush() {
    const { publicKey, privateKey, subject } = getVapidConfig();
    webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} subscriptionField
 * @param {string} endpointField
 * @param {string} p256dhField
 * @param {string} authField
 * @returns {object|null}
 */
function subscriptionFromRow(row, subscriptionField, endpointField, p256dhField, authField) {
    if (subscriptionField) {
        const raw = getRowFieldValue(row, subscriptionField);
        return parseSubscriptionJson(raw);
    }

    if (endpointField && p256dhField && authField) {
        const endpoint = String(getRowFieldValue(row, endpointField) || '').trim();
        const p256dh = String(getRowFieldValue(row, p256dhField) || '').trim();
        const auth = String(getRowFieldValue(row, authField) || '').trim();
        if (!endpoint || !p256dh || !auth) return null;
        return { endpoint, keys: { p256dh, auth } };
    }

    return parseSubscriptionJson(row);
}

/**
 * @param {object} options
 * @param {Function} parseOptional
 * @returns {object}
 */
function buildNotificationPayload(options, parseOptional) {
    const title = String(parseOptional(options.title, 'string', '') || '').trim();
    const body = String(parseOptional(options.body, 'string', '') || '').trim();

    if (!title && !body) {
        throw new Error('Notification title or body is required.');
    }

    const url = String(parseOptional(options.url, 'string', '') || process.env.PUSH_IT_DEFAULT_URL || '').trim();
    const icon = String(parseOptional(options.icon, 'string', '') || process.env.PUSH_IT_DEFAULT_ICON || '').trim();
    const tag = String(parseOptional(options.tag, 'string', '') || '').trim();

    let data = parseOptional(options.data, '*', null);
    if (typeof data === 'string' && data.trim()) {
        try {
            data = JSON.parse(data);
        } catch {
            data = { value: data };
        }
    }

    const payload = {
        title: title || 'Notification',
        body: body || '',
    };
    if (url) payload.url = url;
    if (icon) payload.icon = icon;
    if (tag) payload.tag = tag;
    if (data && typeof data === 'object') payload.data = data;

    return payload;
}

/**
 * Resolve subscription payload from step options or request scope.
 * Wappler may stringify {{$_POST.subscription}} as "[object Object]" when the client sends JSON.
 * @param {object} ctx - Server Connect step context (this)
 * @param {object} options
 * @returns {unknown}
 */
function getRequestPost(ctx) {
    if (typeof ctx.get === 'function') {
        const post = ctx.get('$_POST');
        if (post && typeof post === 'object') return post;
    }
    if (typeof ctx.scope?.get === 'function') {
        const post = ctx.scope.get('$_POST');
        if (post && typeof post === 'object') return post;
    }
    if (ctx.req?.body && typeof ctx.req.body === 'object') {
        return ctx.req.body;
    }
    return null;
}

function collectSubscriptionCandidates(ctx, options) {
    const post = getRequestPost(ctx);
    const candidates = [];

    const bound = ctx.parseOptional(options.subscription, '*', null);
    if (bound != null && bound !== '') candidates.push(bound);

    if (post && typeof post === 'object') {
        if (post.subscription != null && post.subscription !== '') candidates.push(post.subscription);
        if (post.endpoint) candidates.push(post);
    }

    const body = ctx.req && ctx.req.body;
    if (body && body !== post && typeof body === 'object') {
        if (body.subscription != null && body.subscription !== '') candidates.push(body.subscription);
        if (body.endpoint) candidates.push(body);
    }

    return { post: post || body || null, candidates };
}

function resolveSubscriptionInput(ctx, options) {
    const { candidates } = collectSubscriptionCandidates(ctx, options);

    for (const candidate of candidates) {
        if (candidate == null || candidate === '') continue;
        if (typeof candidate === 'string' && candidate.trim() === '[object Object]') continue;
        if (parseSubscriptionJson(candidate)) return candidate;
    }

    return null;
}

function describeMissingSubscription(ctx, options) {
    const { post } = collectSubscriptionCandidates(ctx, options);
    const keys = post && typeof post === 'object' ? Object.keys(post) : [];
    if (!keys.length) {
        return 'No POST body received. POST JSON with a subscription field (or paste subscription JSON into the Wappler API Run panel).';
    }
    return `POST keys received: ${keys.join(', ')}. Expected subscription (object or JSON string) with endpoint and keys.p256dh / keys.auth.`;
}

exports.deactivate = async function deactivate(options) {
    try {
        let endpoint = String(this.parseOptional(options.endpoint, 'string', '') || '').trim();

        if (!endpoint) {
            const raw = resolveSubscriptionInput(this, options);
            const subscription = parseSubscriptionJson(raw);
            if (subscription && subscription.endpoint) {
                endpoint = String(subscription.endpoint).trim();
            }
        }

        if (!endpoint) {
            return {
                success: false,
                valid: false,
                error: 'Missing push endpoint. POST subscription JSON or an endpoint field.',
            };
        }

        const userUUID = String(this.parseOptional(options.userUUID, 'string', '') || '').trim();
        const entityId = String(this.parseOptional(options.entityId, 'string', '') || '').trim();

        return {
            success: true,
            valid: true,
            endpoint,
            userUUID,
            entityId,
        };
    } catch (error) {
        return {
            success: false,
            valid: false,
            error: error.message,
        };
    }
};

exports.prepare = async function prepare(options) {
    try {
        const raw = resolveSubscriptionInput(this, options);
        const subscription = parseSubscriptionJson(raw);

        if (!subscription) {
            return {
                success: false,
                valid: false,
                error: describeMissingSubscription(this, options),
            };
        }

        const userUUID = String(this.parseOptional(options.userUUID, 'string', '') || '').trim();
        const entityId = String(this.parseOptional(options.entityId, 'string', '') || '').trim();
        const eventTypes = String(this.parseOptional(options.eventTypes, 'string', '') || '').trim();
        const userAgent = String(this.parseOptional(options.userAgent, 'string', '') || '').trim();

        const subscriptionJson = typeof raw === 'string' ? raw.trim() : JSON.stringify(subscription);

        const insertRow = {
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userUUID,
            entityId,
            eventTypes,
            userAgent,
            subscriptionJson,
        };

        return {
            success: true,
            valid: true,
            endpoint: insertRow.endpoint,
            p256dh: insertRow.p256dh,
            auth: insertRow.auth,
            userUUID: insertRow.userUUID,
            entityId: insertRow.entityId,
            eventTypes: insertRow.eventTypes,
            userAgent: insertRow.userAgent,
            subscriptionJson: insertRow.subscriptionJson,
            insertRow,
            rows: [insertRow],
        };
    } catch (error) {
        return {
            success: false,
            valid: false,
            error: error.message,
        };
    }
};

exports.send = async function send(options, name, stepMeta) {
    try {
        configureWebPush();

        const mode = this.parseOptional(options.mode, 'string', 'single');
        const payload = buildNotificationPayload(options, (v, t, d) => this.parseOptional(v, t, d));
        const payloadString = JSON.stringify(payload);

        const sampleRow =
            mode === 'fromQuery'
                ? (() => {
                      const sourceData = this.parseOptional(options.sourceData, '*', []);
                      const rows = Array.isArray(sourceData) ? sourceData : parseGrid(sourceData);
                      return rows[0];
                  })()
                : undefined;

        const subscriptionField = resolveColumnName(options.subscriptionColumn, sampleRow);
        const endpointField = resolveColumnName(options.endpointColumn, sampleRow);
        const p256dhField = resolveColumnName(options.p256dhColumn, sampleRow);
        const authField = resolveColumnName(options.authColumn, sampleRow);
        const userIdField = resolveColumnName(options.userIdColumn, sampleRow);
        const entityIdField = resolveColumnName(options.entityIdColumn, sampleRow);

        const results = [];
        let sent = 0;
        let failed = 0;
        let noSubscription = 0;

        const pushOne = async (subscription, context) => {
            if (!subscription) {
                noSubscription += 1;
                results.push({
                    ...context,
                    status: 'no_subscription',
                    error: 'Missing or invalid subscription data',
                    expired: false,
                });
                return;
            }

            try {
                await webpush.sendNotification(subscription, payloadString);
                sent += 1;
                results.push({
                    ...context,
                    status: 'sent',
                    error: '',
                    expired: false,
                });
            } catch (error) {
                const statusCode = error.statusCode || error.status;
                const expired = statusCode === 410 || statusCode === 404;
                failed += 1;
                results.push({
                    ...context,
                    status: 'failed',
                    error: error.message || 'Push send failed',
                    expired,
                    statusCode: statusCode || null,
                });
            }
        };

        if (mode === 'fromQuery') {
            const sourceData = this.parseOptional(options.sourceData, '*', []);
            const rows = Array.isArray(sourceData) ? sourceData : parseGrid(sourceData);

            if (!rows.length) {
                throw new Error(
                    'Query results are empty. Add a database query step above, then bind its output to Query results.'
                );
            }

            if (!subscriptionField && !(endpointField && p256dhField && authField)) {
                throw new Error(
                    'Set Subscription column (JSON) or Endpoint + p256dh + auth columns for query mode.'
                );
            }

            for (const row of rows) {
                const subscription = subscriptionFromRow(
                    row,
                    subscriptionField,
                    endpointField,
                    p256dhField,
                    authField
                );
                const context = {
                    userId: userIdField ? String(getRowFieldValue(row, userIdField) || '') : '',
                    entityId: entityIdField ? String(getRowFieldValue(row, entityIdField) || '') : '',
                    endpoint: subscription ? subscription.endpoint : '',
                };
                await pushOne(subscription, context);
            }
        } else {
            const raw = this.parseOptional(options.subscription, '*', null);
            const subscription = parseSubscriptionJson(raw);
            await pushOne(subscription, {
                userId: '',
                entityId: '',
                endpoint: subscription ? subscription.endpoint : '',
            });
        }

        if (Array.isArray(stepMeta)) {
            stepMeta.length = 0;
            stepMeta.push({ name: 'userId', type: 'text' });
            stepMeta.push({ name: 'entityId', type: 'text' });
            stepMeta.push({ name: 'endpoint', type: 'text' });
            stepMeta.push({ name: 'status', type: 'text' });
            stepMeta.push({ name: 'error', type: 'text' });
            stepMeta.push({ name: 'expired', type: 'boolean' });
            stepMeta.push({ name: 'statusCode', type: 'number' });
        }

        return {
            success: true,
            sent,
            failed,
            no_subscription: noSubscription,
            total: results.length,
            results,
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            sent: 0,
            failed: 0,
            no_subscription: 0,
            total: 0,
            results: [],
        };
    }
};

/** Expose for tests / tools */
exports._parseSubscriptionJson = parseSubscriptionJson;
exports._resolveFieldName = resolveFieldName;
exports._resolveColumnName = resolveColumnName;
