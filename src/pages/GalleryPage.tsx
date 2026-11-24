import '../i18n/gallery';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageRevealHold } from '../animations/pageReveal';
import { GalleryCarousel } from '../components/gallery/GalleryCarousel';
import { useGalleryImages } from '../components/gallery/useGalleryImages';
import { PageHero } from '../components/layout/PageHero/PageHero';
import { useHiddenScrollbar } from '../hooks/useHiddenScrollbar';
import styles from './GalleryPage.module.css';

// Perde, liste ve öndeki fotoğraflar gelene kadar bekler; yavaş bağlantıda sayfa perdede kalmasın diye sınırlıdır.
const REVEAL_HOLD_MS = 6000;

/** Galeri: fotoğraflar yöneticiler tarafından yüklenir, liste API'den gelir (galleryApi.ts). */
export function GalleryPage() {
  const { t, i18n } = useTranslation();
  const { t: tGallery } = useTranslation('gallery');
  const state = useGalleryImages();
  // Galeri silindirle gezilir, dikey scrollbar yanıltıcı olurdu.
  useHiddenScrollbar();
  const [isCarouselReady, setCarouselReady] = useState(false);
  const hasImages = state.status === 'ready' && state.images.length > 0;
  // Tek bekletme: liste gelince bırakılıp silindir için yeniden alınsaydı aradaki anda perde kalkabilirdi.
  const isPageReady = state.status === 'error' || (state.status === 'ready' && (!hasImages || isCarouselReady));
  usePageRevealHold(isPageReady, REVEAL_HOLD_MS);

  return (
    <>
      <PageHero title={t('nav.main.gallery').toLocaleUpperCase(i18n.language)} />
      {state.status === 'ready' && hasImages ? (
        <GalleryCarousel images={state.images} onReady={() => setCarouselReady(true)} />
      ) : (
        <section className={styles.status} data-surface="light">
          <p className={styles.message} role="status">
            {state.status === 'loading' && tGallery('status.loading')}
            {state.status === 'error' && tGallery('status.error')}
            {state.status === 'ready' && tGallery('status.empty')}
          </p>
        </section>
      )}
    </>
  );
}
