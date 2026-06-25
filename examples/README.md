# PuSH-IT examples

Generic API flow sketches — adapt connection names, table columns, and bindings to your project.

| File | Purpose |
|------|---------|
| `subscribe-entity-scoped.json` | Opt-in: Prepare → Database Insert |
| `unsubscribe-api.json` | Opt-out: Deactivate → Database Update (`active = 0`) |
| `subscription-status-api.json` | **Status API for `status-url`** — query with Output ON; `{ findActive: { active: 1 } }` = subscribed. See [README § Subscription status](../README.md#subscription-status--per-user-ui-critical) |
| `test-send.json` | Dev test API — query latest subscription → Send (**Mr Cheese** thank-you message) |
| `notify-on-create.json` | Query subscribers → Send push |
| `notify-with-sms-fallback.json` | Push + separate ClickSend step (loose coupling) |
| `sql/push_subscriptions.mysql.sql` | MySQL `CREATE TABLE` for subscription storage |
| `pushit-subscribe-component.html` | App Connect `dmx-pushit-subscribe` page reference |
| `../pushit_service_worker.js` | Copy to `public/` — or use extension `copyFiles` from App Connect install |
| `../app_connect/` | `dmx-pushit-subscribe` component (v1.1+) |

These are documentation shapes, not drop-in Wappler exports. Build the same step order in Server Connect and bind fields via the data picker.

**First install?** Start with the main [README](../README.md) — checklist, MySQL script, troubleshooting, and Wappler Send step pitfalls.
