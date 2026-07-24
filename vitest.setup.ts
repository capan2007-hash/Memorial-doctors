import '@testing-library/jest-dom'
// i18next singleton'ı testlerden önce başlat: useTranslation() kullanan bileşenler
// (StatusPill, Toast, PhotoUploader, Layout...) provider olmadan render edildiğinde
// varsayılan/fallback dil 'tr' üzerinden gerçek metinleri döndürsün (t() anahtar
// stringini değil çeviriyi versin). jsdom'un navigator.language'i 'en-US' olabildiği
// için dil dedektörünü ezip testler için dili açıkça 'tr' olarak sabitliyoruz.
import i18n from './src/i18n'
void i18n.changeLanguage('tr')
