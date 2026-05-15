# Saralash — Xomashyo qayta ishlash tizimi

Korxona ichidagi xomashyoni saralash, qayta ishlash (press) va omborda hisob yuritish uchun mo'ljallangan ERP/CRM tizimi.

## Texnologiyalar

| Qism      | Texnologiya                                                              |
| --------- | ------------------------------------------------------------------------ |
| Frontend  | React 18 + TypeScript + Vite + Tailwind CSS 4 + Radix UI + react-router  |
| Backend   | Node.js + NestJS 11 + Prisma + JWT (passport-jwt)                        |
| Database  | PostgreSQL                                                               |

## Modullar

- **Bosh sahifa (Dashboard)** — KPI kartalar, ombor xulosasi, oxirgi harakatlar
- **Ombor (Warehouse)** — mahsulot CRUD, kategoriya filtri, sotuv yoki ishlatish (chiqim)
- **Klientlar (Customers)** — F.I.Sh., telefon, manzil, oxirgi xarid, umumiy xarid summasi (CRUD)
- **Tizim foydalanuvchilari** — login/parol, lavozim, qaysi sahifalar ochiq (faqat admin; backend bilan)

## Responsive

- Mobile (320px+) — kartalar va sheet/drawer
- Tablet (768px+) — sidebar + jadval
- Desktop (1024px+) — kengaytirilgan sidebar + tartibga solingan kontent

## Tuzilma

```
Saralash/
├── backend/                  NestJS + Prisma + Postgres
│   ├── prisma/
│   │   ├── schema.prisma     ma'lumotlar bazasi modellari
│   │   └── seed.ts           default admin + 6 kategoriya
│   └── src/
│       ├── common/           filters, guards, decorators
│       ├── prisma/           PrismaService (Global)
│       ├── modules/
│       │   ├── auth/         JWT login/refresh/me/logout
│       │   ├── customers/    CRM CRUD
│       │   ├── warehouse/    ombor + chiqim (sotuv/ishlatish)
│       ├── app.module.ts
│       └── main.ts
└── src/                      React + Vite frontend
    ├── app/
    │   ├── api/              (kelajakdagi HTTP client uchun)
    │   ├── auth/             AuthProvider + LoginScreen
    │   ├── components/
    │   │   ├── Layout.tsx    sidebar + header (responsive)
    │   │   └── ui/           shadcn-style: Button, Card, Dialog,
    │   │                     Table, Select, Tabs, Badge, Sonner...
    │   ├── i18n/             3 til: uz_latin, uz_cyrillic, ru
    │   ├── pages/
    │   │   ├── Dashboard.tsx
    │   │   ├── Warehouse.tsx ombor (stock/sold/used)
    │   │   └── Customers.tsx klientlar
    │   ├── store/            Context + reducer (localStorage persist)
    │   ├── utils/            format, category meta
    │   ├── App.tsx
    │   └── routes.tsx
    └── styles/               Tailwind + theme tokens (light/dark)
```

## Ishga tushirish

### 1. Frontend (mock holatida ishlaydi, backend kerak emas)

```powershell
cd C:\Users\javlo\Desktop\Saralash
npm install
npm run dev
```

Ochiladi: http://localhost:5174

Demo login: `admin` / `admin123`

> Hozircha frontend `localStorage`-ga ma'lumotlarni saqlaydi —
> backendsiz to'liq ishlaydi. Backend tayyor bo'lsa, `src/app/api/`
> ga HTTP client qo'shib bog'lash mumkin.

### 2. Backend (PostgreSQL kerak)

```powershell
cd C:\Users\javlo\Desktop\Saralash\backend
copy .env.example .env
# .env ichida DATABASE_URL ni o'zingiznikiga moslang

npm install
npx prisma migrate dev --name init
npm run prisma:seed     # admin/admin123 + 6 kategoriya
npm run start:dev
```

Backend: http://localhost:3002/api  
Swagger: http://localhost:3002/docs

## Frontend dizayn tili

- Asosiy rang: `indigo-600` + `bg-gradient-to-br from-indigo-500 to-blue-600`
- Card: `rounded-2xl border bg-white dark:bg-slate-800 shadow-sm`
- Button: `h-10 rounded-xl` (primary indigo, outline, ghost, destructive)
- Input: `h-10 rounded-xl bg-slate-50` + indigo focus ring
- Kategoriya ranglari: paper=amber, plastic=blue, glass=cyan, metal=slate, cardboard=orange, other=violet
- Dark/Light mode: `next-themes`, header'dagi quyosh/oy tugmasi
- 3 ta til: o'ng yuqori burchakda til dropdowni
- Sidebar: 64px (yopiq) ↔ 256px (ochiq), mobile'da `Sheet` overlay

## Mavjud foydalanuvchi tajribasi

- ✅ CRUD jadvallar (mobile'da kartalarga avtomatik aylanadi)
- ✅ Filter + search har sahifada
- ✅ Modal (Dialog) orqali qo'shish/tahrirlash
- ✅ AlertDialog orqali tasdiqli o'chirish
- ✅ Toast bildirishnomalar (sonner)
- ✅ Tabs orqali holat bo'yicha bo'lim almashish
- ✅ Real vaqtdagi balans hisobi (qoldiq, status badge)

## Yo'l xaritasi

1. ✅ Frontend mock store bilan to'liq ishlaydi
2. ✅ Backend NestJS + Prisma skeleti tayyor
3. ⏳ Frontend'ni real backend bilan bog'lash (`http.ts` + tokenlar)
4. ⏳ Hisobotlar va chart sahifasi
5. ⏳ Excel eksport (xlsx)
