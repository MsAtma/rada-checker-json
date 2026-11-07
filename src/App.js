import React, { useEffect, useMemo, useState } from 'react';
import DocumentCard from './DocumentCard';
import { loadDictionary } from './dictionaries';
import { parseInputFile, readFileWithEncoding, prepareDocs, findPidstavaNreg } from './utils';
import { useRadaQueue } from './useradaQueue';

const PAGE_SIZE = 50;

// Перевірка: чи відкритий сайт локально на комп'ютері, чи на сервері (Vercel)
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Функція формування URL для проксі (локально або через api/proxy на Vercel)
function getProxiedUrl(targetUrl) {
  if (isLocalhost) {
    if (targetUrl.includes('data.rada.gov.ua')) {
      return targetUrl.replace('https://data.rada.gov.ua', '/rada-api');
    }
    if (targetUrl.includes('online.budstandart.com')) {
      return targetUrl.replace('https://online.budstandart.com', '/budstandart-api');
    }
  }

  // На сервері Vercel передаємо через наш серверний api/proxy без подвійного кодування
  const cleanUrl = decodeURI(targetUrl);
  return `/api/proxy?url=${encodeURIComponent(cleanUrl)}`;
}

// Допоміжна функція для правильного завантаження словників
function getDictUrl(path) {
  const targetUrl = `https://data.rada.gov.ua${path}`;
  return getProxiedUrl(targetUrl);
}

export default function App() {
  const [rawDocs, setRawDocs] = useState([]);
  const [fileName, setFileName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeDocs, setActiveDocs] = useState([]);
  const [page, setPage] = useState(0);

  const [typDict, setTypDict] = useState({});
  const [stanDict, setStanDict] = useState({});

  const {
    docsData, pidstavaData, budstandartData,
    isProcessing, progress, start, stop, reset
  } = useRadaQueue(typDict);

  // Словники (windows-1251) завантажуються паралельно
// Словники завантажуються миттєво з локальної пам'яті без запитів до мережі
  useEffect(() => {
    setTypDict(DEFAULT_TYP_DICT);
    setStanDict(DEFAULT_STAN_DICT);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    reset();
    setActiveDocs([]);
    const content = await readFileWithEncoding(file);
    setRawDocs(parseInputFile(content));
  };

  const handleStartProcess = (e) => {
    if (e) e.preventDefault();
    if (rawDocs.length === 0 || isProcessing) return;

    const uniqueDocs = prepareDocs(rawDocs, startDate, endDate, sortAsc);
    if (uniqueDocs.length === 0) {
      alert('За обраними датами нічого не знайдено.');
      return;
    }

    setActiveDocs(uniqueDocs);
    setPage(0);
    start(uniqueDocs);
  };

  const pageCount = Math.max(1, Math.ceil(activeDocs.length / PAGE_SIZE));
  const pageDocs = useMemo(
    () => activeDocs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [activeDocs, page]
  );

  const busy = isProcessing || rawDocs.length === 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Аналізатор документів Ради та Будстандарту</h2>
        <p style={styles.subtitle}>Моніторинг законодавчих змін, завантаження карток та зіставлення баз даних</p>
      </div>

      <div style={styles.panel}>
        {/* Вибір файлу */}
        <div style={styles.section}>
          <label style={styles.label}>Оберіть файл з реєстром (.txt, .tsv):</label>
          <div style={styles.fileUploadWrapper}>
            <input 
              type="file" 
              accept=".txt,.tsv" 
              onChange={handleFileUpload} 
              style={styles.fileInput} 
            />
            {fileName && (
              <span style={styles.fileBadge}>
                ✓ Завантажено {rawDocs.length} записів
              </span>
            )}
          </div>
        </div>

        {/* Фільтри та сортування в один ряд */}
        <div style={styles.filtersContainer}>
          <div style={styles.filterGroup}>
            <label style={styles.label}>Від:</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              style={styles.inputControl}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>До:</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              style={styles.inputControl}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>Сортування:</label>
            <button 
              type="button" 
              onClick={() => setSortAsc(!sortAsc)} 
              style={styles.sortBtn}
            >
              {sortAsc ? 'Старі → Нові ↑' : 'Нові → Старі ↓'}
            </button>
          </div>
        </div>

        {/* Кнопки дій */}
        <div style={styles.actionsRow}>
          <button
            type="button"
            disabled={busy}
            onClick={handleStartProcess}
            style={{ ...styles.btnPrimary, ...(busy ? styles.btnDisabled : {}) }}
          >
            {isProcessing
              ? `Завантаження (${progress.current}/${progress.total})... пауза 5-7 сек`
              : 'Обробити та завантажити з API'}
          </button>
          {isProcessing && (
            <button type="button" onClick={stop} style={styles.btnStop}>Стоп</button>
          )}
        </div>
      </div>

      {/* Результати */}
      {activeDocs.length > 0 && (
        <div>
          <div style={styles.resultsHeader}>
            <h3 style={styles.resultsTitle}>Знайдено унікальних документів</h3>
            <span style={styles.resultsCount}>{activeDocs.length}</span>
          </div>

          <div style={styles.cardsList}>
            {pageDocs.map((doc) => {
              const state = docsData[doc.nreg];
              const pn = state?.pidstavaNreg ?? findPidstavaNreg(state?.apiData);
              return (
                <DocumentCard
                  key={doc.nreg}
                  nreg={doc.nreg}
                  modifiedRaw={doc.modifiedRaw}
                  state={state}
                  typDict={typDict}
                  stanDict={stanDict}
                  pidstavaInfo={pn ? pidstavaData[pn] : undefined}
                  bsInfo={budstandartData[doc.nreg]}
                />
              );
            })}
          </div>

          {pageCount > 1 && (
            <div style={styles.pagination}>
              <button 
                type="button" 
                style={styles.btnLight} 
                disabled={page === 0} 
                onClick={() => setPage((p) => p - 1)}
              >
                ← Попередня
              </button>
              <span style={styles.pageIndicator}>Сторінка {page + 1} з {pageCount}</span>
              <button 
                type="button" 
                style={styles.btnLight} 
                disabled={page >= pageCount - 1} 
                onClick={() => setPage((p) => p + 1)}
              >
                Наступна →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { 
    maxWidth: '960px', 
    margin: '30px auto', 
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif', 
    padding: '0 20px',
    color: '#0f172a'
  },
  header: {
    marginBottom: '24px',
    textAlign: 'left'
  },
  title: { 
    color: '#0f172a', 
    fontSize: '24px', 
    fontWeight: '800',
    letterSpacing: '-0.025em',
    marginBottom: '6px'
  },
  subtitle: {
    color: '#64748b',
    fontSize: '14px'
  },
  panel: { 
    background: '#ffffff', 
    padding: '24px', 
    borderRadius: '16px', 
    border: '1px solid #e2e8f0', 
    marginBottom: '30px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -2px rgba(0, 0, 0, 0.02)'
  },
  section: {
    marginBottom: '20px'
  },
  label: { 
    display: 'block', 
    fontSize: '12px', 
    fontWeight: '700', 
    color: '#475569', 
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px' 
  },
  fileUploadWrapper: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px'
  },
  fileInput: {
    fontSize: '14px',
    color: '#334155',
    padding: '8px 12px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '420px',
    cursor: 'pointer'
  },
  fileBadge: { 
    background: '#f0fdf4', 
    color: '#15803d', 
    padding: '8px 12px', 
    borderRadius: '8px', 
    fontWeight: '600', 
    fontSize: '13px',
    border: '1px solid #bbf7d0'
  },
  filtersContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #f1f5f9'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  inputControl: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    background: '#f8fafc',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%'
  },
  sortBtn: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    fontWeight: '600',
    background: '#f8fafc',
    color: '#334155',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
    width: '100%'
  },
  actionsRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    paddingTop: '20px',
    borderTop: '1px solid #f1f5f9'
  },
  btnLight: { 
    padding: '10px 16px', 
    cursor: 'pointer', 
    borderRadius: '8px', 
    border: '1px solid #cbd5e1', 
    background: '#f8fafc', 
    color: '#334155',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'background 0.15s'
  },
  btnPrimary: { 
    padding: '12px 24px', 
    backgroundColor: '#2563eb', 
    color: '#fff', 
    border: 'none', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontWeight: '600', 
    fontSize: '14px',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
  },
  btnDisabled: { 
    backgroundColor: '#94a3b8', 
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  btnStop: { 
    padding: '12px 24px', 
    backgroundColor: '#dc2626', 
    color: '#fff', 
    border: 'none', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontWeight: '600', 
    fontSize: '14px',
    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
  },
  resultsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    padding: '0 4px'
  },
  resultsTitle: { 
    color: '#1e293b', 
    fontSize: '18px',
    fontWeight: '700',
    margin: 0
  },
  resultsCount: {
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '700',
    border: '1px solid #bfdbfe'
  },
  cardsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  pagination: { 
    display: 'flex', 
    gap: '16px', 
    alignItems: 'center', 
    justifyContent: 'center', 
    margin: '30px 0',
    padding: '16px',
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  },
  pageIndicator: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569'
  }
};