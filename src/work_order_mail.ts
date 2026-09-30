import { randomUUID } from "node:crypto";

import { infrai } from "./infrai_email.js";

export type DispatchStatus = "scheduled" | "dispatched" | "completed";

export type WorkOrderMail = {
  workOrderId: string;
  customerName: string;
  customerEmail: string;
  technicianName: string;
  status: DispatchStatus;
  photoCount: number;
  followUpNote?: string;
};

export type LifecycleDecision = {
  stage: "dispatch_update" | "completion_with_photos" | "technician_follow_up";
  subject: string;
  html: string;
  templateVars: Record<string, string>;
};

export function decideLifecycleMail(order: WorkOrderMail): LifecycleDecision {
  const shared = {
    customer_name: order.customerName,
    work_order_id: order.workOrderId,
    technician_name: order.technicianName,
  };

  if (order.status === "completed" && order.followUpNote) {
    return {
      stage: "technician_follow_up",
      subject: "A follow-up for work order {{work_order_id}}",
      html: "<p>Hi {{customer_name}},</p><p>{{technician_name}} left this follow-up: {{follow_up_note}}</p>",
      templateVars: { ...shared, follow_up_note: order.followUpNote },
    };
  }

  if (order.status === "completed" && order.photoCount > 0) {
    return {
      stage: "completion_with_photos",
      subject: "Work order {{work_order_id}} is complete",
      html: "<p>Hi {{customer_name}},</p><p>{{technician_name}} completed the visit and added {{photo_count}} work-order photos.</p>",
      templateVars: { ...shared, photo_count: String(order.photoCount) },
    };
  }

  return {
    stage: "dispatch_update",
    subject: "Dispatch update for work order {{work_order_id}}",
    html: "<p>Hi {{customer_name}},</p><p>Your work order is now {{dispatch_status}} with {{technician_name}}.</p>",
    templateVars: { ...shared, dispatch_status: order.status },
  };
}

export async function sendWorkOrderMail(order: WorkOrderMail): Promise<{
  stage: LifecycleDecision["stage"];
  messageId: string;
}> {
  const decision = decideLifecycleMail(order);
  const operationId = randomUUID();
  const render = (content: string) =>
    content.replace(/{{([a-z_]+)}}/g, (_, key: string) => decision.templateVars[key] ?? "");
  const sent = await infrai.email.send({
    to: order.customerEmail,
    subject: render(decision.subject),
    html: render(decision.html),
    idempotency_key: `mail-${operationId}`,
  });

  return {
    stage: decision.stage,
    messageId: sent.message_id,
  };
}
