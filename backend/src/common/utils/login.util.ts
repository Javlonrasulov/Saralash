/** Login: bo‘sh joylarni kesish; kirill/lotin registrini saqlash. */
export function normalizeLoginInput(raw: string): string {
  return raw.trim();
}

export function isValidLogin(login: string): boolean {
  const s = normalizeLoginInput(login);
  return s.length >= 2 && s.length <= 64;
}

/** Demo tizim kirishi uchun band (faqat lotin, registrsiz). */
export function isReservedBuiltinLogin(login: string): boolean {
  return normalizeLoginInput(login).toLowerCase() === 'admin';
}
