// Kaynak: /src/features/requests/PatientInfoCard.tsx (web) — label/value grid,
// "Belirtilmedi" fallback'ları ve BMI rozeti aynı mantıkla native'e taşındı.
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { bmi } from '@/domain/health'
import { colors, fontFamily, radius, spacing } from '@/theme'
import type { RequestRow } from '@/types/db'

const GENDER_LABEL: Record<NonNullable<RequestRow['gender']>, string> = {
  female: 'Kadın',
  male: 'Erkek',
  other: 'Diğer',
}

function isEmpty(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || value === ''
}

function InfoItem({ label, value, children }: { label: string; value?: string | number | null; children?: ReactNode }) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      {children ?? (
        <Text style={isEmpty(value) ? styles.valueEmpty : styles.value}>
          {isEmpty(value) ? 'Belirtilmedi' : value}
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
  const bmiValue = req.weight_kg && req.height_cm ? bmi(req.weight_kg, req.height_cm) : null
  const categoryDisplay = [categoryName, subcategoryName].filter(Boolean).join(' / ')

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Hasta Bilgileri</Text>
      <View style={styles.grid}>
        <InfoItem label="Hasta adı" value={patientName} />
        <InfoItem label="Kategori" value={categoryDisplay || null} />
        <InfoItem label="İstenen operasyon" value={operationName} />
        <InfoItem label="Yaş" value={req.age} />
        <InfoItem label="Cinsiyet" value={req.gender ? GENDER_LABEL[req.gender] : null} />
        <InfoItem label="Boy (cm)" value={req.height_cm} />
        <InfoItem label="Kilo (kg)" value={req.weight_kg} />
        <InfoItem label="BMI">
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
        <InfoItem label="Geçmiş ameliyatlar" value={req.past_surgeries} />
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label="Bilinen hastalıklar" value={req.known_conditions} />
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label="Düzenli ilaçlar" value={req.medications} />
      </View>
      <View style={styles.fullWidth}>
        <InfoItem label="Not" value={req.notes} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.three,
    gap: spacing.three,
  },
  cardTitle: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    color: colors.slate[900],
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
    letterSpacing: 0.4,
    color: colors.slate[500],
  },
  value: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.slate[800],
  },
  valueEmpty: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.slate[400],
  },
  bmiBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand[100],
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginTop: 2,
  },
  bmiBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.brand[700],
  },
})
