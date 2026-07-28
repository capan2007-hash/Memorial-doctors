import type { ClinicIdentity } from './clinicIdentity'
import type { Retention } from './retention'
import { type LegalDocument, LEGAL_VERSION } from './types'

/** Almanca aydınlatma metni — kaynak: aydinlatma.tr.ts (tek doğruluk kaynağı). */
export const aydinlatmaDe = (id: ClinicIdentity, r: Retention): LegalDocument => ({
  version: LEGAL_VERSION,
  title: 'Datenschutzhinweis zur Verarbeitung personenbezogener Daten',
  subtitle:
    'Gemäß dem türkischen Gesetz Nr. 6698 zum Schutz personenbezogener Daten („KVKK“)',
  updatedLabel: 'Letzte Aktualisierung',
  draftWarning:
    'ENTWURF — dieser Text wird durch die von unserem Datenschutzberater freigegebene endgültige Fassung ersetzt.',
  shareMessage:
    'Hallo, wir erfassen Ihre Anfrage. Den Datenschutzhinweis, der erläutert, wie Ihre personenbezogenen Daten verarbeitet werden, können Sie hier lesen: {{link}} — Bitte bestätigen Sie uns, nachdem Sie den Text gelesen haben.',
  sections: [
    {
      id: 'controller',
      heading: 'Verantwortlicher',
      paragraphs: [
        `${id.legalName} verarbeitet Ihre nachstehend beschriebenen personenbezogenen Daten als Verantwortlicher im Sinne des KVKK.`,
        `Adresse: ${id.address}`,
        `E-Mail: ${id.email}`,
        ...(id.phone ? [`Telefon: ${id.phone}`] : []),
        ...(id.verbis ? [`VERBİS-Registrierungsnummer: ${id.verbis}`] : []),
      ],
    },
    {
      id: 'data',
      heading: 'Verarbeitete personenbezogene Daten',
      paragraphs: [
        'Verarbeitet werden Ihre Identitätsdaten (Vorname, Nachname), Ihre Kontaktdaten (Telefon und, sofern vorhanden, E-Mail) sowie Ihre Gesundheitsdaten (Alter, Gewicht, Größe, Geschlecht, frühere Operationen, bekannte Erkrankungen, eingenommene Medikamente, Rauch- und Alkoholkonsum).',
        'Auch Fotos und Röntgenbilder, die Sie Ihrer Anfrage beifügen, werden als personenbezogene Daten verarbeitet. Die Standort- und Geräteinformationen (EXIF) hochgeladener Bilder werden vom System automatisch gelöscht.',
        'Ihre Gesundheitsdaten gehören zu den besonderen Kategorien personenbezogener Daten im Sinne von KVKK Art. 6 und werden ausschließlich auf Grundlage Ihrer ausdrücklichen Einwilligung verarbeitet.',
      ],
    },
    {
      id: 'purpose',
      heading: 'Zwecke der Verarbeitung',
      paragraphs: [
        'Ihre Daten werden zu folgenden Zwecken verarbeitet: Weiterleitung Ihrer Anfrage an Ärzte des geeigneten Fachgebiets, Durchführung einer Vorbeurteilung durch den Arzt, Vorlage geeigneter Behandlungsoptionen und eines Preisangebots sowie Abwicklung der Kommunikation zwischen Klinik und Patient.',
        'Ihre Daten werden nicht zu Marketing-, Werbe- oder Profiling-Zwecken verwendet; Werbe- und Tracking-Technologien Dritter werden nicht eingesetzt.',
      ],
    },
    {
      id: 'legalBasis',
      heading: 'Erhebungsmethode und Rechtsgrundlage',
      paragraphs: [
        'Ihre personenbezogenen Daten werden durch Ihre eigene Angabe über den Kommunikationskanal erhoben, über den Sie mit unserem Klinikpersonal Kontakt aufnehmen (WhatsApp, Telefongespräch oder persönliches Gespräch in der Klinik), und von unserem Personal im System erfasst.',
        'Da Ihre Gesundheitsdaten zu den besonderen Kategorien personenbezogener Daten gehören, ist die Rechtsgrundlage ihrer Verarbeitung Ihre ausdrückliche Einwilligung gemäß KVKK Art. 6 Abs. 2. Ihre Identitäts- und Kontaktdaten werden hingegen auf der Rechtsgrundlage des KVKK Art. 5 Abs. 2 lit. c verarbeitet, da sie unmittelbar mit dem Abschluss und der Erfüllung des Vertrags zusammenhängen.',
        'Sie können Ihre ausdrückliche Einwilligung jederzeit widerrufen. Im Fall eines Widerrufs werden Ihre Daten nicht weiter verarbeitet und nach Ablauf der Aufbewahrungsfrist gelöscht; die bis zum Zeitpunkt des Widerrufs erfolgten Verarbeitungen bleiben davon unberührt.',
      ],
    },
    {
      id: 'transfer',
      heading: 'Übermittlung ins Ausland',
      emphasis: true,
      paragraphs: [
        'Ihre Anfrage kann zum Zweck einer durch künstliche Intelligenz unterstützten Vorbeurteilung an einen in den USA ansässigen Dienstleister (Anbieter eines Modells künstlicher Intelligenz) übermittelt werden.',
        'Diese Übermittlung erfolgt nur, wenn Ihre ausdrückliche Einwilligung eingeholt wurde. Erteilen Sie keine Einwilligung, wird Ihre Anfrage nicht zur Beurteilung durch künstliche Intelligenz gesendet und ausschließlich anhand der ärztlichen Beurteilung bearbeitet.',
        'Vor der Übermittlung werden Ihr Vor- und Nachname in Freitextfeldern automatisch maskiert; Fotos und Röntgenbilder werden nicht zur Beurteilung durch künstliche Intelligenz gesendet.',
        'Die Ergebnisse der künstlichen Intelligenz haben für den Arzt lediglich orientierenden Charakter; die Diagnose- oder Behandlungsentscheidung trifft ausschließlich der zuständige Arzt.',
      ],
    },
    {
      id: 'retention',
      heading: 'Aufbewahrung und Vernichtung',
      paragraphs: [
        `Fotos und Röntgenbilder, die Sie Ihrer Anfrage beifügen, werden höchstens ${r.photoDays} Tage aufbewahrt. Ist ein Operationstermin festgelegt, werden die Bilder bis ${r.opBufferDays} Tage nach dem Operationstermin aufbewahrt. Nach Ablauf der Frist werden die Bilder automatisch gelöscht.`,
        'Ihre Identitäts-, Kontakt- und Gesundheitsdaten werden für die in den einschlägigen Rechtsvorschriften vorgesehenen Aufbewahrungsfristen aufbewahrt; nach Ablauf der Frist werden sie gelöscht, vernichtet oder anonymisiert.',
      ],
    },
    {
      id: 'rights',
      heading: 'Ihre Rechte als betroffene Person',
      paragraphs: [
        'Gemäß Artikel 11 KVKK haben Sie das Recht, zu erfahren, ob Ihre personenbezogenen Daten verarbeitet werden; Auskunft darüber zu verlangen, wenn sie verarbeitet wurden; den Zweck der Verarbeitung zu erfahren und zu wissen, ob die Daten zweckentsprechend verwendet werden; die Dritten in der Türkei oder im Ausland zu kennen, an die die Daten übermittelt wurden; die Berichtigung zu verlangen, wenn die Daten unvollständig oder unrichtig verarbeitet wurden; die Löschung oder Vernichtung zu verlangen; zu verlangen, dass die Berichtigungs- und Löschungsvorgänge den Dritten mitgeteilt werden, an die die Daten übermittelt wurden; einem für Sie nachteiligen Ergebnis zu widersprechen, das ausschließlich durch die automatisierte Analyse der verarbeiteten Daten entsteht; und Ersatz des Schadens zu verlangen, wenn Ihnen durch eine rechtswidrige Verarbeitung ein Schaden entstanden ist.',
        `Sie können diese Rechte ausüben, indem Sie Ihre Anträge an ${id.email} richten. Ihr Antrag wird spätestens innerhalb von dreißig Tagen abgeschlossen.`,
      ],
    },
  ],
})
