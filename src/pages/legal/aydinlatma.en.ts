import type { ClinicIdentity } from './clinicIdentity'
import type { Retention } from './retention'
import { type LegalDocument, LEGAL_VERSION } from './types'

/** İngilizce aydınlatma metni — kaynak: aydinlatma.tr.ts (tek doğruluk kaynağı). */
export const aydinlatmaEn = (id: ClinicIdentity, r: Retention): LegalDocument => ({
  version: LEGAL_VERSION,
  title: 'Privacy Notice on the Processing of Personal Data',
  subtitle: 'Pursuant to Turkish Personal Data Protection Law No. 6698 ("KVKK")',
  updatedLabel: 'Last updated',
  draftWarning:
    'DRAFT — this text will be replaced by the final version approved by our data protection advisor.',
  shareMessage:
    'Hello, we are registering your enquiry. You can read the privacy notice explaining how your personal data is processed here: {{link}} — Please confirm to us once you have read it.',
  sections: [
    {
      id: 'controller',
      heading: 'Data Controller',
      paragraphs: [
        `${id.legalName} processes your personal data described below in its capacity as data controller under the KVKK.`,
        `Address: ${id.address}`,
        `E-mail: ${id.email}`,
        ...(id.phone ? [`Telephone: ${id.phone}`] : []),
        ...(id.verbis ? [`VERBİS registration number: ${id.verbis}`] : []),
      ],
    },
    {
      id: 'data',
      heading: 'Personal Data Processed',
      paragraphs: [
        'Your identity data (first name, last name), your contact data (telephone and, where provided, e-mail) and your health data (age, weight, height, sex, previous operations, known illnesses, medication used, smoking and alcohol use) are processed.',
        'Photographs and X-ray images you attach to your enquiry are also processed as personal data. The location and device information (EXIF) of uploaded images is automatically deleted by the system.',
        'Your health data constitutes special category personal data within the meaning of KVKK art. 6 and is processed solely on the basis of your explicit consent.',
      ],
    },
    {
      id: 'purpose',
      heading: 'Purposes of Processing',
      paragraphs: [
        'Your data is processed for the purposes of routing your enquiry to physicians in the appropriate field of specialisation, enabling the physician to carry out a preliminary assessment, presenting suitable treatment options and a price quotation to you, and conducting communication between the clinic and the patient.',
        'Your data is not used for marketing, advertising or profiling purposes; no third-party advertising or tracking technologies are used.',
      ],
    },
    {
      id: 'legalBasis',
      heading: 'Method of Collection and Legal Basis',
      paragraphs: [
        'Your personal data is collected through the communication channel you use to contact our clinic staff (WhatsApp, telephone call, or an in-person consultation at the clinic), based on your own declaration, and is recorded in our system by our staff.',
        'Because your health data constitutes special category personal data, the legal basis for processing it is your explicit consent under KVKK art. 6(2). Your identity and contact details are processed on the basis of KVKK art. 5(2)(c), being directly related to the establishment and performance of a contract.',
        'You may withdraw your explicit consent at any time. If you withdraw it, your data will not be processed further and will be deleted at the end of the retention period; processing carried out before the withdrawal is unaffected.',
      ],
    },
    {
      id: 'transfer',
      heading: 'Transfer Abroad',
      emphasis: true,
      paragraphs: [
        'Your enquiry may be transferred to a service provider based in the United States (an artificial intelligence model provider) for the purpose of carrying out an artificial-intelligence-assisted preliminary assessment.',
        'This transfer takes place only where your explicit consent has been obtained. If you do not give your consent, your enquiry is not sent for artificial intelligence assessment and is processed on the basis of the physician’s assessment alone.',
        'Before the transfer, your first name and last name are automatically masked in free-text fields; photographs and X-ray images are not sent for artificial intelligence assessment.',
        'Artificial intelligence output is of a guiding nature for the physician only; the diagnosis or treatment decision is taken exclusively by the authorised physician.',
      ],
    },
    {
      id: 'retention',
      heading: 'Retention and Destruction',
      paragraphs: [
        `Photographs and X-ray images you attach to your enquiry are retained for a maximum of ${r.photoDays} days. If an operation date has been set, the images are kept until ${r.opBufferDays} days after the operation date. At the end of that period the images are deleted automatically.`,
        'Your identity, contact and health data is kept for the retention periods laid down in the applicable legislation; at the end of that period it is deleted, destroyed or anonymised.',
      ],
    },
    {
      id: 'rights',
      heading: 'Your Rights as a Data Subject',
      paragraphs: [
        'Under article 11 of the KVKK you have the right to: learn whether your personal data is being processed; request information in that regard if it has been processed; learn the purpose of the processing and whether the data is used in accordance with that purpose; know the third parties in Turkey or abroad to whom the data has been transferred; request its correction if it has been processed incompletely or inaccurately; request its erasure or destruction; request that correction and erasure operations be notified to the third parties to whom the data was transferred; object to an outcome adverse to you arising from the analysis of the processed data solely by automated systems; and claim compensation for damage if you suffer damage as a result of unlawful processing.',
        `You may exercise these rights by sending your request to ${id.email}. Your application will be concluded within thirty days at the latest.`,
      ],
    },
  ],
})
