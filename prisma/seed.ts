/**
 * Seed script for 西安超群粮油贸易有限公司 delivery signing system.
 * Run: pnpm db:seed  (or tsx prisma/seed.ts)
 *
 * Idempotent: deletes existing data in dependency order before re-inserting.
 */

import { PrismaClient, SignMode, OrderStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8 + Math.floor(Math.random() * 6), 0, 0, 0);
  return d;
}

function orderNo(index: number): string {
  return `CQ${new Date().getFullYear()}${String(index + 1).padStart(5, "0")}`;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🌱 Seeding database...");

  // ── 1. Clear existing data (reverse dependency order) ─────────────────────
  console.log("  Clearing existing data...");
  await prisma.auditLog.deleteMany();
  await prisma.printJob.deleteMany();
  await prisma.signRecord.deleteMany();
  await prisma.deliveryItem.deleteMany();
  await prisma.deliveryOrder.deleteMany();
  await prisma.customerConfig.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.adminUser.deleteMany();

  // ── 2. Admin users ─────────────────────────────────────────────────────────
  console.log("  Creating admin users...");
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const russellPasswordHash = await bcrypt.hash("russell123", 10);

  const [adminUser, russellUser] = await prisma.$transaction([
    prisma.adminUser.create({
      data: {
        username: "admin",
        passwordHash: adminPasswordHash,
        displayName: "管理员",
        role: "ADMIN",
        isActive: true,
      },
    }),
    prisma.adminUser.create({
      data: {
        username: "russell",
        passwordHash: russellPasswordHash,
        displayName: "Russell",
        role: "ADMIN",
        isActive: true,
      },
    }),
  ]);
  console.log(`    ✓ ${adminUser.username} (${adminUser.displayName})`);
  console.log(`    ✓ ${russellUser.username} (${russellUser.displayName})`);

  // ── 3. Drivers ─────────────────────────────────────────────────────────────
  console.log("  Creating drivers...");
  const [zhang, li, wang] = await prisma.$transaction([
    prisma.driver.create({
      data: { name: "张师傅", phone: "13800001111", isActive: true },
    }),
    prisma.driver.create({
      data: { name: "李师傅", phone: "13800002222", isActive: true },
    }),
    prisma.driver.create({
      data: { name: "王师傅", phone: "13800003333", isActive: true },
    }),
  ]);
  console.log(`    ✓ ${zhang.name} ${zhang.phone}`);
  console.log(`    ✓ ${li.name} ${li.phone}`);
  console.log(`    ✓ ${wang.name} ${wang.phone}`);

  // ── 4. Customer configs ────────────────────────────────────────────────────
  console.log("  Creating customer configs...");
  const [shiyuan, ouyaXueyuan, jiaodaShitang, changAnGov, huarun] =
    await prisma.$transaction([
      prisma.customerConfig.create({
        data: {
          kdCustomerId: "KD_CUST_001",
          customerName: "师苑餐厅",
          signMode: SignMode.DIGITAL,
          contactPhone: "02987651234",
          contactName: "刘经理",
          requirePhoto: false,
          autoPrint: false,
        },
      }),
      prisma.customerConfig.create({
        data: {
          kdCustomerId: "KD_CUST_002",
          customerName: "欧亚学院食堂",
          signMode: SignMode.BOTH,
          contactPhone: "02987652345",
          contactName: "陈主任",
          requirePhoto: false,
          autoPrint: true,
        },
      }),
      prisma.customerConfig.create({
        data: {
          kdCustomerId: "KD_CUST_003",
          customerName: "西安交大食堂",
          signMode: SignMode.DIGITAL,
          contactPhone: "02987653456",
          contactName: "赵主管",
          requirePhoto: false,
          autoPrint: false,
        },
      }),
      prisma.customerConfig.create({
        data: {
          kdCustomerId: "KD_CUST_004",
          customerName: "长安区政府机关食堂",
          signMode: SignMode.PAPER,
          contactPhone: "02987654567",
          contactName: "王科长",
          requirePhoto: false,
          autoPrint: true,
        },
      }),
      prisma.customerConfig.create({
        data: {
          kdCustomerId: "KD_CUST_005",
          customerName: "华润万家超群专柜",
          signMode: SignMode.DIGITAL,
          contactPhone: "02987655678",
          contactName: "张店长",
          requirePhoto: false,
          autoPrint: false,
        },
      }),
    ]);
  console.log(`    ✓ ${shiyuan.customerName} (${shiyuan.signMode})`);
  console.log(`    ✓ ${ouyaXueyuan.customerName} (${ouyaXueyuan.signMode})`);
  console.log(`    ✓ ${jiaodaShitang.customerName} (${jiaodaShitang.signMode})`);
  console.log(`    ✓ ${changAnGov.customerName} (${changAnGov.signMode})`);
  console.log(`    ✓ ${huarun.customerName} (${huarun.signMode})`);

  // ── 5. Delivery orders ─────────────────────────────────────────────────────
  console.log("  Creating delivery orders...");

  // Product catalog: [name, spec, unit, unitPrice(分)]
  const products: [string, string, string, bigint][] = [
    ["金龙鱼大豆油", "5L/桶", "桶", 5800n],
    ["福临门菜籽油", "5L/桶", "桶", 6200n],
    ["鲁花花生油", "5L/桶", "桶", 7800n],
    ["北大荒五常大米", "25kg/袋", "袋", 9800n],
    ["中粮福临门面粉", "25kg/袋", "袋", 6500n],
    ["金沙河挂面", "5kg/箱", "箱", 2800n],
    ["海天酱油", "1.9L/瓶", "瓶", 1580n],
    ["太太乐鸡精", "1kg/袋", "袋", 1980n],
  ];

  type ItemInput = {
    productName: string;
    spec: string;
    unit: string;
    quantity: number;
    unitPrice: bigint;
    amount: bigint;
  };

  function makeItems(indices: number[], quantities: number[]): ItemInput[] {
    return indices.map((pi, i) => {
      const [productName, spec, unit, unitPrice] = products[pi];
      const qty = quantities[i];
      return {
        productName,
        spec,
        unit,
        quantity: qty,
        unitPrice,
        amount: unitPrice * BigInt(qty),
      };
    });
  }

  function totalFrom(items: ItemInput[]): bigint {
    return items.reduce((sum, it) => sum + it.amount, 0n);
  }

  // Order 1 — PENDING, 张师傅 → 师苑餐厅
  const items1 = makeItems([0, 3, 4], [10, 2, 3]);
  const order1 = await prisma.deliveryOrder.create({
    data: {
      orderNo: orderNo(0),
      kdBillNo: "KDSALE20240001",
      customerId: shiyuan.id,
      customerName: shiyuan.customerName,
      customerPhone: shiyuan.contactPhone,
      customerAddress: "西安市雁塔区师苑路88号",
      driverId: zhang.id,
      totalAmount: totalFrom(items1),
      status: OrderStatus.PENDING,
      deliveryDate: daysAgo(1),
      items: { create: items1 },
    },
  });

  // Order 2 — PENDING, 李师傅 → 华润万家超群专柜
  const items2 = makeItems([0, 1, 6, 7], [20, 15, 30, 20]);
  const order2 = await prisma.deliveryOrder.create({
    data: {
      orderNo: orderNo(1),
      kdBillNo: "KDSALE20240002",
      customerId: huarun.id,
      customerName: huarun.customerName,
      customerPhone: huarun.contactPhone,
      customerAddress: "西安市未央区凤城八路66号华润万家",
      driverId: li.id,
      totalAmount: totalFrom(items2),
      status: OrderStatus.PENDING,
      deliveryDate: daysAgo(0),
      items: { create: items2 },
    },
  });

  // Order 3 — DELIVERED, 王师傅 → 欧亚学院食堂
  const items3 = makeItems([1, 3, 4, 5], [8, 4, 5, 10]);
  const order3 = await prisma.deliveryOrder.create({
    data: {
      orderNo: orderNo(2),
      kdBillNo: "KDSALE20240003",
      customerId: ouyaXueyuan.id,
      customerName: ouyaXueyuan.customerName,
      customerPhone: ouyaXueyuan.contactPhone,
      customerAddress: "西安市长安区郭杜教育科技产业开发区",
      driverId: wang.id,
      totalAmount: totalFrom(items3),
      status: OrderStatus.DELIVERED,
      deliveryDate: daysAgo(2),
      items: { create: items3 },
    },
  });

  // Order 4 — DELIVERED, 张师傅 → 西安交大食堂
  const items4 = makeItems([2, 3, 6], [6, 3, 24]);
  const order4 = await prisma.deliveryOrder.create({
    data: {
      orderNo: orderNo(3),
      kdBillNo: "KDSALE20240004",
      customerId: jiaodaShitang.id,
      customerName: jiaodaShitang.customerName,
      customerPhone: jiaodaShitang.contactPhone,
      customerAddress: "西安市碑林区咸宁西路28号",
      driverId: zhang.id,
      totalAmount: totalFrom(items4),
      status: OrderStatus.DELIVERED,
      deliveryDate: daysAgo(3),
      items: { create: items4 },
    },
  });

  // Order 5 — SIGNED, 李师傅 → 师苑餐厅 (with sign record)
  const items5 = makeItems([0, 4, 7], [12, 4, 8]);
  const signedAt5 = daysAgo(4);
  const order5 = await prisma.deliveryOrder.create({
    data: {
      orderNo: orderNo(4),
      kdBillNo: "KDSALE20240005",
      customerId: shiyuan.id,
      customerName: shiyuan.customerName,
      customerPhone: shiyuan.contactPhone,
      customerAddress: "西安市雁塔区师苑路88号",
      driverId: li.id,
      totalAmount: totalFrom(items5),
      status: OrderStatus.SIGNED,
      deliveryDate: daysAgo(4),
      items: { create: items5 },
      signRecord: {
        create: {
          signerName: "刘经理",
          signerPhone: shiyuan.contactPhone ?? undefined,
          signatureUrl:
            "https://oss.chaoqun.internal/signatures/sig_order5_liujingli.png",
          photoUrls: [],
          remark: "货物完好，如数收到",
          signedAt: signedAt5,
          ipAddress: "192.168.1.42",
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      },
    },
  });

  // Order 6 — SIGNED, 王师傅 → 长安区政府机关食堂 (with sign record)
  const items6 = makeItems([3, 4, 1, 5], [10, 8, 10, 6]);
  const signedAt6 = daysAgo(5);
  const order6 = await prisma.deliveryOrder.create({
    data: {
      orderNo: orderNo(5),
      kdBillNo: "KDSALE20240006",
      customerId: changAnGov.id,
      customerName: changAnGov.customerName,
      customerPhone: changAnGov.contactPhone,
      customerAddress: "西安市长安区韦曲街道政府大院",
      driverId: wang.id,
      totalAmount: totalFrom(items6),
      status: OrderStatus.SIGNED,
      deliveryDate: daysAgo(5),
      items: { create: items6 },
      signRecord: {
        create: {
          signerName: "王科长",
          signerPhone: changAnGov.contactPhone ?? undefined,
          signatureUrl:
            "https://oss.chaoqun.internal/signatures/sig_order6_wangkechang.png",
          photoUrls: [
            "https://oss.chaoqun.internal/photos/order6_goods_front.jpg",
          ],
          remark: "",
          signedAt: signedAt6,
          ipAddress: "10.10.20.5",
          userAgent:
            "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36",
        },
      },
    },
  });

  // Order 7 — REJECTED, 张师傅 → 欧亚学院食堂
  const items7 = makeItems([2, 0], [4, 8]);
  const order7 = await prisma.deliveryOrder.create({
    data: {
      orderNo: orderNo(6),
      kdBillNo: "KDSALE20240007",
      customerId: ouyaXueyuan.id,
      customerName: ouyaXueyuan.customerName,
      customerPhone: ouyaXueyuan.contactPhone,
      customerAddress: "西安市长安区郭杜教育科技产业开发区",
      driverId: zhang.id,
      totalAmount: totalFrom(items7),
      status: OrderStatus.REJECTED,
      deliveryDate: daysAgo(6),
      items: { create: items7 },
    },
  });

  // Order 8 — CANCELLED (no driver assigned)
  const items8 = makeItems([3, 1, 6], [5, 6, 12]);
  const order8 = await prisma.deliveryOrder.create({
    data: {
      orderNo: orderNo(7),
      kdBillNo: "KDSALE20240008",
      customerId: jiaodaShitang.id,
      customerName: jiaodaShitang.customerName,
      customerPhone: jiaodaShitang.contactPhone,
      customerAddress: "西安市碑林区咸宁西路28号",
      totalAmount: totalFrom(items8),
      status: OrderStatus.CANCELLED,
      deliveryDate: daysAgo(7),
      items: { create: items8 },
    },
  });

  const orders = [
    order1,
    order2,
    order3,
    order4,
    order5,
    order6,
    order7,
    order8,
  ];
  for (const o of orders) {
    console.log(
      `    ✓ ${o.orderNo}  ${o.customerName.padEnd(12)}  ${o.status}  ¥${(Number(o.totalAmount) / 100).toFixed(2)}`
    );
  }

  console.log("\n✅ Seed complete.");
  console.log(`   Admin users : 2`);
  console.log(`   Drivers     : 3`);
  console.log(`   Customers   : 5`);
  console.log(`   Orders      : ${orders.length} (2 PENDING, 2 DELIVERED, 2 SIGNED, 1 REJECTED, 1 CANCELLED)`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
