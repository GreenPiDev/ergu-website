import { AdminApiError } from '../adminApi';
import { ImagePrepareError } from './prepareImage';

export type CollectionErrorKey =
  | 'tooLarge'
  | 'unreadable'
  | 'storageNotConfigured'
  | 'sessionExpired'
  | 'uploadIncomplete'
  | 'notFound'
  | 'unknown';

/** Koleksiyon işlemlerindeki hatanın çeviri anahtarı (`admin` › `<koleksiyon>.errors.<anahtar>`). */
export function collectionErrorKey(error: unknown): CollectionErrorKey {
  if (error instanceof ImagePrepareError) {
    return error.reason === 'tooLarge' ? 'tooLarge' : 'unreadable';
  }
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case 'storage_not_configured':
        return 'storageNotConfigured';
      case 'unauthorized':
        return 'sessionExpired';
      case 'upload_incomplete':
        return 'uploadIncomplete';
      case 'not_found':
        return 'notFound';
      default:
        return 'unknown';
    }
  }
  return 'unknown';
}
