import enGallery from '../locales/en/gallery.json';
import trGallery from '../locales/tr/gallery.json';
import i18n from './index';

// Yalnızca galeri sayfasında kullanılır, sayfanın kendi parçasıyla birlikte yüklenir.
i18n.addResourceBundle('tr', 'gallery', trGallery);
i18n.addResourceBundle('en', 'gallery', enGallery);
