import { infrai } from "./infrai_client.js";

const jobId = process.argv[2];
if (!jobId) throw new Error("Usage: npm run stop -- <jobId>");

await infrai.cron.delete(jobId);
console.log(JSON.stringify({ jobId, stopped: true }));
