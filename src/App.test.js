import React, { useState, useEffect } from 'react';

// ================= 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =================

// Пауза от 5 до 7 секунд (требование регламента API Рады)
const delay = (min = 5000, max = 7000) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Форматирование даты из YYYYMMDD в ДД.ММ.ГГГГ
const formatRadaDate = (val) => {
  if (!val) return '—';
  const s = String(val);
  if (s.length === 8) {
    return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
  }
  return s;
};

// Парсер загружаемого TXT/TSV файла
const parseInputFile = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const results = [];
  // Начинаем с 1, пропуская первую строку с заголовками
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [modified, nreg, ed] = line.split(/\t|\s+/);
    if (nreg) {
      results.push({
        modified: modified ? new Date(modified) : null,
        modifiedRaw: modified,
        nreg,
        ed
      });
    }
  }
  return results;
};

// Формирование регламентных ссылок на Раду
const getRadaLinks = (nreg) => ({
  textHtml: `https://data.rada.gov.ua/laws/show/${nreg}`,
  cardHtml: `https://data.rada.gov.ua/laws/card/${nreg}`,
  docJson: `https://data.rada.gov.ua/laws/show/${nreg}.json`,
  cardJson: `https://data.rada.gov.ua/laws/card/${nreg}.json`,
  textTxt: `https://data.rada.gov.ua/laws/show/${nreg}.txt`,
});

// Загрузка текстовых справочников Рады (ID \t Название)
const loadDictionary = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const text = await res.text();
    const map = {};
    text.split(/\r?\n/).forEach((line) => {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        map[parts[0].trim()] = parts[1].trim();
      }
    });
    return map;
  } catch (e) {
    console.error('Ошибка загрузки справочника:', url, e);
    return {};
  }
};

// ================= 2. КОМПОНЕНТ КАРТОЧКИ =================

function DocumentCard({ doc, typDict, stanDict }) {
  const { nreg, modifiedRaw, apiData, isLoading, error } = doc;
  const links = getRadaLinks(nreg);

  // Состояние до отправки запроса
  if (!isLoading && !apiData && !error) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.badgeNreg}>{nreg}</span>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Очікує завантаження з API...</span>
        </div>
        <div style={{ fontSize: '13px', marginTop: '6px' }}>
          <strong>Час модифікації у файлі:</strong> {modifiedRaw}
        </div>
      </div>
    );
  }

  // Загрузка
  if (isLoading) {
    return (
      <div style={styles.card}>
        <span style={styles.badgeNreg}>{nreg}</span> — Завантаження картки з API Ради...
      </div>
    );
  }

  // Ошибка
  if (error || !apiData) {
    return (
      <div style={{ ...styles.card, borderColor: '#f87171' }}>
        <span style={styles.badgeNreg}>{nreg}</span>: Помилка — {error || 'Не вдалося завантажити дані'}
      </div>
    );
  }

  // Расшифровка статуса и типа
  const statusName = stanDict[apiData.status] || `Статус #${apiData.status}`;
  const mainTypeName = typDict[apiData.typ] || `Тип #${apiData.typ}`;
  
  const subTypes = apiData.types
    ? String(apiData.types)
        .split('|')
        .map((t) => typDict[t.trim()] || `Тип ${t}`)
    : [];

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <span style={styles.badgeNreg}>{nreg}</span>
          {apiData.orgnum && <span style={styles.badgeNum}>№ {apiData.orgnum}</span>}
        </div>
        <span style={styles.badgeStatus}>{statusName}</span>
      </div>

      <h3 style={styles.title}>{apiData.nazva || 'Без назви'}</h3>

      <div style={styles.gridDates}>
        <div><strong>Створено (pridat):</strong> {formatRadaDate(apiData.pridat)}</div>
        <div><strong>Нова редакція (poddat):</strong> {formatRadaDate(apiData.poddat)}</div>
        <div><strong>Час модифікації (файл):</strong> {modifiedRaw}</div>
      </div>

      {apiData.pidstava && (
        <div style={styles.pidstavaBox}>
          <strong>Підстава:</strong> {apiData.pidstava}
          {apiData.pridat && <span> (від {formatRadaDate(apiData.pridat)})</span>}
        </div>
      )}

      <div style={styles.typeSection}>
        <div><strong>Основний тип:</strong> {mainTypeName}</div>
        {subTypes.length > 0 && (
          <div style={styles.subTypes}>
            Категорії (types): {subTypes.join(', ')}
          </div>
        )}
      </div>

      <div style={styles.links}>
        <span>Посилання:</span>
        <a href={links.textHtml} target="_blank" rel="noreferrer">Текст (HTML)</a>
        <a href={links.cardHtml} target="_blank" rel="noreferrer">Картка (HTML)</a>
        <a href={links.docJson} target="_blank" rel="noreferrer">JSON</a>
        <a href={links.textTxt} target="_blank" rel="noreferrer">TXT</a>
      </div>
    </div>
  );
}

// ================= 3. ГЛАВНЫЙ КОМПОНЕНТ =================

export default function App() {
  const [rawDocs, setRawDocs] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [docsData, setDocsData] = useState({});
  
  const [typDict, setTypDict] = useState({});
  const [stanDict, setStanDict] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Загружаем справочники при открытии страницы
  useEffect(() => {
    async function initDicts() {
      const types = await loadDictionary('/rada-api/ogd/zak/laws/data/csv/typ.txt');
      const stans = await loadDictionary('/rada-api/ogd/zak/laws/data/csv/stan.txt');
      setTypDict(types);
      setStanDict(stans);
    }
    initDicts();
  }, []);

  // Чтение загруженного файла
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const parsed = parseInputFile(event.target.result);
      setRawDocs(parsed);
    };
    reader.readAsText(file);
  };

  // Фильтрация по датам и сортировка
  const filteredAndSortedDocs = rawDocs
    .filter((doc) => {
      if (!doc.modified) return true;
      const docTime = doc.modified.getTime();
      if (startDate && docTime < new Date(startDate).getTime()) return false;
      if (endDate && docTime > new Date(endDate).getTime() + 86400000) return false;
      return true;
    })
    .sort((a, b) => {
      const timeA = a.modified ? a.modified.getTime() : 0;
      const timeB = b.modified ? b.modified.getTime() : 0;
      return sortAsc ? timeA - timeB : timeB - timeA;
    });

  // Запуск очереди запросов к API с паузой 5-7 сек
  const startApiFetching = async () => {
    if (filteredAndSortedDocs.length === 0 || isProcessing) return;

    setIsProcessing(true);
    const total = filteredAndSortedDocs.length;

    for (let i = 0; i < total; i++) {
      const item = filteredAndSortedDocs[i];
      setProgress({ current: i + 1, total });

      if (docsData[item.nreg]?.apiData) continue;

      setDocsData((prev) => ({
        ...prev,
        [item.nreg]: { isLoading: true }
      }));

      try {
        const res = await fetch(`/rada-api/laws/card/${encodeURIComponent(item.nreg)}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setDocsData((prev) => ({
          ...prev,
          [item.nreg]: { apiData: data, isLoading: false }
        }));
      } catch (err) {
        setDocsData((prev) => ({
          ...prev,
          [item.nreg]: { error: err.message, isLoading: false }
        }));
      }

      // Пауза 5–7 секунд перед каждым следующим запросом
      if (i < total - 1) {
        await delay(5000, 7000);
      }
    }

    setIsProcessing(false);
  };

  return (
    <div style={{ maxWidth: '850px', margin: '20px auto', fontFamily: 'system-ui, sans-serif', padding: '0 15px' }}>
      <h2>Аналізатор документів Ради</h2>

      {/* Панель управления */}
      <div style={styles.panel}>
        <div style={{ marginBottom: '14px' }}>
          <label><strong>1. Оберіть файл з даними (.txt / .tsv): </strong></label><br />
          <input type="file" accept=".txt,.tsv" onChange={handleFileUpload} style={{ marginTop: '6px' }} />
        </div>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <label>Від: </label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label>До: </label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button 
            type="button" 
            onClick={() => setSortAsc(!sortAsc)}
            style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            Сортування: {sortAsc ? 'Спочатку старі ↑' : 'Спочатку нові ↓'}
          </button>
        </div>

        <div>
          <button
            type="button"
            disabled={isProcessing || filteredAndSortedDocs.length === 0}
            onClick={startApiFetching}
            style={{
              padding: '10px 18px',
              backgroundColor: isProcessing ? '#94a3b8' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: isProcessing || filteredAndSortedDocs.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isProcessing ? `Обробка (${progress.current}/${progress.total})... пауза 5-7с` : 'Завантажити дані з API Ради'}
          </button>
        </div>
      </div>

      {/* Список документов */}
      <div>
        <h3>Знайдено у файлі: {filteredAndSortedDocs.length}</h3>
        {filteredAndSortedDocs.length === 0 && (
          <p style={{ color: '#64748b' }}>Завантажте файл зі списком документів, щоб побачити картки.</p>
        )}
        {filteredAndSortedDocs.map((doc) => (
          <DocumentCard
            key={doc.nreg}
            doc={{
              ...doc,
              ...(docsData[doc.nreg] || {})
            }}
            typDict={typDict}
            stanDict={stanDict}
          />
        ))}
      </div>
    </div>
  );
}

// ================= СТИЛИ =================
const styles = {
  panel: { background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '20px' },
  card: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '14px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  badgeNreg: { background: '#2563eb', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' },
  badgeNum: { marginLeft: '8px', background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px' },
  badgeStatus: { background: '#10b981', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '13px' },
  title: { margin: '8px 0', fontSize: '16px', lineHeight: '1.4', color: '#1e293b' },
  gridDates: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '13px', margin: '8px 0' },
  pidstavaBox: { background: '#fef3c7', padding: '6px 10px', borderRadius: '4px', fontSize: '13px', margin: '6px 0' },
  typeSection: { fontSize: '13px', margin: '6px 0' },
  subTypes: { fontSize: '11px', color: '#64748b', marginTop: '2px' },
  links: { display: 'flex', gap: '10px', marginTop: '10px', fontSize: '13px' }
};