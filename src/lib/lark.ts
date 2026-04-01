/**
 * Feishu / Lark incoming webhook notifications.
 * All functions are fire-and-forget — errors are logged but never re-thrown.
 *
 * Env vars:
 *   LARK_WEBHOOK_URL  — custom bot webhook URL from the Feishu group settings.
 *   LARK_WEBHOOK_SECRET — (optional) signing secret for outbound Lark webhook.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Lark interactive card body (simplified). */
interface LarkCardBody {
  readonly msg_type: "interactive";
  readonly card: {
    readonly config: { readonly wide_screen_mode: boolean };
    readonly header: {
      readonly title: { readonly tag: "plain_text"; readonly content: string };
      readonly template: string; // "green" | "blue" | "red" | "yellow" | "grey"
    };
    readonly elements: ReadonlyArray<{
      readonly tag: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readonly [key: string]: any;
    }>;
  };
}

function buildCard(
  title: string,
  color: "green" | "blue" | "red" | "yellow" | "grey",
  fields: ReadonlyArray<{ readonly label: string; readonly value: string }>,
): LarkCardBody {
  const fieldElements = fields.map((f) => ({
    tag: "div",
    text: {
      tag: "lark_md",
      content: `**${f.label}：** ${f.value}`,
    },
  }));

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: false },
      header: {
        title: { tag: "plain_text", content: title },
        template: color,
      },
      elements: fieldElements,
    },
  };
}

async function postToLark(body: LarkCardBody): Promise<void> {
  const webhookUrl = process.env.LARK_WEBHOOK_URL;
  if (!webhookUrl) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[lark] LARK_WEBHOOK_URL is not set; notification skipped.");
    }
    return;
  }

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
}

/** Format a Shanghai-timezone datetime string from a Date or ISO string. */
function fmtDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

/** Format 分 amount as 元 with 2 decimal places. */
function fmtAmount(fenStr: string | number | bigint): string {
  const fen = typeof fenStr === "bigint" ? fenStr : BigInt(Math.round(Number(fenStr)));
  const yuan = Number(fen) / 100;
  return `¥${yuan.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Public notification functions
// ---------------------------------------------------------------------------

interface SignCompletePayload {
  readonly orderNo: string;
  readonly customerName: string;
  readonly signerName: string;
  readonly signedAt: Date;
}

/** Notify when a delivery order has been successfully signed. */
export async function notifySignComplete(
  order: SignCompletePayload,
): Promise<void> {
  try {
    await postToLark(
      buildCard("签收完成", "green", [
        { label: "单号", value: order.orderNo },
        { label: "客户", value: order.customerName },
        { label: "签收人", value: order.signerName },
        { label: "签收时间", value: fmtDate(order.signedAt) },
      ]),
    );
  } catch (err) {
    console.error("[lark] Failed to send sign-complete notification:", err);
  }
}

interface NewOrderPayload {
  readonly orderNo: string;
  readonly customerName: string;
  /** Amount in 分 (cents). */
  readonly totalAmount: bigint | number;
  readonly itemCount: number;
  readonly deliveryDate: string | Date;
}

/** Notify when a new delivery order has been received from 莱运. */
export async function notifyNewOrder(order: NewOrderPayload): Promise<void> {
  try {
    await postToLark(
      buildCard("新送货单", "blue", [
        { label: "单号", value: order.orderNo },
        { label: "客户", value: order.customerName },
        { label: "金额", value: fmtAmount(order.totalAmount) },
        { label: "品目数", value: String(order.itemCount) },
        { label: "送货日期", value: fmtDate(order.deliveryDate) },
      ]),
    );
  } catch (err) {
    console.error("[lark] Failed to send new-order notification:", err);
  }
}

interface OrderRejectedPayload {
  readonly orderNo: string;
  readonly customerName: string;
  readonly reason: string;
}

/** Notify when an order has been rejected / refused by the customer. */
export async function notifyOrderRejected(
  order: OrderRejectedPayload,
): Promise<void> {
  try {
    await postToLark(
      buildCard("送货单被拒收", "red", [
        { label: "单号", value: order.orderNo },
        { label: "客户", value: order.customerName },
        { label: "原因", value: order.reason },
      ]),
    );
  } catch (err) {
    console.error("[lark] Failed to send order-rejected notification:", err);
  }
}

interface PrintCompletedPayload {
  readonly orderNo: string;
  readonly customerName: string;
}

/** Notify when a print job for a delivery order has been completed. */
export async function notifyPrintCompleted(
  order: PrintCompletedPayload,
): Promise<void> {
  try {
    await postToLark(
      buildCard("纸质单打印完成", "yellow", [
        { label: "单号", value: order.orderNo },
        { label: "客户", value: order.customerName },
      ]),
    );
  } catch (err) {
    console.error("[lark] Failed to send print-completed notification:", err);
  }
}
