import '../i18n/contact';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap, useGSAP } from '../animations/gsap';
import { revealUpOnScroll, revealWordsOnScroll } from '../animations/reveal';
import { ContactForm } from '../components/contact/ContactForm';
import { ContactLines } from '../components/contact/ContactLines';
import { ContactMap } from '../components/contact/ContactMap';
import { PageHero } from '../components/layout/PageHero/PageHero';
import { usePrefersReducedMotion } from '../hooks/useDevice';

/**
 * İletişim: doğrudan hat (telefon, e-posta, adres ve canlı açık/kapalı durumu), form ve harita.
 * Hepsi açık zeminlidir; art arda gelen bölümler kâğıt ve beyaz tonla ayrışır.
 */
export function ContactPage() {
  const { t, i18n } = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  // Form ve harita bölümleri scroll'da açılır. İlk bölüm kendi giriş animasyonunu perdeye göre yapar.
  useGSAP(
    () => {
      if (prefersReducedMotion) return;

      gsap.utils.toArray<HTMLElement>('[data-reveal-words]').forEach(revealWordsOnScroll);
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(revealUpOnScroll);
    },
    { scope: rootRef, dependencies: [i18n.language, prefersReducedMotion], revertOnUpdate: true },
  );

  return (
    <>
      <PageHero title={t('nav.main.contact').toLocaleUpperCase(i18n.language)} />
      <div ref={rootRef}>
        <ContactLines />
        <ContactForm />
        <ContactMap />
      </div>
    </>
  );
}
