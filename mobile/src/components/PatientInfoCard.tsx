// Kaynak: /src/features/requests/PatientInfoCard.tsx (web) — label/value grid,
// "Belirtilmedi" fallback'ları ve BMI rozeti aynı mantıkla native'e taşındı.
// i18n: request.patientInfo.* (bkz. Faz M1 Task 4).
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { bmi } from '@/domain/health'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, shadow, spacing, type Palette } from '@/theme'
import type { RequestRow } from '@/types/db'
import { TranslatedText } from '@/features/i18n-content/TranslatedText'

function isEmpty(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || value === ''
}

// Hasta serbest-metin girdisi: boşsa sabit-UI yer tutucu, doluysa görüntüleyen-diline
// çevrilir (kaynak = req.source_lang). Kaynak deseni: web FreeText (PatientInfoCard.tsx).
function FreeText({
  value,
  sourceLang,
  notSpecifiedLabel,
  styles,
}: {
  value: string | null | undefined
  sourceLang: string
  notSpecifiedLabel: string
  styles: ReturnType<typeof makeStyles>
}) {
  if (isEmpty(value)) return <Text style={styles.valueEmpty}>{notSpecifiedLabel}</Text>
  return <TranslatedText text={value} sourceLang={sourceLang} style={styles.value} />
}

// Etiketler webdeki domain/lifestyle.ts ile aynı (mobil kopya); metinler i18n'den gelir.
function smokingDisplay(req: RequestRow, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  if (!req.smoking_status) return null
  const base = t(`request:patientInfo.smoking.${req.smoking_status}`)
  return req.smoking_pack_years != null
    ? `${base} · ${t('request:patientInfo.smoking.packYears', { value: req.smoking_pack_years })}`
    : base
}
function alcoholDisplay(req: RequestRow, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  if (!req.alcohol_status) return null
  const base = t(`request:patientInfo.alcohol.${req.alcohol_status}`)
  return req.alcohol_drinks_per_week != null
    ? `${base} · ${t('request:patientInfo.alcohol.perWeek', { value: req.alcohol_drinks_per_week })}`
    : base
}

function InfoItem({
  label,
  value,
  numeric,
  children,
  full,
  styles,
  notSpecifiedLabel,
}: {
  label: string
  value?: string | number | null
  numeric?: boolean
  children?: ReactNode
  /** Tüm satırı kaplasın (çoklu işlem rozetleri gibi geniş içerikler için). */
  full?: boolean
  styles: ReturnType<typeof makeStyles>
  notSpecifiedLabel: string
}) {
  const empty = isEmpty(value)
  return (
    <View style={[styles.item, full && styles.itemFull]}>
      <Text style={styles.label}>{label}</Text>
      {children ?? (
        <Text
          style={[
            empty ? styles.valueEmpty : styles.value,
            numeric && !empty && styles.numeric,
          ]}
        >
          {empty ? notSpecifiedLabel : value}
        </Text>
      )}
    </View>
  )
}

export function PatientInfoCard({
  req,
  patientName,
  categoryName,
  subcategoryName,
  operationName,
  procedureNames,
}: {
  req: RequestRow
  patientName: string
  categoryName?: string
  subcategoryName?: string | null
  operationName?: string | null
  /** Katalog v2: talepte seçili tüm işlemler; doluysa tekil işlem satırı yerine rozetler. */
  procedureNames?: string[]
}) {
  const { colors } = useTheme()
  const { t } = useTranslation('request')
  const styles = makeStyles(colors)
  const bmiValue = req.weight_kg && req.height_cm ? bmi(req.weight_kg, req.height_cm) : null
  const hasProcedures = (procedureNames?.length ?? 0) > 0
  const categoryDisplay = hasProcedures
    ? categoryName ?? ''
    : [categoryName, subcategoryName].filter(Boolean).join(' / ')
  const notSpecified = t('patientInfo.notSpecified')
  const genderLabel = req.gender ? t(`patientInfo.gender.${req.gender}`) : null

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('patientInfo.title')}</Text>
      <View style={styles.grid}>
        <InfoItem label={t('patientInfo.fields.patientName')} value={patientName} styles={styles} notSpecifiedLabel={notSpecified} />
        <InfoItem label={t('patientInfo.fields.category')} value={categoryDisplay || null} styles={styles} notSpecifiedLabel={notSpecified} />
        {hasProcedures ? (
          <InfoItem label={t('patientInfo.fields.procedures')} full styles={styles} notSpecifiedLabel={notSpecified}>
            <View style={styles.chipRow}>
              {procedureNames!.map((name) => (
                <View key={name} style={styles.chip}>
                  <Text style={styles.chipText}>{name}</Text>
                </View>
              ))}
            </View>
          </InfoItem>
        ) : (
          <InfoItem label={t('patientInfo.fields.operation')} value={operationName} styles={styles} notSpecifiedLabel={notSpecified} />
        )}
        <InfoItem label={t('patientInfo.fields.age')} value={req.age} numeric styles={styles} notSpecifiedLabel={notSpecified} />
        <InfoItem label={t('patientInfo.fields.gender')} value={genderLabel} styles={styles} notSpecifiedLabel={notSpecified} />
        <InfoItem label={t('patientInfo.fields.height')} value={req.height_cm} numeric styles={styles} notSpecifiedLabel={notSpecified} />
        <InfoItem label={t('patientInfo.fields.weight')} value={req.weight_kg} numeric styles={styles} notSpecifiedLabel={notSpecified} />
        <InfoItem label={t('patientInfo.fields.bmi')} styles={styles} notSpecifiedLabel={notSpecified}>
          {bmiValue === null ? (
            <Text style={styles.valueEmpty}>{notSpecified}</Text>
          ) : (
            <View style={styles.bmiBadge}>
              <Text style={styles.bmiBadgeText}>{bmiValue}</Text>
            </View>
          )}
        </InfoItem>
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label={t('patientInfo.fields.pastSurgeries')} styles={styles} notSpecifiedLabel={notSpecified}>
          <FreeText value={req.past_surgeries} sourceLang={req.source_lang} notSpecifiedLabel={notSpecified} styles={styles} />
        </InfoItem>
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label={t('patientInfo.fields.knownConditions')} styles={styles} notSpecifiedLabel={notSpecified}>
          <FreeText value={req.known_conditions} sourceLang={req.source_lang} notSpecifiedLabel={notSpecified} styles={styles} />
        </InfoItem>
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label={t('patientInfo.fields.medications')} styles={styles} notSpecifiedLabel={notSpecified}>
          <FreeText value={req.medications} sourceLang={req.source_lang} notSpecifiedLabel={notSpecified} styles={styles} />
        </InfoItem>
      </View>
      <View style={styles.grid}>
        <InfoItem label={t('patientInfo.fields.smoking')} value={smokingDisplay(req, t)} styles={styles} notSpecifiedLabel={notSpecified} />
        <InfoItem label={t('patientInfo.fields.alcohol')} value={alcoholDisplay(req, t)} styles={styles} notSpecifiedLabel={notSpecified} />
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label={t('patientInfo.fields.notes')} styles={styles} notSpecifiedLabel={notSpecified}>
          <FreeText value={req.notes} sourceLang={req.source_lang} notSpecifiedLabel={notSpecified} styles={styles} />
        </InfoItem>
      </View>
    </View>
  )
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface2,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.four,
      gap: spacing.three,
      ...shadow.card,
    },
    cardTitle: {
      fontFamily: fontFamily.display,
      fontSize: 17,
      color: colors.textPrimary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.three,
    },
    fullWidth: {
      width: '100%',
    },
    item: {
      width: '45%',
      gap: spacing.half,
    },
    itemFull: {
      width: '100%',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.half,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.infoBorder,
      backgroundColor: colors.infoBg,
      paddingHorizontal: spacing.one,
      paddingVertical: 2,
    },
    chipText: {
      fontFamily: fontFamily.medium,
      fontSize: 13,
      color: colors.infoText,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.textMuted,
    },
    value: {
      fontFamily: fontFamily.regular,
      fontSize: 14,
      color: colors.textPrimary,
    },
    numeric: {
      fontVariant: ['tabular-nums'],
    },
    valueEmpty: {
      fontFamily: fontFamily.regular,
      fontSize: 14,
      color: colors.textMuted,
    },
    bmiBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.successBg,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 2,
      marginTop: 2,
    },
    bmiBadgeText: {
      fontFamily: fontFamily.semibold,
      fontSize: 13,
      color: colors.successText,
      fontVariant: ['tabular-nums'],
    },
  })
