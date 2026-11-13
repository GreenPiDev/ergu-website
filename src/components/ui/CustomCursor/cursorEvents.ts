// DOM öğesi olmayan tıklanabilir alanlar (3D sahnedeki tesisler) özel imlece bu olayla haber verir.
// İmleç tıklanabilir öğenin üstündeymiş gibi büyür. Öğeden öğeye geçişte imleç kendi kararını yeniden verir.
export const CURSOR_INTERACTIVE_EVENT = 'cursor:interactive';

export function setCursorInteractive(interactive: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(CURSOR_INTERACTIVE_EVENT, { detail: interactive }));
}

// İmlecin yanında kısa bir etiket (şehirde fareyle üstünde durulan tesisin adı). null etiketi kaldırır.
export const CURSOR_LABEL_EVENT = 'cursor:label';

export interface CursorLabel {
  text: string;
  /** Etiket çerçevesinin rengi (CSS değeri, ör. `var(--color-facility-hospital)`). Yoksa vurgu rengi. */
  color?: string;
}

export function setCursorLabel(label: CursorLabel | null) {
  window.dispatchEvent(new CustomEvent<CursorLabel | null>(CURSOR_LABEL_EVENT, { detail: label }));
}
