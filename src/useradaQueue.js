import { useCallback, useRef, useState } from 'react';
import { delay, findPidstavaNreg, buildFullTitle, formatRadaDate, formatRadaUrlPart } from './utils';
import { findBudstandartDoc } from './budstandart';
import { cacheGet, cacheSet, WEEK, MONTH } from './cache';

// Перевірка: чи запущено проєкт локально, чи вже на GitHub Pages
const IS_DEV = process.env.NODE_ENV === 'development';

// Функція для формування правильного URL (локально через проксі, на GitHub — через CORS-проксі)
function getProxiedUrl(targetUrl) {
  if (IS_DEV) {
    if (targetUrl.includes('data.rada.gov.ua')) {
      return targetUrl.replace('https://data.rada.gov.ua', '/rada-api');
    }
  }
  // На GitHub Pages завертаємо запит у публічний CORS-проксі
  return `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
}

export function useRadaQueue(typDict) {
  const [docsData, setDocsData] = useState({});
  const [pidstavaData, setPidstavaData] = useState({});
  const [budstandartData, setBudstandartData] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // refs — актуальные данные внутри асинхронного цикла (без проблемы устаревшего state)
  const docsRef = useRef({});
  const pidRef = useRef({});
  const bsRef = useRef({});
  const typDictRef = useRef(typDict);
  typDictRef.current = typDict;

  const abortRef = useRef(null);
  const lastRadaRef = useRef(0);
  const bsChainRef = useRef(Promise.resolve());

  const put = (ref, setter, key, val) => {
    ref.current = { ...ref.current, [key]: val };
    setter(ref.current);
  };
  const putDoc = (k, v) => put(docsRef, setDocsData, k, v);
  const putPid = (k, v) => put(pidRef, setPidstavaData, k, v);
  const putBs = (k, v) => put(bsRef, setBudstandartData, k, v);

  // Пауза 5–7 с отсчитывается от конца предыдущего запроса к Раде
  const throttle = async (signal) => {
    const gap = 5000 + Math.random() * 2000;
    const wait = Math.ceil(lastRadaRef.current + gap - Date.now());
    if (wait > 0) await delay(wait, wait, signal);
  };

  const radaGet = async (nreg, signal) => {
    for (let attempt = 0; ; attempt++) {
      await throttle(signal);
      let res;
      try {
        // Формуємо повний URL і проганяємо через обгортку getProxiedUrl
        const targetUrl = `https://data.rada.gov.ua/laws/card/${formatRadaUrlPart(nreg)}.json`;
        res = await fetch(getProxiedUrl(targetUrl), { 
          signal,
          headers: { 'Accept': 'application/json' }
        });
      } finally {
        lastRadaRef.current = Date.now();
      }
      // 429 / 5xx — ждём дольше и повторяем (до 3 попыток)
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        lastRadaRef.current = Date.now() + 5000 * (attempt + 1);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }
  };

  // Будстандарт: последовательная фоновая очередь, не блокирует цикл Ради
  const enqueueBudstandart = (nreg, apiData, signal) => {
    bsChainRef.current = bsChainRef.current.then(async () => {
      if (signal.aborted || bsRef.current[nreg]) return;
      const fullTitle = buildFullTitle(apiData, typDictRef.current);
      const result = await findBudstandartDoc(fullTitle, formatRadaDate(apiData.pridat), apiData.orgnum);
      if (result) {
        cacheSet('bs', nreg, result);
        putBs(nreg, result);
      }
      try {
        await delay(800, 1500, signal); // небольшая вежливая пауза
      } catch {
        /* остановлено */
      }
    });
  };

  const reset = useCallback(() => {
    abortRef.current?.abort();
    docsRef.current = {};
    pidRef.current = {};
    bsRef.current = {};
    setDocsData({});
    setPidstavaData({});
    setBudstandartData({});
    setProgress({ current: 0, total: 0 });
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const start = useCallback(async (items) => {
    if (abortRef.current || items.length === 0) return;
    const ctrl = new AbortController();
    const { signal } = ctrl;
    abortRef.current = ctrl;
    setIsProcessing(true);
    setProgress({ current: 0, total: items.length });

    // 0. Мгновенно подтягиваем всё, что уже есть в кэше
    const docs = { ...docsRef.current };
    const pids = { ...pidRef.current };
    const bss = { ...bsRef.current };
    for (const it of items) {
      if (!docs[it.nreg]?.apiData) {
        const c = cacheGet('card', it.nreg, it.modifiedRaw);
        if (c) {
          const pn = findPidstavaNreg(c);
          docs[it.nreg] = { apiData: c, pidstavaNreg: pn };
          if (pn && !pids[pn]?.apiData) {
            const pc = cacheGet('pidstava', pn, null, WEEK);
            if (pc) pids[pn] = { apiData: pc };
          }
        }
      }
      if (!bss[it.nreg]) {
        const b = cacheGet('bs', it.nreg, null, MONTH);
        if (b) bss[it.nreg] = b;
      }
    }
    docsRef.current = docs; pidRef.current = pids; bsRef.current = bss;
    setDocsData(docs); setPidstavaData(pids); setBudstandartData(bss);

    try {
      for (let i = 0; i < items.length; i++) {
        if (signal.aborted) break;
        const item = items[i];
        setProgress({ current: i + 1, total: items.length });

        let apiData = docsRef.current[item.nreg]?.apiData;

        // 1. Основной документ (Рада)
        if (!apiData) {
          putDoc(item.nreg, { isLoading: true });
          try {
            apiData = await radaGet(item.nreg, signal);
            cacheSet('card', item.nreg, apiData, item.modifiedRaw);
            putDoc(item.nreg, { apiData, pidstavaNreg: findPidstavaNreg(apiData) });
          } catch (err) {
            if (err.name === 'AbortError') {
              putDoc(item.nreg, {});
              throw err;
            }
            putDoc(item.nreg, { error: err.message });
            continue;
          }
        }

        // 2. Будстандарт — в фоне
        if (!bsRef.current[item.nreg]) enqueueBudstandart(item.nreg, apiData, signal);

        // 3. Підстава (Рада)
        const pn = findPidstavaNreg(apiData);
        if (pn && !pidRef.current[pn]?.apiData) {
          putPid(pn, { isLoading: true });
          try {
            const pData = await radaGet(pn, signal);
            cacheSet('pidstava', pn, pData);
            putPid(pn, { apiData: pData });
          } catch (err) {
            if (err.name === 'AbortError') {
              putPid(pn, {});
              throw err;
            }
            putPid(pn, { error: err.message });
          }
        }
      }
      await bsChainRef.current; // дождаться хвоста Будстандарта
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally {
      abortRef.current = null;
      setIsProcessing(false);
    }
  }, []);

  return { docsData, pidstavaData, budstandartData, isProcessing, progress, start, stop, reset };
}