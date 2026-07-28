import type { ClinicIdentity } from './clinicIdentity'
import type { Retention } from './retention'
import { type LegalDocument, LEGAL_VERSION } from './types'

/** Fransızca aydınlatma metni — kaynak: aydinlatma.tr.ts (tek doğruluk kaynağı). */
export const aydinlatmaFr = (id: ClinicIdentity, r: Retention): LegalDocument => ({
  version: LEGAL_VERSION,
  title: 'Note d’information relative au traitement des données à caractère personnel',
  subtitle:
    'Conformément à la loi turque n° 6698 sur la protection des données à caractère personnel (« KVKK »)',
  updatedLabel: 'Dernière mise à jour',
  draftWarning:
    'PROJET — ce texte sera remplacé par la version définitive validée par notre conseiller en protection des données.',
  shareMessage:
    'Bonjour, nous enregistrons votre demande. Vous pouvez lire ici la note d’information qui explique comment vos données à caractère personnel sont traitées : {{link}} — Merci de nous communiquer votre accord après avoir lu ce texte.',
  sections: [
    {
      id: 'controller',
      heading: 'Responsable du traitement',
      paragraphs: [
        `${id.legalName} traite, en qualité de responsable du traitement au sens du KVKK, vos données à caractère personnel décrites ci-dessous.`,
        `Adresse : ${id.address}`,
        `E-mail : ${id.email}`,
        ...(id.phone ? [`Téléphone : ${id.phone}`] : []),
        ...(id.verbis ? [`Numéro d’enregistrement VERBİS : ${id.verbis}`] : []),
      ],
    },
    {
      id: 'data',
      heading: 'Données à caractère personnel traitées',
      paragraphs: [
        'Sont traitées vos données d’identité (nom, prénom), vos données de contact (téléphone et, le cas échéant, adresse électronique) et vos données de santé (âge, poids, taille, sexe, opérations antérieures, maladies connues, médicaments pris, consommation de tabac et d’alcool).',
        'Les photographies et les radiographies que vous joignez à votre demande sont également traitées en tant que données à caractère personnel. Les informations de localisation et d’appareil (EXIF) des images téléversées sont automatiquement supprimées par le système.',
        'Vos données de santé constituent des données à caractère personnel de nature particulière au sens de l’article 6 du KVKK et ne sont traitées que sur le fondement de votre consentement explicite.',
      ],
    },
    {
      id: 'purpose',
      heading: 'Finalités du traitement',
      paragraphs: [
        'Vos données sont traitées aux finalités suivantes : orientation de votre demande vers les médecins de la spécialité appropriée, réalisation d’une évaluation préalable par le médecin, présentation des options de traitement adaptées et d’une proposition tarifaire, et gestion de la communication entre la clinique et le patient.',
        'Vos données ne sont pas utilisées à des fins de marketing, de publicité ou de profilage ; aucune technologie publicitaire ou de suivi de tiers n’est utilisée.',
      ],
    },
    {
      id: 'legalBasis',
      heading: 'Méthode de collecte et base légale',
      paragraphs: [
        'Vos données à caractère personnel sont collectées au moyen de votre propre déclaration, via le canal de communication que vous utilisez pour contacter le personnel de notre clinique (WhatsApp, appel téléphonique ou entretien en personne à la clinique), et sont enregistrées dans notre système par notre personnel.',
        'Vos données de santé étant des données à caractère personnel de nature particulière, la base légale de leur traitement est votre consentement explicite au sens de l’article 6/2 du KVKK. Vos données d’identité et de contact sont, quant à elles, traitées sur le fondement de l’article 5/2-c du KVKK, ces données étant directement liées à la conclusion et à l’exécution du contrat.',
        'Vous pouvez retirer votre consentement explicite à tout moment. En cas de retrait, vos données ne font plus l’objet d’un traitement et sont supprimées à l’issue de la durée de conservation ; les traitements effectués avant la date du retrait n’en sont pas affectés.',
      ],
    },
    {
      id: 'transfer',
      heading: 'Transfert à l’étranger',
      emphasis: true,
      paragraphs: [
        'Votre demande peut être transférée à un prestataire de services établi aux États-Unis (fournisseur d’un modèle d’intelligence artificielle) aux fins de la réalisation d’une évaluation préalable assistée par intelligence artificielle.',
        'Ce transfert n’est effectué que si votre consentement explicite a été recueilli. Si vous ne donnez pas votre consentement, votre demande n’est pas envoyée à l’évaluation par intelligence artificielle et n’est traitée que sur le fondement de l’évaluation du médecin.',
        'Avant le transfert, vos nom et prénom sont automatiquement masqués dans les champs de texte libre ; les photographies et les radiographies ne sont pas envoyées à l’évaluation par intelligence artificielle.',
        'Les résultats de l’intelligence artificielle n’ont qu’une valeur indicative pour le médecin ; la décision de diagnostic ou de traitement est prise exclusivement par le médecin habilité.',
      ],
    },
    {
      id: 'retention',
      heading: 'Conservation et destruction',
      paragraphs: [
        `Les photographies et les radiographies que vous joignez à votre demande sont conservées pendant ${r.photoDays} jours au maximum. Si une date d’opération a été fixée, les images sont conservées jusqu’à ${r.opBufferDays} jours après la date de l’opération. À l’issue de ce délai, les images sont automatiquement supprimées.`,
        'Vos données d’identité, de contact et de santé sont conservées pendant les durées de conservation prévues par la législation applicable ; à l’issue de ce délai, elles sont supprimées, détruites ou anonymisées.',
      ],
    },
    {
      id: 'rights',
      heading: 'Vos droits en tant que personne concernée',
      paragraphs: [
        'Conformément à l’article 11 du KVKK, vous avez le droit : de savoir si vos données à caractère personnel font l’objet d’un traitement ; de demander des informations à ce sujet si elles ont été traitées ; de connaître la finalité du traitement et de savoir si les données sont utilisées conformément à cette finalité ; de connaître les tiers, en Turquie ou à l’étranger, auxquels elles ont été transférées ; d’en demander la rectification si elles ont été traitées de manière incomplète ou inexacte ; d’en demander l’effacement ou la destruction ; de demander que les opérations de rectification et d’effacement soient notifiées aux tiers auxquels les données ont été transférées ; de vous opposer à un résultat défavorable à votre égard découlant de l’analyse des données traitées exclusivement par des systèmes automatisés ; et de demander réparation du préjudice si vous subissez un dommage du fait d’un traitement illicite.',
        `Vous pouvez exercer ces droits en adressant vos demandes à ${id.email}. Votre demande sera traitée dans un délai maximal de trente jours.`,
      ],
    },
  ],
})
