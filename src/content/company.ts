/**
 * Firmanın iletişim bilgileri: sitenin tek kaynağı. İletişim sayfası, footer ve bilgilerin göründüğü her yer
 * buradan okur. Bilgi değişince yalnızca bu dosya düzenlenir.
 *
 * Değerler dile bağlı değildir, etiketler (Telefon, E-posta, Adres...) ortak çeviri dosyasından (`company.labels`) gelir.
 * Bağlantı adresleri (`tel:`, `mailto:`, harita) aşağıdaki yardımcılarla bu değerlerden üretilir, ayrıca yazılmaz.
 * Listelerde ilk sıradaki ana iletişim bilgisidir, tek değer gösterilecek yerlerde o kullanılır.
 */
export const COMPANY = {
  name: 'ERGU ENERJİ',
  /** Ekranda göründüğü haliyle. Arama bağlantısı bundan üretilir. */
  phones: ['+90 312 577 81 88', '+90 533 087 06 14'],
  emails: ['info@erguenerji.com', 'yapun79@mail.ru'],
  address: {
    /** Tam adres, satır satır. */
    lines: ['İvedikköy Mahallesi 1499. Sokak No: 8', 'İç Kapı No: 68 - 102 (Bulvar Anatolia İş Merkezi)', 'Yenimahalle / Ankara'],
    /** Dar yerlerde (liste satırı, footer) kullanılan kısa hali. */
    short: 'Yenimahalle / Ankara',
    /** Google Haritalar'da aranacak adres. Harita bu noktayı ortalar. */
    mapQuery: 'İvedikköy Mahallesi 1499. Sokak No: 8, Yenimahalle, Ankara, Türkiye',
  },
  social: {
    linkedin: 'https://www.linkedin.com/company/ergu-enerji-energy-solution-point/',
  },
  /**
   * Çalışma saatleri. Açık/kapalı durumu ziyaretçinin değil firmanın saat dilimine göre hesaplanır.
   * Her grup aynı saatlerde açık olan günlerdir. Günler: 0 pazar, 1 pazartesi ... 6 cumartesi; bir gruptaki günler
   * ardışık olmalıdır ("Pzt–Cum" gibi yazılır). Hiçbir grupta olmayan günler kapalı sayılır ve öyle yazılır.
   */
  hours: {
    timeZone: 'Europe/Istanbul',
    schedule: [
      { days: [1, 2, 3, 4, 5], open: '09:00', close: '18:30' },
      { days: [6], open: '10:30', close: '15:30' },
    ],
  },
} as const;

/** `+90 312 555 01 23` → `tel:+903125550123` */
export function toPhoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function toEmailHref(email: string): string {
  return `mailto:${email}`;
}

const MAP_QUERY = encodeURIComponent(COMPANY.address.mapQuery);

export const MAP_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${MAP_QUERY}`;
export const MAP_SEARCH_URL = `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`;

export function getMapEmbedUrl(language: string): string {
  return `https://www.google.com/maps?q=${MAP_QUERY}&hl=${language}&z=15&output=embed`;
}
