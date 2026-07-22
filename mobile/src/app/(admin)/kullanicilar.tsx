import { router } from 'expo-router'
import { KeyRound, Plus, Power, Users } from 'lucide-react-native'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { canManageTarget, creatableRoles, roleLabel } from '@/domain/userRoles'
import { useManageUser, useUsers, type ManagedUser } from '@/features/admin/useUsers'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { fontFamily, radius, roleColors, spacing, type Palette } from '@/theme'

function UserRow({
  user,
  isSelf,
  canManage,
  onReset,
  onToggleActive,
  colors,
}: {
  user: ManagedUser
  isSelf: boolean
  canManage: boolean
  onReset: () => void
  onToggleActive: () => void
  colors: Palette
}) {
  const activeTint = roleColors(colors, user.is_active ? 'success' : 'danger')
  return (
    <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <View style={styles.rowTop}>
        <View style={styles.rowHead}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {user.full_name || '—'}
          </Text>
          <Text style={[styles.email, { color: colors.textMuted }]} numberOfLines={1}>
            {user.email ?? '—'}
          </Text>
        </View>
        <View style={styles.rowMeta}>
          <View style={[styles.roleChip, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
            <Text style={[styles.roleChipText, { color: colors.textSecondary }]}>{roleLabel(user.role)}</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: activeTint.text }]} />
        </View>
      </View>

      {canManage && (
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <Pressable onPress={onReset} accessibilityRole="button" style={styles.actionBtn} hitSlop={6}>
            <KeyRound color={colors.textSecondary} size={15} strokeWidth={1.75} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Şifre</Text>
          </Pressable>
          <Pressable
            onPress={onToggleActive}
            disabled={isSelf}
            accessibilityRole="button"
            style={[styles.actionBtn, isSelf && styles.disabled]}
            hitSlop={6}
          >
            <Power color={user.is_active ? colors.dangerText : colors.brandText} size={15} strokeWidth={1.75} />
            <Text style={[styles.actionText, { color: user.is_active ? colors.dangerText : colors.brandText }]}>
              {user.is_active ? 'Pasifleştir' : 'Aktifleştir'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

export default function KullanicilarScreen() {
  const { colors } = useTheme()
  const { role, session } = useAuth()
  const users = useUsers()
  const manage = useManageUser()

  const myRole = role
  const canCreate = !!myRole && creatableRoles(myRole).length > 0
  // Doktorlar Doktor Yönetimi ekranından yönetilir; burada personel hesapları.
  const staff = (users.data ?? []).filter((u) => u.role !== 'doctor')

  const resetPassword = (user: ManagedUser) => {
    Alert.prompt(
      'Şifre sıfırla',
      `${user.full_name} için yeni şifre girin (en az 8 karakter).`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          onPress: async (pw?: string) => {
            if (!pw || pw.length < 8) {
              Alert.alert('Geçersiz şifre', 'Şifre en az 8 karakter olmalı.')
              return
            }
            try {
              await manage.mutateAsync({ userId: user.id, action: 'reset_password', password: pw })
              Alert.alert('Sıfırlandı', 'Şifre güncellendi.')
            } catch (e) {
              Alert.alert('Sıfırlanamadı', (e as Error).message)
            }
          },
        },
      ],
      'secure-text',
    )
  }

  const toggleActive = (user: ManagedUser) => {
    const next = !user.is_active
    Alert.alert(
      next ? 'Aktifleştir' : 'Pasifleştir',
      `${user.full_name} ${next ? 'aktifleştirilecek' : 'pasifleştirilecek'}. Emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: next ? 'Aktifleştir' : 'Pasifleştir',
          style: next ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await manage.mutateAsync({ userId: user.id, action: 'set_active', isActive: next })
            } catch (e) {
              Alert.alert('İşlem başarısız', (e as Error).message)
            }
          },
        },
      ],
    )
  }

  if (users.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
        <Spinner />
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface0 }]}>
      <FlatList
        data={staff}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.info, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <Users color={colors.textMuted} size={15} strokeWidth={1.75} />
              <Text style={[styles.infoText, { color: colors.textMuted }]}>
                Doktorları Doktor Yönetimi ekranından yönetin.
              </Text>
            </View>
            {canCreate && (
              <Pressable
                onPress={() => router.push('/kullanici/yeni')}
                accessibilityRole="button"
                style={[styles.newBtn, { backgroundColor: colors.brandFill }]}
              >
                <Plus color={colors.brandOn} size={18} strokeWidth={2} />
                <Text style={[styles.newBtnText, { color: colors.brandOn }]}>Yeni Kullanıcı</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={<EmptyState title="Kullanıcı yok" />}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            isSelf={item.id === session?.user?.id}
            canManage={!!myRole && canManageTarget(myRole, item.role)}
            onReset={() => resetPassword(item)}
            onToggleActive={() => toggleActive(item)}
            colors={colors}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: spacing.four, gap: spacing.two },
  header: { gap: spacing.two, marginBottom: spacing.one },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.two,
  },
  infoText: { fontFamily: fontFamily.regular, fontSize: 12, flex: 1 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    borderRadius: radius.md,
    paddingVertical: spacing.two,
    minHeight: 44,
  },
  newBtnText: { fontFamily: fontFamily.semibold, fontSize: 15 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.three, gap: spacing.two },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  rowHead: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamily.semibold, fontSize: 15 },
  email: { fontFamily: fontFamily.regular, fontSize: 13, marginTop: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.one },
  roleChip: { borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.one + 2, paddingVertical: 2 },
  roleChipText: { fontFamily: fontFamily.medium, fontSize: 11 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: spacing.four, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.two },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.half },
  actionText: { fontFamily: fontFamily.medium, fontSize: 13 },
  disabled: { opacity: 0.4 },
})
