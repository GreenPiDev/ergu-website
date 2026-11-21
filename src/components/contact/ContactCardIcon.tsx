import type { Icon } from '@phosphor-icons/react';
// Kök paketten içe aktarılınca geliştirme sunucusu 9000'den fazla ikon modülünü işler; ikonlar tek tek alınır.
import { EnvelopeSimpleIcon } from '@phosphor-icons/react/dist/csr/EnvelopeSimple';
import { LinkedinLogoIcon } from '@phosphor-icons/react/dist/csr/LinkedinLogo';
import { MapPinIcon } from '@phosphor-icons/react/dist/csr/MapPin';
import { PhoneIcon } from '@phosphor-icons/react/dist/csr/Phone';

export type ContactCardKind = 'phone' | 'email' | 'address' | 'linkedin';

const ICONS: Readonly<Record<ContactCardKind, Icon>> = {
  phone: PhoneIcon,
  email: EnvelopeSimpleIcon,
  address: MapPinIcon,
  linkedin: LinkedinLogoIcon,
};

/** Kartın konusunu anlatan dekoratif ikon (Phosphor, ince çizgi). Boyutu ve rengi CSS'ten gelir. */
export function ContactCardIcon({ kind, className }: { kind: ContactCardKind; className?: string }) {
  const IconComponent = ICONS[kind];
  return <IconComponent className={className} weight="light" size="1em" aria-hidden="true" />;
}
