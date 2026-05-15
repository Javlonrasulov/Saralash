import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_ROUTES = ['dashboard', 'warehouse', 'sales', 'customers', 'suppliers'] as const;

async function main() {
  // Default admin
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { login: 'admin' },
    update: {
      allowedRoutes: [...ADMIN_ROUTES],
    },
    create: {
      login: 'admin',
      fullName: 'Administrator',
      role: 'ADMIN',
      passwordHash,
      allowedRoutes: [...ADMIN_ROUTES],
    },
  });

  // Default sort categories
  const categories = [
    { key: 'paper', label: "Qog'oz", emoji: '📄' },
    { key: 'plastic', label: 'Plastik', emoji: '🧴' },
    { key: 'glass', label: 'Shisha', emoji: '🍾' },
    { key: 'metal', label: 'Metall', emoji: '🔩' },
    { key: 'cardboard', label: 'Karton', emoji: '📦' },
    { key: 'other', label: 'Boshqa', emoji: '🗂️' },
  ];

  for (const c of categories) {
    await prisma.sortCategory.upsert({
      where: { key: c.key },
      update: { label: c.label, emoji: c.emoji },
      create: c,
    });
  }

  console.log('Seed completed: admin/admin123 + 6 categories');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
