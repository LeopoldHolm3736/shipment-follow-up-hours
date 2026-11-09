import { infrai } from "./infrai_client.js";

const publicUrl = process.env.PUBLIC_URL;
if (!publicUrl) throw new Error("PUBLIC_URL is required");

const task = new URL("/internal/follow-ups/run", publicUrl).toString();
const result = await infrai.cron.create(
  { cron_expr: "0 * * * *", task },
  `shipment-follow-up:${task}`,
);

console.log(JSON.stringify({ jobId: result.job_id, task }, null, 2));
