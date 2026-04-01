# 超群签收 chaoqun-sign

粮油批发送货签收数字化系统 — H5 电子签名 + SMS + 飞书 + 金蝶云星辰

## 功能

- **H5 签收**: 客户手机端手写签名 + 拍照确认
- **司机端**: 今日送货单、标记送达、发送签收短信
- **管理后台**: 订单管理、客户配置、统计报表、审计日志
- **打印**: 网络打印机输出纸质送货单（兼容传统客户）
- **集成**: 金蝶云星辰 ERP 双向同步、飞书通知

## Tech Stack

- Next.js 15 (App Router, TypeScript)
- PostgreSQL + Prisma
- Bull + Redis
- Tailwind CSS + shadcn/ui
- Aliyun SMS / OSS

## Quick Start

```bash
# 启动数据库
docker compose up -d

# 安装依赖
pnpm install

# 数据库迁移
pnpm db:migrate

# 开发服务器
pnpm dev
```

## Docs

- [系统架构](docs/architecture.md)
- [实施计划](docs/plan.md)

## License

Private - 西安超群粮油贸易有限公司
