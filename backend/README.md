# Saralash Backend

NestJS 11 + Prisma 5 + PostgreSQL.

## Ishga tushirish

```powershell
copy .env.example .env
# .env'da DATABASE_URL'ni moslang

npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

- API: http://localhost:3002/api
- Swagger: http://localhost:3002/docs

Default foydalanuvchi: `admin` / `admin123`

## Endpoints

### Auth (public)
- `POST /api/auth/login` — `{ identifier, password }` → `{ user, accessToken, refreshToken }` (`user` ichida `allowedRoutes`: `dashboard` \| `warehouse` \| `customers`)
- `POST /api/auth/refresh` — `{ refreshToken }`
- `POST /api/auth/logout` — `{ refreshToken }` (Bearer token kerak)
- `GET /api/auth/me` — Bearer token kerak

### Users — faqat `ADMIN` (Bearer)
- `GET /api/users` — barcha foydalanuvchilar (parolsiz)
- `POST /api/users` — `{ fullName, login, password, role, allowedRoutes?, positions? }` (`positions` — lavozim nomlari matn ro‘yxati, 20 tagacha)
- `PATCH /api/users/:id` — ixtiyoriy maydonlar; `password` bersangiz — kamida 4 belgi
- `DELETE /api/users/:id` — o'zingizni yoki so'nggi adminni o'chirib bo'lmaydi

### Customers (Bearer)
- `GET /api/customers?q=...`
- `GET /api/customers/:id`
- `POST /api/customers` — `{ fullName, phone, address? }`
- `PATCH /api/customers/:id`
- `DELETE /api/customers/:id`

### Warehouse (Bearer)
- `GET /api/warehouse/items?q=...&category=...`
- `POST /api/warehouse/items`
- `PATCH /api/warehouse/items/:id`
- `DELETE /api/warehouse/items/:id`
- `POST /api/warehouse/items/:id/outcomes` — `{ type: SOLD|CONSUMED, quantity, date, customerId?, customerName?, pricePerUnit?, reason?, notes? }`
- `GET /api/warehouse/outcomes?type=SOLD|CONSUMED`

## Ma'lumotlar bazasi

Prisma schema'da quyidagi modellar mavjud:
- `User`, `RefreshToken` — autentifikatsiya (`allowedRoutes` — sahifa ruxsatlari; `positions` — yozma lavozimlar)
- `Customer` — klientlar
- `SortCategory` — saralash kategoriyalari (paper/plastic/...)
- `Intake` — kelgan xomashyo (PENDING / PARTIALLY_SORTED / SORTED)
- `SortedMaterial` — saralangan xomashyo (kategoriya bo'yicha)
- `ProcessedBatch` + `ProcessedBatchSource` — press partiyasi va manbalari
- `WarehouseItem` — ombordagi mahsulot
- `WarehouseOutcome` — ombor chiqimi (sotuv/ishlatish)
