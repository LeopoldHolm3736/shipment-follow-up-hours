import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { infrai, InfraiError } from "./infrai_client.js";
import { decideFollowUp, scheduleShipment, shipmentRequest, type ShipmentFollowUp } from "./shipment_follow_up.js";

const shipments = new Map<string, ShipmentFollowUp>();

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/shipments") {
      const input = shipmentRequest.parse(await readJson(request));
      if (shipments.has(input.shipmentId)) return reply(response, 409, { error: "shipment already scheduled" });
      const shipment = scheduleShipment(input, new Date());
      shipments.set(shipment.shipmentId, shipment);
      return reply(response, 201, shipment);
    }

    if (request.method === "POST" && request.url === "/internal/follow-ups/run") {
      const now = new Date();
      const transitions: Array<{ shipmentId: string; status: string }> = [];
      for (const shipment of shipments.values()) {
        const nextStatus = decideFollowUp(shipment, now);
        if (nextStatus !== shipment.status) {
          shipment.status = nextStatus;
          transitions.push({ shipmentId: shipment.shipmentId, status: nextStatus });
        }
      }
      return reply(response, 200, { checkedAt: now.toISOString(), transitions });
    }

    return reply(response, 404, { error: "route not found" });
  } catch (error) {
    if (error instanceof ZodError) return reply(response, 400, { error: "invalid shipment", issues: error.issues });
    const exception = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "UnknownError", message: String(error) };
    try {
      await infrai.errors.capture(exception, `follow-up:${Date.now()}`);
    } catch (captureError) {
      console.error("Could not record worker exception", captureError);
    }
    const status = error instanceof InfraiError && error.status < 500 ? error.status : 500;
    return reply(response, status, { error: status < 500 ? exception.message : "follow-up failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Shipment follow-up service listening on ${port}`));
