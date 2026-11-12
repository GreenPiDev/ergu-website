import enKnowledge from '../locales/en/knowledge.json';
import trKnowledge from '../locales/tr/knowledge.json';
import i18n from './index';

// Metinler uzun olduğu için ana pakete girmez, sayfanın kendi parçasıyla birlikte yüklenir.
i18n.addResourceBundle('tr', 'knowledge', trKnowledge);
i18n.addResourceBundle('en', 'knowledge', enKnowledge);
