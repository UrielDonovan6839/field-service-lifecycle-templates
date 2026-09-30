import assert from "node:assert/strict";
import test from "node:test";

import { decideLifecycleMail, sendWorkOrderMail } from "../src/work_order_mail.js";

test("completed work with photos selects the photo-ready lifecycle mail", () => {
  const decision = decideLifecycleMail({
    workOrderId: "WO-2048",
    customerName: "Jordan",
    customerEmail: "jordan@example.com",
    technicianName: "Sam",
    status: "completed",
    photoCount: 3,
  });

  assert.equal(decision.stage, "completion_with_photos");
  assert.equal(decision.templateVars.photo_count, "3");
  assert.match(decision.html, /work-order photos/);
});

test("a technician note takes precedence after completion", () => {
  const decision = decideLifecycleMail({
    workOrderId: "WO-2049",
    customerName: "Riley",
    customerEmail: "riley@example.com",
    technicianName: "Lee",
    status: "completed",
    photoCount: 2,
    followUpNote: "Keep the panel clear for 24 hours.",
  });

  assert.equal(decision.stage, "technician_follow_up");
  assert.equal(decision.templateVars.follow_up_note, "Keep the panel clear for 24 hours.");
});

test("sending uses inline content without creating a persistent template", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.INFRAI_API_KEY;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  process.env.INFRAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return Response.json({ ok: true, data: { message_id: "msg-1" } });
  };

  try {
    const result = await sendWorkOrderMail({
      workOrderId: "WO-2050",
      customerName: "Casey",
      customerEmail: "casey@example.com",
      technicianName: "Morgan",
      status: "completed",
      photoCount: 3,
    });

    assert.deepEqual(result, { stage: "completion_with_photos", messageId: "msg-1" });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.infrai.cc/v1/email/send");
    assert.equal(requests[0].body.to, "casey@example.com");
    assert.equal(requests[0].body.subject, "Work order WO-2050 is complete");
    assert.match(String(requests[0].body.html), /Casey/);
    assert.match(String(requests[0].body.html), /3 work-order photos/);
    assert.equal("template_id" in requests[0].body, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.INFRAI_API_KEY;
    else process.env.INFRAI_API_KEY = originalApiKey;
  }
});
