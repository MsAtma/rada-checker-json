// Справочники Рады (typ.txt, stan.txt) приходят в windows-1251: читаем байты и декодируем вручную.
export const loadDictionary = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};

    const buffer = await res.arrayBuffer();
    const text = new TextDecoder('windows-1251').decode(buffer);

    const map = {};
    text.split(/\r?\n/).forEach((line) => {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        map[parts[0].trim()] = parts[1].trim();
      }
    });
    return map;
  } catch (e) {
    console.error('Помилка завантаження словника:', url, e);
    return {};
  }
};