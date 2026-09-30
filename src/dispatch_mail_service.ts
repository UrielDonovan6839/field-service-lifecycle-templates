import { createServer } from "node:http";

import { z } from "zod";

import { InfraiError } from "./infrai_email.js";
import { sendWorkOrderMail } from "./work_order_mail.js";

const requestSchema = z.object({
  workOrderId: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  technicianName: z.string().min(1),
  status: z.enum(["scheduled", "dispatched", "completed"]),
  photoCount: z.number().int().nonnegative(),
  followUpNote: z.string().min(1).optional(),
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/work-order-mails") {
    response.writeHead(404).end(JSON.stringify({ error: "Route not found" }));
    return;
  }

  try {
    const parsed = requestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid request", issues: parsed.error.issues }));
      return;
    }
    const result = await sendWorkOrderMail(parsed.data);
    response.writeHead(201).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "Request body must be JSON" }));
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.writeHead(error.status).end(JSON.stringify({ error: error.code, message: error.message }));
      return;
    }
    console.error(error);
    response.writeHead(502).end(JSON.stringify({ error: "Email operation did not complete" }));
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Field-service mail service listening on http://localhost:${port}`));
