import { sendWorkOrderMail } from "../src/work_order_mail.js";

const customerEmail = process.env.DEMO_EMAIL_TO;
if (!customerEmail) throw new Error("DEMO_EMAIL_TO is required");

const result = await sendWorkOrderMail({
  workOrderId: "WO-2048",
  customerName: "Jordan",
  customerEmail,
  technicianName: "Sam",
  status: "completed",
  photoCount: 3,
});

console.log(JSON.stringify(result, null, 2));
