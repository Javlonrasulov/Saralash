#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/opt/saralash-dev/backend}"
cd "$ROOT"
node --input-type=module <<'NODE'
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash('admin123', 10);
const r = await prisma.user.updateMany({
  where: { login: 'admin' },
  data: { passwordHash, isActive: true },
});
console.log('Yangilandi:', r.count, 'ta admin');
await prisma.$disconnect();
NODE
