// Кэш в localStorage. Запись = { v, stamp, ts }.
//  - stamp: если задан, запись валидна только при совпадении (для карточек — modified из файла)
//  - ttl: максимальный возраст записи в мс
const KEY = 'rada-cache-v2';
let mem = null;
let timer = null;

const load = () => {
  if (mem) return mem;
  try {
    mem = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    mem = {};
  }
  return mem;
};

export const cacheGet = (ns, key, stamp = null, ttl = null) => {
  const e = load()[`${ns}:${key}`];
  if (!e) return null;
  if (stamp !== null && e.stamp !== stamp) return null;
  if (ttl && Date.now() - e.ts > ttl) return null;
  return e.v;
};

export const cacheSet = (ns, key, v, stamp = null) => {
  load()[`${ns}:${key}`] = { v, stamp, ts: Date.now() };
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(mem));
    } catch (e) {
      console.warn('Кеш не збережено (ймовірно, перевищено ліміт localStorage):', e);
    }
  }, 500);
};

export const cacheClear = () => {
  mem = {};
  localStorage.removeItem(KEY);
};

export const WEEK = 7 * 24 * 3600 * 1000;
export const MONTH = 30 * 24 * 3600 * 1000;