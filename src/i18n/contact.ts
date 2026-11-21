import enContact from '../locales/en/contact.json';
import trContact from '../locales/tr/contact.json';
import i18n from './index';

// Yalnızca iletişim sayfasında kullanılır, sayfanın kendi parçasıyla birlikte yüklenir.
i18n.addResourceBundle('tr', 'contact', trContact);
i18n.addResourceBundle('en', 'contact', enContact);
