import { AdminApiError } from '../adminApi';
import { ImagePrepareError } from './prepareImage';

/** Galeri işlemlerindeki hatanın kullanıcıya gösterilecek çeviri anahtarı (`admin` › `gallery.errors.*`). */
export function galleryErrorKey(error: unknown) {
  if (error instanceof ImagePrepareError) {
    return error.reason === 'tooLarge' ? 'gallery.errors.tooLarge' : 'gallery.errors.unreadable';
  }
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case 'storage_not_configured':
        return 'gallery.errors.storageNotConfigured';
      case 'unauthorized':
        return 'gallery.errors.sessionExpired';
      case 'upload_incomplete':
        return 'gallery.errors.uploadIncomplete';
      case 'not_found':
        return 'gallery.errors.notFound';
      default:
        return 'gallery.errors.unknown';
    }
  }
  return 'gallery.errors.unknown';
}
