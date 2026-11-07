import React, { memo, useMemo } from 'react';
import { formatRadaDate, formatModifiedDate, getRadaLinks, buildFullTitle, getValidity } from './utils';

function DocumentCard({ nreg, modifiedRaw, state = {}, typDict, stanDict, pidstavaInfo, bsInfo }) {
  const { apiData, isLoading, error } = state;
  const links = getRadaLinks(nreg);

  const validity = useMemo(() => getValidity(apiData), [apiData]);
  const pidstavaNreg = validity?.pidstavaNreg || null;

  const typName = apiData?.typ ? typDict[apiData.typ] || `Тип #${apiData.typ}` : '';
  const statusName =
    apiData?.status !== undefined ? stanDict[apiData.status] || `Статус #${apiData.status}` : '—';

  const subTypes = apiData?.types
    ? String(apiData.types)
        .split('|')
        .map((t) => typDict[t.trim()] || `Категорія ${t}`)
        .join(', ')
    : '';

  const fullDocumentTitle = apiData
    ? [
        typName,
        apiData.pridat ? `від ${formatRadaDate(apiData.pridat)}` : '',
        apiData.orgnum ? `№ ${apiData.orgnum}` : '',
        apiData.nazva || ''
      ]
        .filter(Boolean)
        .join(' ')
    : 'Очікує завантаження...';

  const pidstavaLinks = pidstavaNreg ? getRadaLinks(pidstavaNreg) : null;
  const fullPidstavaTitle = pidstavaInfo?.apiData
    ? buildFullTitle(pidstavaInfo.apiData, typDict)
    : null;

  const bsSearchFallbackUrl = `https://online.budstandart.com/ua/catalog/searchdoc.html?request=${encodeURIComponent(
    apiData?.nazva || fullDocumentTitle
  )}&langbs=ua`;

  return (
    <div style={styles.card}>
      {/* Верхня панель зі статусом та часом */}
      <div style={styles.topBar}>
        <div style={styles.badgeTime}>
          <span style={styles.dot}></span>
          <span>Час у файлі: {formatModifiedDate(modifiedRaw)}</span>
        </div>
        {apiData?.status !== undefined && <span style={styles.badgeStatus}>{statusName}</span>}
      </div>

      {isLoading && (
        <div style={styles.stateMessageLoading}>
          <span style={styles.spinner}>⏳</span> Отримання картки з API Ради...
        </div>
      )}

      {error && (
        <div style={styles.stateMessageError}>
          ❌ Помилка API: {error}
        </div>
      )}

      {!apiData && !isLoading && !error && (
        <div style={styles.stateMessageIdle}>
          {nreg} — очікує завантаження...
        </div>
      )}

      {apiData && (
        <div style={styles.contentBody}>
          {/* Найменування */}
          <div style={styles.fieldBlock}>
            <div style={styles.fieldLabel}>Найменування документа</div>
            <div style={styles.titleValue}>{fullDocumentTitle}</div>
          </div>

          {/* Сітка деталей */}
          <div style={styles.detailsGrid}>
            <div style={styles.detailItem}>
              <span style={styles.fieldLabel}>Статус</span>
              <span style={styles.detailText}>{statusName}</span>
            </div>
            <div style={styles.detailItem}>
              <span style={styles.fieldLabel}>Шифр документа</span>
              <span style={{ ...styles.detailText, fontWeight: 600, color: '#0f172a' }}>
                {apiData.orgnum ? `№ ${apiData.orgnum}` : '—'}
              </span>
            </div>
            <div style={styles.detailItem}>
              <span style={styles.fieldLabel}>Дата прийняття</span>
              <span style={styles.detailText}>{formatRadaDate(apiData.pridat)}</span>
            </div>
            <div style={styles.detailItem}>
              <span style={styles.fieldLabel}>Чинний з</span>
              <span style={{ ...styles.detailText, fontWeight: 600, color: validity?.notYetInForce ? '#d97706' : '#059669' }}>
                {validity?.notYetInForce ? 'ще не набрав чинності' : formatRadaDate(validity?.currentFrom)}
              </span>
            </div>
          </div>

          {/* Блок підстави */}
          <div style={styles.pidstavaBox}>
            <div style={styles.pidstavaHeader}>Підстава змін</div>
            {!pidstavaNreg ? (
              <span style={{ color: '#94a3b8', fontSize: 13 }}>— (первинна редакція, змін немає)</span>
            ) : pidstavaInfo?.isLoading ? (
              <span style={{ color: '#d97706', fontSize: 13, fontWeight: 500 }}>Завантаження підстави...</span>
            ) : fullPidstavaTitle && pidstavaLinks ? (
              <a href={pidstavaLinks.cardHtml} target="_blank" rel="noreferrer" style={styles.pidstavaLink}>
                {fullPidstavaTitle} <span style={styles.externalIcon}>↗</span>
              </a>
            ) : (
              pidstavaLinks && (
                <a href={pidstavaLinks.cardHtml} target="_blank" rel="noreferrer" style={styles.pidstavaLink}>
                  {pidstavaNreg} <span style={styles.externalIcon}>↗</span>
                </a>
              )
            )}
            
            {validity?.future && (
              <div style={styles.futureNote}>
                ⚠️ Майбутня редакція з {formatRadaDate(validity.future.date)}
                {validity.future.pidstavaNreg && (
                  <>
                    {' '}(підстава:{' '}
                    <a
                      href={getRadaLinks(validity.future.pidstavaNreg).cardHtml}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.pidstavaLinkInline}
                    >
                      {validity.future.pidstavaNreg} ↗
                    </a>
                    )
                  </>
                )}
              </div>
            )}
          </div>

          {/* Вид документа */}
          <div style={styles.typeBlock}>
            <span style={styles.fieldLabel}>Вид документа: </span>
            <span style={{ fontWeight: 500, color: '#334155' }}>{typName || '—'}</span>
            {subTypes && <div style={styles.subTypes}>{subTypes}</div>}
          </div>
        </div>
      )}

      {/* Панель посилань */}
      <div style={styles.linksContainer}>
        <span style={styles.linksTitle}>Посилання:</span>
        <div style={styles.linksGroup}>
          <a href={links.textHtml} target="_blank" rel="noreferrer" style={styles.linkBtn}>Текст (HTML)</a>
          <a href={links.cardHtml} target="_blank" rel="noreferrer" style={styles.linkBtn}>Картка (HTML)</a>
          <a href={links.docJson} target="_blank" rel="noreferrer" style={styles.linkBtn}>JSON</a>

          {bsInfo?.directUrl ? (
            <a
              href={bsInfo.directUrl}
              target="_blank"
              rel="noreferrer"
              style={styles.bsDirectBtn}
              title={`Знайдено id_doc=${bsInfo.idDoc}`}
            >
              ✓ Будстандарт ↗
            </a>
          ) : (
            <a href={bsSearchFallbackUrl} target="_blank" rel="noreferrer" style={styles.bsSearchBtn}>
              🔍 Будстандарт (Пошук)
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(DocumentCard);

const styles = {
  card: { 
    border: '1px solid #e2e8f0', 
    borderRadius: '12px', 
    padding: '20px', 
    marginBottom: '16px', 
    background: '#ffffff', 
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -2px rgba(0, 0, 0, 0.02)',
    transition: 'all 0.2s ease-in-out',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  topBar: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    flexWrap: 'wrap', 
    gap: '8px', 
    paddingBottom: '12px', 
    borderBottom: '1px solid #f1f5f9' 
  },
  badgeTime: { 
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#f8fafc', 
    color: '#475569', 
    padding: '5px 10px', 
    borderRadius: '6px', 
    fontWeight: 500, 
    fontSize: '12px',
    border: '1px solid #e2e8f0'
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6'
  },
  badgeStatus: { 
    background: '#ecfdf5', 
    color: '#047857', 
    padding: '4px 10px', 
    borderRadius: '6px', 
    fontSize: '12px', 
    fontWeight: '600',
    border: '1px solid #a7f3d0'
  },
  stateMessageLoading: { 
    color: '#2563eb', 
    padding: '16px 0', 
    fontSize: '14px',
    fontWeight: '500'
  },
  stateMessageError: { 
    color: '#dc2626', 
    padding: '16px 0', 
    fontSize: '14px',
    fontWeight: '500'
  },
  stateMessageIdle: { 
    color: '#64748b', 
    padding: '16px 0', 
    fontSize: '14px' 
  },
  contentBody: {
    marginTop: '14px'
  },
  fieldBlock: { 
    marginBottom: '16px' 
  },
  fieldLabel: { 
    color: '#64748b', 
    fontSize: '11px', 
    fontWeight: '700', 
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
    display: 'block'
  },
  titleValue: { 
    fontSize: '16px', 
    fontWeight: '700', 
    color: '#0f172a', 
    lineHeight: '1.5' 
  },
  detailsGrid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
    gap: '12px', 
    background: '#f8fafc',
    padding: '14px',
    borderRadius: '8px',
    border: '1px solid #f1f5f9',
    margin: '14px 0' 
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  detailText: {
    fontSize: '13px',
    color: '#334155'
  },
  pidstavaBox: { 
    background: '#fffbeb', 
    padding: '12px 16px', 
    borderRadius: '8px', 
    fontSize: '13px', 
    margin: '14px 0', 
    border: '1px solid #fde68a',
    borderLeft: '4px solid #f59e0b', 
    lineHeight: '1.5' 
  },
  pidstavaHeader: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px'
  },
  pidstavaLink: { 
    color: '#1d4ed8', 
    textDecoration: 'none', 
    fontWeight: '600',
    display: 'inline-block'
  },
  pidstavaLinkInline: {
    color: '#1d4ed8',
    textDecoration: 'underline',
    fontWeight: '500'
  },
  externalIcon: {
    fontSize: '11px',
    opacity: 0.8
  },
  futureNote: { 
    marginTop: '8px', 
    fontSize: '12px', 
    color: '#92400e',
    background: '#fef3c7',
    padding: '6px 10px',
    borderRadius: '4px',
    display: 'inline-block'
  },
  typeBlock: {
    marginTop: '14px', 
    fontSize: '13px',
    background: '#f8fafc',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #f1f5f9'
  },
  subTypes: { 
    fontSize: '12px', 
    color: '#64748b', 
    marginTop: '4px', 
    fontStyle: 'italic' 
  },
  linksContainer: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    gap: '12px', 
    marginTop: '16px', 
    paddingTop: '14px', 
    borderTop: '1px solid #f1f5f9', 
    flexWrap: 'wrap' 
  },
  linksTitle: { 
    fontSize: '12px', 
    fontWeight: '700', 
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  linksGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap'
  },
  linkBtn: { 
    padding: '6px 10px', 
    background: '#f8fafc', 
    color: '#2563eb', 
    textDecoration: 'none', 
    borderRadius: '6px', 
    fontSize: '12px', 
    fontWeight: '500', 
    border: '1px solid #e2e8f0',
    transition: 'background 0.15s'
  },
  bsDirectBtn: { 
    padding: '6px 10px', 
    background: '#f0fdf4', 
    color: '#15803d', 
    textDecoration: 'none', 
    borderRadius: '6px', 
    fontSize: '12px', 
    fontWeight: '600', 
    border: '1px solid #bbf7d0' 
  },
  bsSearchBtn: { 
    padding: '6px 10px', 
    background: '#fffbeb', 
    color: '#b45309', 
    textDecoration: 'none', 
    borderRadius: '6px', 
    fontSize: '12px', 
    fontWeight: '500', 
    border: '1px solid #fde68a' 
  },
};