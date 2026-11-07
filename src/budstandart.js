// Поиск точного id_doc в Будстандарте через прокси /budstandart-api
// Сверка: дата принятия + номер (или начало названия)
export const findBudstandartDoc = async (fullTitle, expectedDate, orgNum) => {
  if (!fullTitle) return null;

  try {
    const searchQuery = orgNum ? `№ ${orgNum}` : fullTitle.slice(0, 60);
    const searchUrl = `/budstandart-api/ua/catalog/searchdoc.html?request=${encodeURIComponent(searchQuery)}&langbs=ua`;

    const res = await fetch(searchUrl);
    if (!res.ok) return null;

    const htmlText = await res.text();
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    const resultBlocks = doc.querySelectorAll('.bgrezultsearch, .row.bgrezultsearch');

    for (const block of resultBlocks) {
      const linkEl = block.querySelector('a[href*="id_doc="]');
      if (!linkEl) continue;

      const href = linkEl.getAttribute('href') || '';
      const match = href.match(/id_doc=(\d+)/);
      if (!match || !match[1]) continue;

      const foundIdDoc = match[1];
      const foundTitle = linkEl.textContent.trim().toLowerCase();
      const blockText = block.textContent.trim();

      let dateMatched = true;
      if (expectedDate && expectedDate !== '—') {
        dateMatched = blockText.includes(expectedDate);
      }

      let titleMatched = true;
      if (orgNum) {
        titleMatched = foundTitle.includes(String(orgNum).toLowerCase());
      } else {
        titleMatched = foundTitle.includes(fullTitle.toLowerCase().slice(0, 30));
      }

      if (dateMatched && titleMatched) {
        return {
          idDoc: foundIdDoc,
          directUrl: `https://online.budstandart.com/ua/catalog/doc-page.html?id_doc=${foundIdDoc}`
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Помилка перевірки в Будстандарті:', err);
    return null;
  }
};