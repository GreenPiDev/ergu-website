import styles from './RollText.module.css';

type RollTextProps = {
  text: string;
  className?: string;
};

/** İçinde bulunduğu link veya buton hover olunca metin yukarı kayar, altından `--roll-hover-color` renkli kopyası gelir. */
export function RollText({ text, className = '' }: RollTextProps) {
  return (
    <span className={`${styles.clip} ${className}`}>
      <span className={styles.text}>{text}</span>
      <span className={styles.hoverText} aria-hidden="true">
        {text}
      </span>
    </span>
  );
}

function ArrowIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19 19 5M7 5h12v12" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

/** Hover'da sağ üste çıkıp sol alttan `--roll-hover-color` renginde geri gelen ok. */
export function RollArrow() {
  return (
    <span className={styles.arrow}>
      <ArrowIcon className={styles.arrowIcon} />
      <ArrowIcon className={styles.arrowHoverIcon} />
    </span>
  );
}

/** Metin içindeki dış bağlantının sonuna gelen ok. */
export function InlineLinkArrow() {
  return (
    <>
      {/* Görünmez birleştirici, okun satır başına tek başına düşmesini önler. */}
      {'\u2060'}
      <span className={styles.inlineArrow}>
        <RollArrow />
      </span>
    </>
  );
}
