import enCertificates from '../locales/en/certificates.json';
import trCertificates from '../locales/tr/certificates.json';
import i18n from './index';

// Yalnızca sertifikalar sayfasında kullanılır, sayfanın kendi parçasıyla birlikte yüklenir.
i18n.addResourceBundle('tr', 'certificates', trCertificates);
i18n.addResourceBundle('en', 'certificates', enCertificates);
