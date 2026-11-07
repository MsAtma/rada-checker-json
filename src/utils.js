// ================= ПАУЗА =================
// Случайная пауза min..max мс. Можно прервать через AbortSignal.
export const delay = (min = 5000, max = 7000, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });

// ================= ФОРМАТИРОВАНИЕ =================
export const formatRadaDate = (val) => {
  if (!val) return '—';
  const s = String(val);
  if (s.length === 8) {
    return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
  }
  return s;
};

export const formatModifiedDate = (raw) => {
  if (!raw || raw === '—') return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const formatRadaUrlPart = (nreg) => {
  if (!nreg) return '';
  return nreg
    .trim()
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
};

export const getRadaLinks = (nreg) => {
  const safePath = formatRadaUrlPart(nreg);
  return {
    textHtml: `https://data.rada.gov.ua/laws/show/${safePath}`,
    cardHtml: `https://data.rada.gov.ua/laws/card/${safePath}`,
    docJson: `https://data.rada.gov.ua/laws/card/${safePath}.json`,
  };
};

// Полное наименование: "<Вид> від <дата> № <номер> <назва>"
export const buildFullTitle = (apiData, typDict) => {
  if (!apiData) return '';
  const typName = apiData.typ ? typDict[apiData.typ] || '' : '';
  return [
    typName,
    apiData.pridat ? `від ${formatRadaDate(apiData.pridat)}` : '',
    apiData.orgnum ? `№ ${apiData.orgnum}` : '',
    apiData.nazva || ''
  ]
    .filter(Boolean)
    .join(' ');
};

// ================= ЧИННІСТЬ ТА ПІДСТАВА =================
const cleanPidstavaId = (str) => {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

// Сегодня в формате YYYYMMDD (как даты в API Рады)
const todayYmd = () => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

/**
 * Определяет редакцию, которая действует НА СЕГОДНЯ.
 *  - eds  — список редакций (datred + pidstava): из него берём действующую (последняя с датой <= сегодня)
 *           и будущую (ближайшая с датой > сегодня);
 *  - hist — события (poddat): последнее событие <= сегодня даёт дату "Чинний з"
 *           (например, набрание силы после публикации).
 * Возвращает:
 *  { currentFrom, pidstavaNreg, future: { date, pidstavaNreg } | null, notYetInForce }
 *  pidstavaNreg === null означает первичную редакцию (изменений нет).
 */
export const getValidity = (apiData, today = todayYmd()) => {
  if (!apiData) return null;

  const eds = (Array.isArray(apiData.eds) ? apiData.eds : [])
    .map((e) => ({ date: Number(e.datred), pidstava: e.pidstava || '' }))
    .filter((e) => e.date);
  const hist = (Array.isArray(apiData.hist) ? apiData.hist : [])
    .map((h) => ({ date: Number(h.poddat), pidstava: h.pidstava || '' }))
    .filter((h) => h.date);

  // Нет ни редакций, ни истории — откатываемся на поля верхнего уровня
  if (eds.length === 0 && hist.length === 0) {
    return {
      currentFrom: Number(apiData.poddat) || null,
      pidstavaNreg: cleanPidstavaId(apiData.pidstava),
      future: null,
      notYetInForce: false
    };
  }

  const editions = (eds.length > 0 ? eds : hist).slice().sort((a, b) => a.date - b.date);
  const current = editions.filter((e) => e.date <= today).pop() || null;
  const next = editions.find((e) => e.date > today) || null;

  const lastEvent = hist.slice().sort((a, b) => a.date - b.date).filter((h) => h.date <= today).pop();
  const currentFrom = lastEvent?.date || current?.date || null;

  return {
    currentFrom,
    pidstavaNreg: current ? cleanPidstavaId(current.pidstava) : null,
    future: next ? { date: next.date, pidstavaNreg: cleanPidstavaId(next.pidstava) } : null,
    notYetInForce: !current && !lastEvent
  };
};

// Підстава действующей редакции (используется очередью для подгрузки карточки підстави)
export const findPidstavaNreg = (apiData) => getValidity(apiData)?.pidstavaNreg ?? null;

// ================= ФАЙЛ РЕЕСТРА =================
// Сначала UTF-8, при "�" — windows-1251
export const readFileWithEncoding = (file) =>
  new Promise((resolve) => {
    const readerUtf = new FileReader();
    readerUtf.onload = (e) => {
      const text = e.target.result;
      if (text.includes('\uFFFD')) {
        const readerWin = new FileReader();
        readerWin.onload = (eWin) => resolve(eWin.target.result);
        readerWin.readAsText(file, 'windows-1251');
      } else {
        resolve(text);
      }
    };
    readerUtf.readAsText(file, 'utf-8');
  });

export const parseInputFile = (text) => {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/\t|\s+/);
    const modifiedRaw = parts[0]?.trim();
    const nreg = parts[1]?.trim();
    const ed = parts[2]?.trim();

    if (nreg) {
      const parsedTime = modifiedRaw ? Date.parse(modifiedRaw) : null;
      results.push({
        modifiedTime: isNaN(parsedTime) ? null : parsedTime,
        modifiedRaw: modifiedRaw || '—',
        nreg,
        ed
      });
    }
  }
  return results;
};

// Фильтр по датам + уникальные nreg (остаётся самая свежая запись) + сортировка
export const prepareDocs = (rawDocs, startDate, endDate, sortAsc) => {
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() + 86400000 : null;

  const map = new Map();
  for (const item of rawDocs) {
    if (item.modifiedTime) {
      if (start && item.modifiedTime < start) continue;
      if (end && item.modifiedTime > end) continue;
    }
    const existing = map.get(item.nreg);
    if (!existing || (item.modifiedTime || 0) > (existing.modifiedTime || 0)) {
      map.set(item.nreg, item);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.modifiedTime || 0;
    const tb = b.modifiedTime || 0;
    return sortAsc ? ta - tb : tb - ta;
  });
};