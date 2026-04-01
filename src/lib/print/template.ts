import type { OrderWithItems, PrintFormat } from "./types";

// ── Formatting helpers ─────────────────────────────────────────────────────────

/** Convert 分 (integer cents) to 元 string, e.g. 12345n → "123.45" */
function fensToYuan(fens: bigint): string {
  const abs = fens < 0n ? -fens : fens;
  const sign = fens < 0n ? "-" : "";
  const whole = abs / 100n;
  const cents = abs % 100n;
  return `${sign}${whole}.${String(cents).padStart(2, "0")}`;
}

/** Format a Date as YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Shared CSS ─────────────────────────────────────────────────────────────────

function baseStyles(format: PrintFormat): string {
  const pageSize =
    format === "receipt"
      ? `@page { size: 80mm auto; margin: 4mm; }`
      : format === "dot-matrix"
        ? `@page { size: A4 landscape; margin: 10mm; }`
        : `@page { size: A4 portrait; margin: 12mm; }`;

  return `
    ${pageSize}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "SimSun", "宋体", "FangSong", serif;
      font-size: ${format === "receipt" ? "11px" : "13px"};
      color: #000;
      background: #fff;
    }
    .page { padding: ${format === "receipt" ? "4px" : "12px"}; }
    h1 {
      font-size: ${format === "receipt" ? "14px" : "18px"};
      font-weight: bold;
      text-align: center;
      letter-spacing: 2px;
      margin-bottom: 2px;
    }
    h2 {
      font-size: ${format === "receipt" ? "11px" : "13px"};
      font-weight: normal;
      text-align: center;
      margin-bottom: ${format === "receipt" ? "6px" : "8px"};
      color: #333;
    }
    .divider {
      border: none;
      border-top: 1px solid #000;
      margin: ${format === "receipt" ? "4px 0" : "6px 0"};
    }
    .divider-dashed {
      border: none;
      border-top: 1px dashed #000;
      margin: ${format === "receipt" ? "4px 0" : "6px 0"};
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: ${format === "receipt" ? "2px 8px" : "4px 16px"};
      margin-bottom: ${format === "receipt" ? "4px" : "8px"};
      font-size: ${format === "receipt" ? "11px" : "12px"};
    }
    .meta-item { white-space: nowrap; }
    .meta-label { font-weight: bold; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: ${format === "receipt" ? "4px" : "8px"};
    }
    th, td {
      border: 1px solid #000;
      padding: ${format === "receipt" ? "1px 2px" : "3px 5px"};
      text-align: center;
      vertical-align: middle;
      font-size: ${format === "receipt" ? "10px" : "12px"};
    }
    th { font-weight: bold; background: #f0f0f0; }
    td.left { text-align: left; }
    .total-row td { font-weight: bold; }
    .footer {
      margin-top: ${format === "receipt" ? "6px" : "12px"};
      font-size: ${format === "receipt" ? "10px" : "12px"};
    }
    .sig-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: ${format === "receipt" ? "16px" : "24px"};
    }
    .sig-item { min-width: 120px; }
    .company-info {
      margin-top: ${format === "receipt" ? "6px" : "10px"};
      font-size: ${format === "receipt" ? "9px" : "11px"};
      text-align: center;
      color: #333;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
}

// ── Table rows ─────────────────────────────────────────────────────────────────

function itemRows(order: OrderWithItems): string {
  return order.items
    .map((item, idx) => {
      const unitPriceYuan = fensToYuan(item.unitPrice);
      const amountYuan = fensToYuan(item.amount);
      return `
      <tr>
        <td>${idx + 1}</td>
        <td class="left">${escHtml(item.productName)}</td>
        <td>${escHtml(item.spec ?? "")}</td>
        <td>${escHtml(item.unit)}</td>
        <td>${escHtml(item.quantity)}</td>
        <td>${unitPriceYuan}</td>
        <td>${amountYuan}</td>
      </tr>`;
    })
    .join("");
}

/** Minimal HTML escaping — only what's needed for user-provided text in HTML */
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Generate a self-contained HTML delivery note for printing.
 *
 * @param order  Order with items (BigInt amounts in 分)
 * @param format Layout variant; defaults to "a4"
 */
export function generateDeliveryNoteHtml(
  order: OrderWithItems,
  format: PrintFormat = "a4",
): string {
  const totalYuan = fensToYuan(order.totalAmount);
  const dateStr = formatDate(order.deliveryDate);
  const printDateStr = formatDate(new Date());

  const colgroup =
    format === "receipt"
      ? `<col style="width:6%"><col style="width:30%"><col style="width:14%"><col style="width:8%"><col style="width:10%"><col style="width:16%"><col style="width:16%">`
      : `<col style="width:5%"><col style="width:28%"><col style="width:14%"><col style="width:7%"><col style="width:10%"><col style="width:18%"><col style="width:18%">`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>送货单 ${escHtml(order.orderNo)}</title>
  <style>${baseStyles(format)}</style>
</head>
<body>
  <div class="page">
    <h1>西安超群粮油贸易有限公司</h1>
    <h2>送 货 单</h2>
    <hr class="divider" />

    <div class="meta">
      <span class="meta-item"><span class="meta-label">单号：</span>${escHtml(order.orderNo)}</span>
      ${order.kdBillNo !== null ? `<span class="meta-item"><span class="meta-label">金蝶单号：</span>${escHtml(order.kdBillNo)}</span>` : ""}
      <span class="meta-item"><span class="meta-label">日期：</span>${dateStr}</span>
      <span class="meta-item"><span class="meta-label">客户：</span>${escHtml(order.customerName)}</span>
      ${order.customerPhone !== null ? `<span class="meta-item"><span class="meta-label">电话：</span>${escHtml(order.customerPhone)}</span>` : ""}
      ${order.customerAddress !== null ? `<span class="meta-item"><span class="meta-label">地址：</span>${escHtml(order.customerAddress)}</span>` : ""}
    </div>

    <table>
      <colgroup>${colgroup}</colgroup>
      <thead>
        <tr>
          <th>序号</th>
          <th>品名</th>
          <th>规格</th>
          <th>单位</th>
          <th>数量</th>
          <th>单价（元）</th>
          <th>金额（元）</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows(order)}
        <tr class="total-row">
          <td colspan="6" style="text-align:right; font-weight:bold;">合计金额（元）：</td>
          <td style="font-weight:bold;">${totalYuan}</td>
        </tr>
      </tbody>
    </table>

    <hr class="divider-dashed" />

    <div class="footer">
      <div class="sig-row">
        <div class="sig-item">送货人：______________</div>
        <div class="sig-item">收货人签字：______________</div>
        <div class="sig-item">日期：______________</div>
      </div>

      <div class="company-info">
        西安超群粮油贸易有限公司 &nbsp;|&nbsp;
        地址：西安市 &nbsp;|&nbsp;
        打印日期：${printDateStr}
      </div>
    </div>
  </div>
</body>
</html>`;
}
