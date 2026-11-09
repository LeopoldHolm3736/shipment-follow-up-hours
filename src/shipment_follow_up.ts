import { z } from "zod";

export const shipmentRequest = z.object({
  shipmentId: z.string().min(1),
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
  delayHours: z.number().int().min(1).max(168),
  proofOfDelivery: z.object({
    objectKey: z.string().min(1),
    contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).nullable(),
  exceptionHandling: z.enum(["manual_review", "hold_follow_up"]),
});

export type ShipmentRequest = z.infer<typeof shipmentRequest>;
export type FollowUpStatus = "scheduled" | "sent" | "manual_review" | "on_hold";

export type ShipmentFollowUp = ShipmentRequest & {
  createdAt: string;
  followUpAt: string;
  status: FollowUpStatus;
};

export function scheduleShipment(input: ShipmentRequest, now: Date): ShipmentFollowUp {
  return {
    ...input,
    createdAt: now.toISOString(),
    followUpAt: new Date(now.getTime() + input.delayHours * 3_600_000).toISOString(),
    status: "scheduled",
  };
}

export function decideFollowUp(shipment: ShipmentFollowUp, now: Date): FollowUpStatus {
  if (shipment.status !== "scheduled" || now < new Date(shipment.followUpAt)) return shipment.status;
  if (shipment.proofOfDelivery) return "sent";
  return shipment.exceptionHandling === "manual_review" ? "manual_review" : "on_hold";
}
