import {
  createContext,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import {
  groupContainsPath,
  HEADER_NAV,
  type NavGroupNode,
  type NavLinkNode,
  type NavNode,
} from '../../../content/navigation';
import { getLocaleFromPathname, localizePath, stripLocale } from '../../../i18n/locale';
import headerStyles from './Header.module.css';
import { LanguageSwitch } from './LanguageSwitch';
import styles from './DesktopNav.module.css';

// Fare menüden çıkınca kapanmadan önceki pay: çapraz geçişte panel kapanmasın.
const HOVER_CLOSE_DELAY_MS = 180;
// Üstüne gelince açılan menüye hemen ardından tıklamak onu kapatmasın.
const HOVER_CLICK_GRACE_MS = 400;

const isMouse = (event: ReactPointerEvent) => event.pointerType === 'mouse';

/** Üst panel açık mı; kapanınca içindeki alt menüler de kapanır. */
const PanelOpenContext = createContext(false);

type HoverIntent = { open: () => void; close: () => void };

/** Fareyle üstüne gelince açar, ayrılınca kısa gecikmeyle kapatır. */
function useHoverIntent(onOpen: () => void, onClose: () => void): HoverIntent {
  const timerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  return {
    open: () => {
      window.clearTimeout(timerRef.current);
      onOpen();
    },
    close: () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(onClose, HOVER_CLOSE_DELAY_MS);
    },
  };
}

function Chevron({ direction }: { direction: 'down' | 'right' }) {
  return <span className={styles.chevron} data-direction={direction} aria-hidden="true" />;
}

function PanelLink({ node }: { node: NavLinkNode }) {
  const { t } = useTranslation();
  const locale = getLocaleFromPathname(useLocation().pathname);
  return (
    <li>
      <NavLink
        className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
        to={localizePath(node.path, locale)}
      >
        {t(node.labelKey)}
      </NavLink>
    </li>
  );
}

/** Panel içindeki alt menü (ör. Alçak Gerilim Dağıtım Panoları): sağa doğru açılır, sığmazsa sola. */
function PanelGroup({ node }: { node: NavGroupNode }) {
  const { t } = useTranslation();
  const route = stripLocale(useLocation().pathname);
  const isPanelOpen = useContext(PanelOpenContext);
  const [isOpen, setIsOpen] = useState(false);
  const [side, setSide] = useState<'end' | 'start'>('end');
  const flyoutRef = useRef<HTMLUListElement>(null);
  const flyoutId = useId();
  const hover = useHoverIntent(
    () => setIsOpen(true),
    () => setIsOpen(false),
  );

  if (!isPanelOpen && isOpen) setIsOpen(false);

  // Açılırken ekranın sağına taşacaksa sola açılır.
  useLayoutEffect(() => {
    const flyout = flyoutRef.current;
    if (!isOpen || !flyout) return;
    const parentRect = flyout.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    const fitsEnd = parentRect.right + flyout.offsetWidth <= document.documentElement.clientWidth;
    setSide(fitsEnd ? 'end' : 'start');
  }, [isOpen]);

  return (
    <li
      className={styles.groupItem}
      onPointerEnter={(event) => isMouse(event) && hover.open()}
      onPointerLeave={(event) => isMouse(event) && hover.close()}
    >
      <button
        type="button"
        className={`${styles.item} ${styles.groupRow} ${groupContainsPath(node, route) ? styles.active : ''}`}
        aria-expanded={isOpen}
        aria-controls={flyoutId}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') setIsOpen(true);
          if (event.key === 'ArrowLeft') setIsOpen(false);
        }}
      >
        <span>{t(node.labelKey)}</span>
        <Chevron direction="right" />
      </button>
      <PanelOpenContext.Provider value={isPanelOpen && isOpen}>
        <PanelList ref={flyoutRef} id={flyoutId} nodes={node.children} isOpen={isOpen} variant="flyout" side={side} />
      </PanelOpenContext.Provider>
    </li>
  );
}

type PanelListProps = {
  id: string;
  nodes: NavNode[];
  isOpen: boolean;
  variant: 'dropdown' | 'flyout';
  side: 'end' | 'start';
  ref?: Ref<HTMLUListElement>;
};

function PanelList({ id, nodes, isOpen, variant, side, ref }: PanelListProps) {
  return (
    <ul ref={ref} id={id} className={styles.panel} data-variant={variant} data-side={side} data-open={isOpen}>
      {nodes.map((child) =>
        child.kind === 'link' ? <PanelLink key={child.id} node={child} /> : <PanelGroup key={child.id} node={child} />,
      )}
    </ul>
  );
}

type TopGroupProps = {
  node: NavGroupNode;
  isOpen: boolean;
  align: 'start' | 'end';
  onToggle: () => void;
  onHoverOpen: () => void;
  onHoverClose: () => void;
};

function TopGroup({ node, isOpen, align, onToggle, onHoverOpen, onHoverClose }: TopGroupProps) {
  const { t } = useTranslation();
  const route = stripLocale(useLocation().pathname);
  const panelId = useId();
  const label = t(node.labelKey);
  const isActive = groupContainsPath(node, route);

  return (
    <li
      className={styles.topGroup}
      onPointerEnter={(event) => isMouse(event) && onHoverOpen()}
      onPointerLeave={(event) => isMouse(event) && onHoverClose()}
    >
      <button
        type="button"
        className={`${headerStyles.link} ${styles.trigger} ${isActive ? headerStyles.active : ''}`}
        data-top-trigger={node.id}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className={headerStyles.roll}>
          <span>{label}</span>
          <span aria-hidden="true">{label}</span>
        </span>
        <Chevron direction="down" />
      </button>
      <PanelOpenContext.Provider value={isOpen}>
        <PanelList id={panelId} nodes={node.children} isOpen={isOpen} variant="dropdown" side={align} />
      </PanelOpenContext.Provider>
    </li>
  );
}

function TopLink({ node }: { node: NavLinkNode }) {
  const { t } = useTranslation();
  const locale = getLocaleFromPathname(useLocation().pathname);
  const label = t(node.labelKey);
  return (
    <li>
      <NavLink
        className={({ isActive }) => `${headerStyles.link} ${isActive ? headerStyles.active : ''}`}
        to={localizePath(node.path, locale)}
      >
        <span className={headerStyles.roll}>
          <span>{label}</span>
          <span aria-hidden="true">{label}</span>
        </span>
      </NavLink>
    </li>
  );
}

/**
 * Masaüstü menü. Bağlantı listesi olduğu için ARIA menu değil, açılıp kapanan (disclosure) desen kullanılır.
 * Fareyle üstüne gelince açılır; tıklama, klavye ve dokunma ile de çalışır. Aynı anda tek açılır menü açıktır.
 */
export function DesktopNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const rootRef = useRef<HTMLElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [previousPathname, setPreviousPathname] = useState(pathname);
  const hoverOpenedAtRef = useRef(0);

  // Sayfa değişince açık menü render sırasında kapanır.
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setOpenId(null);
  }

  const close = useCallback(() => setOpenId(null), []);
  const hover = useHoverIntent(() => undefined, close);

  useEffect(() => {
    if (!openId) return;

    const isInside = (target: EventTarget | null) => target instanceof Node && rootRef.current?.contains(target);
    const handlePointerDown = (event: PointerEvent) => {
      if (!isInside(event.target)) close();
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!isInside(event.target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      rootRef.current?.querySelector<HTMLButtonElement>(`[data-top-trigger="${openId}"]`)?.focus();
      close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openId, close]);

  return (
    <nav ref={rootRef} className={headerStyles.nav} aria-label={t('nav.label')}>
      <ul className={headerStyles.navList}>
        {HEADER_NAV.map((node, index) =>
          node.kind === 'link' ? (
            <TopLink key={`${node.id}-${index}`} node={node} />
          ) : (
            <TopGroup
              key={node.id}
              node={node}
              isOpen={openId === node.id}
              // Son açılır menü sağ kenara yaslanır, taşmasın.
              align={index === HEADER_NAV.length - 1 ? 'end' : 'start'}
              onToggle={() => {
                const justHovered = Date.now() - hoverOpenedAtRef.current < HOVER_CLICK_GRACE_MS;
                setOpenId((current) => (current === node.id && !justHovered ? null : node.id));
              }}
              onHoverOpen={() => {
                hover.open();
                if (openId !== node.id) hoverOpenedAtRef.current = Date.now();
                setOpenId(node.id);
              }}
              onHoverClose={hover.close}
            />
          ),
        )}
      </ul>
      <LanguageSwitch />
    </nav>
  );
}
