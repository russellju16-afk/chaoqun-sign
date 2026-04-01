/**
 * Feishu / Lark incoming webhook notifications.
 * All functions are fire-and-forget — errors are logged but never re-thrown.
 *
 * Env vars:
 *   LARK_WEBHOOK_URL  — custom bot webhook URL from the Feishu group settings.
 *   LARK_WEBHOOK_SECRET — (optional) signing secret for outbound Lark webhook.
 *   NEXT_PUBLIC_APP_URL — app base URL used to build deep-link buttons.
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

/** 单个跳转按钮配置 */
interface CardButton {
  /** 按钮显示文字 */
  readonly label: string;
  /** 完整跳转 URL */
  readonly url: string;
  /** 飞书按钮类型，默认 primary */
  readonly type?: "primary" | "default" | "danger";
}

/**
 * 构建飞书 Interactive Card。
 * @param title  卡片标题
 * @param color  标题栏颜色
 * @param fields 正文字段列表
 * @param buttons 可选的操作按钮列表，添加到卡片底部 action 区域
 */
function buildCard(
  title: string,
  color: "green" | "blue" | "red" | "yellow" | "grey",
  fields: ReadonlyArray<{ readonly label: string; readonly value: string }>,
  buttons?: ReadonlyArray<CardButton>,
): LarkCardBody {
  const fieldElements = fields.map((f) => ({
    tag: "div",
    text: {
      tag: "lark_md",
      content: `**${f.label}：** ${f.value}`,
    },
  }));

  // 若有按钮则在卡片末尾附加 action 元素
  const actionElements =
    buttons && buttons.length > 0
      ? [
          {
            tag: "action",
            actions: buttons.map((btn) => ({
              tag: "button",
              text: {
                tag: "plain_text",
                content: btn.label,
              },
              type: btn.type ?? "primary",
              // multi_url 支持不同平台跳转（飞书移动端/PC 端均适用）
              multi_url: {
                url: btn.url,
                android_url: "",
                ios_url: "",
                pc_url: "",
              },
            })),
          },
        ]
      : [];

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: false },
      header: {
        title: { tag: "plain_text", content: title },
        template: color,
      },
      elements: [...fieldElements, ...actionElements],
    },
  };
}

/**
 * 读取应用根 URL。
 * 优先使用 NEXT_PUBLIC_APP_URL；未配置时静默返回空字符串（链接将降级为相对路径）。
 */
function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
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
  const fen =
    typeof fenStr === "bigint" ? fenStr : BigInt(Math.round(Number(fenStr)));
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
  /** 送货单数据库 ID，用于构建管理员详情页深链接 */
  readonly orderId: string;
}

/** Notify when a delivery order has been successfully signed. */
export async function notifySignComplete(
  order: SignCompletePayload,
): Promise<void> {
  try {
    const base = getAppBaseUrl();
    await postToLark(
      buildCard(
        "签收完成",
        "green",
        [
          { label: "单号", value: order.orderNo },
          { label: "客户", value: order.customerName },
          { label: "签收人", value: order.signerName },
          { label: "签收时间", value: fmtDate(order.signedAt) },
        ],
        [
          {
            label: "查看详情",
            url: `${base}/admin/orders/${order.orderId}`,
          },
        ],
      ),
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
  /** 送货单数据库 ID，用于构建司机端和管理员端详情页深链接 */
  readonly orderId: string;
}

/** Notify when a new delivery order has been received from 莱运. */
export async function notifyNewOrder(order: NewOrderPayload): Promise<void> {
  try {
    const base = getAppBaseUrl();
    await postToLark(
      buildCard(
        "新送货单",
        "blue",
        [
          { label: "单号", value: order.orderNo },
          { label: "客户", value: order.customerName },
          { label: "金额", value: fmtAmount(order.totalAmount) },
          { label: "品目数", value: String(order.itemCount) },
          { label: "送货日期", value: fmtDate(order.deliveryDate) },
        ],
        [
          // 司机端查看按钮（默认样式）
          {
            label: "司机查看",
            url: `${base}/driver/orders/${order.orderId}`,
            type: "default",
          },
          // 管理员端查看按钮（主色）
          {
            label: "管理员查看",
            url: `${base}/admin/orders/${order.orderId}`,
          },
        ],
      ),
    );
  } catch (err) {
    console.error("[lark] Failed to send new-order notification:", err);
  }
}

interface OrderRejectedPayload {
  readonly orderNo: string;
  readonly customerName: string;
  readonly reason: string;
  /** 送货单数据库 ID，用于构建管理员详情页深链接 */
  readonly orderId: string;
}

/** Notify when an order has been rejected / refused by the customer. */
export async function notifyOrderRejected(
  order: OrderRejectedPayload,
): Promise<void> {
  try {
    const base = getAppBaseUrl();
    await postToLark(
      buildCard(
        "送货单被拒收",
        "red",
        [
          { label: "单号", value: order.orderNo },
          { label: "客户", value: order.customerName },
          { label: "原因", value: order.reason },
        ],
        [
          {
            label: "查看详情",
            url: `${base}/admin/orders/${order.orderId}`,
          },
        ],
      ),
    );
  } catch (err) {
    console.error("[lark] Failed to send order-rejected notification:", err);
  }
}

interface PrintCompletedPayload {
  readonly orderNo: string;
  readonly customerName: string;
  /** 打印任务完成后跳转管理员打印任务列表，不需要具体 orderId */
}

/** Notify when a print job for a delivery order has been completed. */
export async function notifyPrintCompleted(
  order: PrintCompletedPayload,
): Promise<void> {
  try {
    const base = getAppBaseUrl();
    await postToLark(
      buildCard(
        "纸质单打印完成",
        "yellow",
        [
          { label: "单号", value: order.orderNo },
          { label: "客户", value: order.customerName },
        ],
        [
          {
            label: "查看打印任务",
            url: `${base}/admin/print-jobs`,
          },
        ],
      ),
    );
  } catch (err) {
    console.error("[lark] Failed to send print-completed notification:", err);
  }
}
