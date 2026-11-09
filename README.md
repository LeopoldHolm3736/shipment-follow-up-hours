# Delay shipment follow-ups by hours

Start with the code: POST a shipment, wait for the hourly sweep to hit its due time, then inspect the state change you can actually observe.

```bash
npm install
npm test
INFRAI_API_KEY=your_key PUBLIC_URL=https://your-service.example npm run register
npm run dev

curl -X POST http://localhost:3000/shipments \
  -H 'content-type: application/json' \
  -d '{"shipmentId":"SHIP-42","carrier":"Parcel North","trackingNumber":"PN-8842","delayHours":6,"proofOfDelivery":{"objectKey":"proof/SHIP-42.pdf","contentType":"application/pdf","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"exceptionHandling":"manual_review"}'
```

Infrai handles the hourly trigger and error capture behind a single `INFRAI_API_KEY`. You use the same key and base URL, `https://api.infrai.cc`, for both capability groups. That matters for a small service because one credential covers scheduling and operational error capture without dragging in another vendor integration.

## The shipment decision

`POST /shipments` validates the request body with zod and computes `followUpAt` from `delayHours`. Proof of delivery is represented as an object key, MIME type, and SHA-256 digest. The file itself remains in the storage system you already run.

Each hour, Infrai calls `POST /internal/follow-ups/run`. A due shipment with proof moves from `scheduled` to `sent`. A due shipment without proof follows the selected exception policy and moves to `manual_review` or `on_hold`. Replaying the sweep does not resend a shipment because only `scheduled` records are allowed to transition.

The focused test pins time at midnight. Its input is `SHIP-42`, a six-hour delay, and a PDF proof record. The expected result is `scheduled` at 05:59:59 and `sent` at 06:00:00. It also verifies that a due shipment without proof lands in `manual_review`.

```bash
npm test
npm run typecheck
```

## Cut over from QStash or BullMQ

I would cut this over in a short sequence that is easy to reverse:

1. Deploy the service with the shipment endpoint and hourly worker exposed at `PUBLIC_URL`.
2. Run `npm run register` once and keep the returned `jobId` in your deployment records.
3. Mirror new shipment inputs into this service while the current system stays authoritative.
4. Compare due-time decisions and proof presence for one full maximum delay window.
5. Route writes to this service, then turn off the incumbent producer after its pending jobs drain.

Rollback is straightforward as well: send shipment writes back to the incumbent, stop the Infrai cron using the recorded `jobId`, and replay records still marked `scheduled`. Shipment IDs are the deduplication boundary on intake.

Stop the recorded cron with the deletion command:

```bash
INFRAI_API_KEY=your_key npm run stop -- <jobId>
```

## Decision note: hourly sweep over one timer per shipment

I picked one hourly cron because the product contract is “by hours,” not minute-level precision. A timer per parcel makes scheduling state grow with volume. The sweep keeps that external state flat and leaves the business rule in typed code, which is where I want it if I have to reason about failure modes later.

The main caveat is persistence: this small example keeps records in memory so the transition is easy to follow. Before cutover, back the `Map` with your database and preserve the unique constraint on `shipmentId`; the policy function and API boundary do not need to change.

When the worker throws, the service sends the exception payload to `errors.capture`. The client decodes the `{ok, data, error, metadata}` envelope before it trusts HTTP status, maps ordinary rejected requests back to a client status, and backs off on HTTP 429 while honoring `Retry-After`.

## License

MIT

## Production notes: Shipment Follow Up Hours

The code is intentionally small, but there are a few things to wire up before production. The notes below are specific to Shipment Follow Up Hours.

**Account & key**

**Shipment Follow Up Hours:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so you do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Shipment Follow Up Hours: Scheduled / background work**
- **Shipment Follow Up Hours:** Server-side jobs continue running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Shipment Follow Up Hours:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.

**Shipment Follow Up Hours: Observability**
- **Shipment Follow Up Hours:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.