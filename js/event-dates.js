/* 限時布置的日期（一律用臺灣時間 UTC+8）：到期就自動恢復，不用再改程式、重新上傳。
   - SPORTS_DAY_ON：第 43 屆體育表演會布置（邀請卡電視、司令臺紅布條、充氣拱門、活動中心電視牆）；到 2026/12/08 0:00 為止
   - XMAS_ON：穿堂的耶誕樹；到 2027/01/04 0:00 為止
   網址加 ?date=2026-12-09（或 2026-12-09T08:30）可以假裝今天是那一天，檢查到期以後的樣子。 */
const TW = (y, m, d) => Date.UTC(y, m - 1, d) - 8 * 3600e3;
const fake = (() => {
  try {
    const q = new URLSearchParams(location.search).get('date');
    const t = q && Date.parse(/[T ]/.test(q) ? q + (/[zZ]|[+-]\d\d:?\d\d$/.test(q) ? '' : '+08:00') : q + 'T00:00:00+08:00');
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
})();
const now = fake ?? Date.now();

export const SPORTS_DAY_ON = now < TW(2026, 12, 8);
export const XMAS_ON = now < TW(2027, 1, 4);
