import assert from "node:assert/strict";
import test from "node:test";
import { decideFollowUp, scheduleShipment } from "../src/shipment_follow_up.js";

const proof = {
  objectKey: "proof/SHIP-42.pdf",
  contentType: "application/pdf" as const,
  sha256: "a".repeat(64),
};

test("sends a signed-delivery follow-up only after its delay", () => {
  const shipment = scheduleShipment({
    shipmentId: "SHIP-42",
    carrier: "Parcel North",
    trackingNumber: "PN-8842",
    delayHours: 6,
    proofOfDelivery: proof,
    exceptionHandling: "manual_review",
  }, new Date("2026-09-30T00:00:00Z"));

  assert.equal(decideFollowUp(shipment, new Date("2026-09-30T05:59:59Z")), "scheduled");
  assert.equal(decideFollowUp(shipment, new Date("2026-09-30T06:00:00Z")), "sent");
});

test("routes a due shipment without proof to manual review", () => {
  const shipment = scheduleShipment({
    shipmentId: "SHIP-43",
    carrier: "Parcel North",
    trackingNumber: "PN-8843",
    delayHours: 2,
    proofOfDelivery: null,
    exceptionHandling: "manual_review",
  }, new Date("2026-09-30T00:00:00Z"));

  assert.equal(decideFollowUp(shipment, new Date("2026-09-30T02:00:00Z")), "manual_review");
});
