// Firmanın çalışma alanları: şehir hero'sundaki lokasyon butonlarının sırası ve kimlikleri.
// Etiketler src/locales/{tr,en}/common.json içinde `home.facilities.items.<id>` altında, şehirdeki sınırlar cityLayout.ts içinde.
export const FACILITY_IDS = [
  'hospital',
  'school',
  'kindergarten',
  'bank',
  'cableCar',
  'housing',
  'greenhouse',
  'militaryCampus',
  'culturalCenter',
  'scienceCenter',
  'airport',
] as const;

export type FacilityId = (typeof FACILITY_IDS)[number];

/** Lokasyonun renk token'ının adı (src/styles/tokens.css): `cableCar` → `--color-facility-cable-car`. */
export function facilityColorToken(id: FacilityId): string {
  return `--color-facility-${id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}
