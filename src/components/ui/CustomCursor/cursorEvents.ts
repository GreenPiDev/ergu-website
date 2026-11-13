// DOM öğesi olmayan tıklanabilir alanlar (3D sahnedeki tesisler) özel imlece bu olayla haber verir.
// İmleç tıklanabilir öğenin üstündeymiş gibi büyür. Öğeden öğeye geçişte imleç kendi kararını yeniden verir.
export const CURSOR_INTERACTIVE_EVENT = 'cursor:interactive';

export function setCursorInteractive(interactive: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(CURSOR_INTERACTIVE_EVENT, { detail: interactive }));
}
