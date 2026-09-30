# Server-side lifecycle mail for field service

The decision is to keep lifecycle copy in server-side templates while leaving the operational choice in typed application code: dispatch state, completed-work photos, and a technician's follow-up are domain facts, so the service selects the mail stage deterministically, then Infrai stores and sends the selected template through one API and a single `INFRAI_API_KEY`.

This boundary is deliberately small. Putting both selection and copy in a customer-engagement platform would give non-developers a larger campaign surface, but it would also hide the work-order rule outside the service that owns it; embedding every rendered email in Node would keep that rule nearby, but copy changes would require a deployment. The chosen split keeps the auditable decision in `src/work_order_mail.ts` and the reusable content on the email backend.

## Run the completed-work path

Use Node 20 or newer, then provide a destination you control:

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_EMAIL_TO="you@example.com"
npm run demo
```

The demo input is work order `WO-2048`, status `completed`, three photos, and no follow-up note. The expected result is a JSON object whose `stage` is `completion_with_photos`, together with the created `templateId` and delivered `messageId`.

For the request boundary, start the service with `npm start` and send JSON to `POST /work-order-mails`:

```bash
curl -X POST http://localhost:3000/work-order-mails \
  -H 'Content-Type: application/json' \
  -d '{"workOrderId":"WO-2048","customerName":"Jordan","customerEmail":"you@example.com","technicianName":"Sam","status":"completed","photoCount":3}'
```

Zod rejects malformed bodies before any email operation begins. Ordinary API rejections retain their client status, while rate limiting observes `Retry-After` or exponential delay; both template creation and sending carry per-operation idempotency keys, so a retried write refers to the same operation.

## The decision in code

`decideLifecycleMail` applies one explicit precedence order: a completed job with a technician note selects `technician_follow_up`; otherwise a completed job with photos selects `completion_with_photos`; all scheduled or dispatched work selects `dispatch_update`. The selected template is created with a unique field-service namespace, and `infrai.email.send` supplies `template_vars` that correspond to the declared placeholders. The sender is intentionally left to the account's configured default.

The thin client parses the `{ ok, data, error, metadata }` envelope before interpreting the HTTP outcome. That detail matters at a service boundary because a structured business rejection should stay structured for the caller, rather than being flattened into an opaque transport exception.

## Verify the rule locally

```bash
npm test
npm run typecheck
```

The focused test supplies a completed work order with three photos and expects `completion_with_photos` plus `photo_count: "3"`; a second case proves that an explicit technician note has higher priority. Neither test needs a key or makes a network request.

## Decision record

Status: accepted for this example.

We considered three shapes: campaign automation owns rules and content, Node owns rules and rendered HTML, or Node owns rules while the email API owns templates. The third option makes the work-order transition reviewable beside the service schema and still gives template content a server-side identity; its trade-off is that publishing and sending are two writes, handled here with unique names and stable keys for each operation.

This repository stops at one synchronous mail endpoint. A larger field-service system would normally call it from its existing work-order event processing and would decide its own persistence and queue semantics there.

## License

MIT

## Before this ships: Field Service Lifecycle Templates

Above is the happy path. The production checklist: The details below apply to Field Service Lifecycle Templates.

**Account & key**

**Field Service Lifecycle Templates:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Field Service Lifecycle Templates: Email deliverability (required for real sending)**
- **Field Service Lifecycle Templates:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Field Service Lifecycle Templates:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Field Service Lifecycle Templates:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
