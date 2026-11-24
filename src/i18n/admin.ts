import enAdmin from '../locales/en/admin.json';
import trAdmin from '../locales/tr/admin.json';
import i18n from './index';

// Yalnızca yönetim panelinde kullanılır, panelin kendi parçasıyla birlikte yüklenir.
i18n.addResourceBundle('tr', 'admin', trAdmin);
i18n.addResourceBundle('en', 'admin', enAdmin);
