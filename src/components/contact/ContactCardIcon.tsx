import type { Icon, IconWeight } from '@phosphor-icons/react';
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

/** Kartın konusunu anlatan dekoratif ikon (Phosphor, varsayılanı ince çizgi). Boyutu ve rengi CSS'ten gelir. */
export function ContactCardIcon({
  kind,
  className,
  weight = 'light',
}: {
  kind: ContactCardKind;
  className?: string;
  weight?: IconWeight;
}) {
  const IconComponent = ICONS[kind];
  return <IconComponent className={className} weight={weight} size="1em" aria-hidden="true" />;
}
