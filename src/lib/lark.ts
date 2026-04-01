/**
 * Feishu / Lark incoming webhook notification stub.
 * Sends a simple card message when an order is signed.
 *
 * Env var required:
 *   LARK_WEBHOOK_URL — the custom bot webhook URL from Feishu group settings.
 */

interface SignCompletePayload {
  readonly orderNo: string;
  readonly customerName: string;
  readonly signerName: string;
  readonly signedAt: Date;
}

/** Post a sign-complete notification to the configured Feishu webhook. */
export async function notifySignComplete(
  order: SignCompletePayload,
): Promise<void> {
  const webhookUrl = process.env.LARK_WEBHOOK_URL;
  if (!webhookUrl) {
    // Webhook not configured — skip silently in dev, warn in production.
    if (process.env.NODE_ENV === "production") {
      console.warn("[lark] LARK_WEBHOOK_URL is not set; notification skipped.");
    }
    return;
  }

  const signedAtStr = order.signedAt.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
  });

  const body = {
    msg_type: "text",
    content: {
      text:
        `✅ 签收通知\n` +
        `客户：${order.customerName}\n` +
        `单号：${order.orderNo}\n` +
        `签收人：${order.signerName}\n` +
        `签收时间：${signedAtStr}`,
    },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.error(
        `[lark] Webhook POST failed: ${response.status} ${response.statusText} — ${text}`,
      );
    }
  } catch (err) {
    // Notification failure must never block the signing flow.
    console.error("[lark] Failed to send sign-complete notification:", err);
  }
}
