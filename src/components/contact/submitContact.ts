/**
 * İletişim formunun gönderimi.
 *
 * Formun hangi servise gideceği henüz kararlaştırılmadı (PROGRESS.md › Açık Kararlar). Karar verilince adres
 * `CONTACT_ENDPOINT` içine yazılır. O zamana kadar form ağ isteği yapmaz, kullanıcıya görünür yer tutucu gösterilir.
 */
const CONTACT_ENDPOINT: string | null = null;

export type ContactPayload = {
  topic: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  language: string;
};

export class ContactNotConfiguredError extends Error {
  constructor() {
    super('İletişim formu için gönderim servisi tanımlı değil.');
  }
}

export async function submitContact(payload: ContactPayload): Promise<void> {
  if (!CONTACT_ENDPOINT) throw new ContactNotConfiguredError();

  const response = await fetch(CONTACT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
