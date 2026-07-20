// Kaynak: /src/features/requests/PatientInfoCard.tsx (web) — label/value grid,
// "Belirtilmedi" fallback'ları ve BMI rozeti aynı mantıkla native'e taşındı.
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { bmi } from '@/domain/health'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, spacing, type Palette } from '@/theme'
import type { RequestRow } from '@/types/db'

const GENDER_LABEL: Record<NonNullable<RequestRow['gender']>, string> = {
  female: 'Kadın',
  male: 'Erkek',
  other: 'Diğer',
}

function isEmpty(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || value === ''
}

// Etiketler webdeki domain/lifestyle.ts ile aynı (mobil kopya).
const SMOKING_LABEL: Record<NonNullable<RequestRow['smoking_status']>, string> = {
  never: 'Hiç kullanmadı', former: 'Bıraktı', current: 'Aktif içici',
}
const ALCOHOL_LABEL: Record<NonNullable<RequestRow['alcohol_status']>, string> = {
  never: 'Hiç', occasional: 'Sosyal', regular: 'Düzenli',
}
function smokingDisplay(req: RequestRow): string | null {
  if (!req.smoking_status) return null
  const base = SMOKING_LABEL[req.smoking_status]
  return req.smoking_pack_years != null ? `${base} · ${req.smoking_pack_years} paket-yıl` : base
}
function alcoholDisplay(req: RequestRow): string | null {
  if (!req.alcohol_status) return null
  const base = ALCOHOL_LABEL[req.alcohol_status]
  return req.alcohol_drinks_per_week != null ? `${base} · ${req.alcohol_drinks_per_week}/hafta` : base
}

function InfoItem({
  label,
  value,
  numeric,
  children,
  styles,
}: {
  label: string
  value?: string | number | null
  numeric?: boolean
  children?: ReactNode
  styles: ReturnType<typeof makeStyles>
}) {
  const empty = isEmpty(value)
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      {children ?? (
        <Text
          style={[
            empty ? styles.valueEmpty : styles.value,
            numeric && !empty && styles.numeric,
          ]}
        >
          {empty ? 'Belirtilmedi' : value}
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
}: {
  req: RequestRow
  patientName: string
  categoryName?: string
  subcategoryName?: string | null
  operationName?: string | null
}) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const bmiValue = req.weight_kg && req.height_cm ? bmi(req.weight_kg, req.height_cm) : null
  const categoryDisplay = [categoryName, subcategoryName].filter(Boolean).join(' / ')

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Hasta Bilgileri</Text>
      <View style={styles.grid}>
        <InfoItem label="Hasta adı" value={patientName} styles={styles} />
        <InfoItem label="Kategori" value={categoryDisplay || null} styles={styles} />
        <InfoItem label="İstenen operasyon" value={operationName} styles={styles} />
        <InfoItem label="Yaş" value={req.age} numeric styles={styles} />
        <InfoItem label="Cinsiyet" value={req.gender ? GENDER_LABEL[req.gender] : null} styles={styles} />
        <InfoItem label="Boy (cm)" value={req.height_cm} numeric styles={styles} />
        <InfoItem label="Kilo (kg)" value={req.weight_kg} numeric styles={styles} />
        <InfoItem label="BMI" styles={styles}>
          {bmiValue === null ? (
            <Text style={styles.valueEmpty}>Belirtilmedi</Text>
          ) : (
            <View style={styles.bmiBadge}>
              <Text style={styles.bmiBadgeText}>{bmiValue}</Text>
            </View>
          )}
        </InfoItem>
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label="Geçmiş ameliyatlar" value={req.past_surgeries} styles={styles} />
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label="Bilinen hastalıklar" value={req.known_conditions} styles={styles} />
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label="Düzenli ilaçlar" value={req.medications} styles={styles} />
      </View>
      <View style={styles.grid}>
        <InfoItem label="Sigara" value={smokingDisplay(req)} styles={styles} />
        <InfoItem label="Alkol" value={alcoholDisplay(req)} styles={styles} />
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label="Not" value={req.notes} styles={styles} />
      </View>
    </View>
  )
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface2,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.three,
      gap: spacing.three,
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
      gap: 2,
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
