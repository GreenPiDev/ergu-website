import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Locale } from '../../i18n/locale';

/**
 * Sertifikalar yönetim panelinden yüklenir (`/admin-panel/certificates`), liste sitenin kendi API'sinden gelir
 * (`GET /api/certificates`, `server/imageCollection.ts`). Görseller de aynı adresten aktarılır, proje dosyalarında
 * tutulmaz. Başlık ve açıklama isteğe bağlıdır; İngilizce boşsa Türkçe metin gösterilir.
 */
const API_URL = '/api/certificates';

const localizedSchema = z.object({ tr: z.string().default(''), en: z.string().default('') });

const certificateSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  thumbUrl: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  title: localizedSchema,
  description: localizedSchema,
});

const responseSchema = z.object({ images: z.array(certificateSchema) });

export type Certificate = z.infer<typeof certificateSchema>;

export async function fetchCertificates(signal: AbortSignal): Promise<Certificate[]> {
  const response = await fetch(API_URL, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Sertifikalar yüklenemedi: ${response.status}`);
  return responseSchema.parse(await response.json()).images;
}

/** Metnin aktif dildeki hâli: İngilizce boşsa Türkçesi. İkisi de boşsa boş metin. */
export function localizedText(text: Certificate['title'], language: string): string {
  const locale: Locale = language === 'en' ? 'en' : 'tr';
  return (text[locale] || text.tr).trim();
}

export type CertificatesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; certificates: Certificate[] };

/** Listeyi bir kez çeker. Sayfadan çıkılırsa istek iptal edilir. */
export function useCertificates(): CertificatesState {
  const [state, setState] = useState<CertificatesState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetchCertificates(controller.signal)
      .then((certificates) => setState({ status: 'ready', certificates }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, []);

  return state;
}
