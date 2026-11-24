import { useEffect, useState } from 'react';
import { fetchGalleryImages, type GalleryImage } from './galleryApi';

export type GalleryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; images: GalleryImage[] };

/** Galeri listesini bir kez çeker. Sayfadan çıkılırsa istek iptal edilir. */
export function useGalleryImages(): GalleryState {
  const [state, setState] = useState<GalleryState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetchGalleryImages(controller.signal)
      .then((images) => setState({ status: 'ready', images }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, []);

  return state;
}
