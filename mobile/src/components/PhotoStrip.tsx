// Kaynak deseni: /src/components/ui/PhotoGrid.tsx (web) — thumbnail grid + tam ekran
// modal. Mobilde yatay ScrollView + Modal olarak sadeleştirildi (pinch/zoom yok).
import { useState } from 'react'
import { Image } from 'expo-image'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { colors, radius, spacing } from '@/theme'

export function PhotoStrip({ urls, altLabel }: { urls: string[]; altLabel: string }) {
  const [selected, setSelected] = useState<string | null>(null)

  if (urls.length === 0) return null

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {urls.map((url) => (
          <Pressable key={url} onPress={() => setSelected(url)}>
            <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" accessibilityLabel={altLabel} />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          {selected ? (
            <Image source={{ uri: selected }} style={styles.fullImage} contentFit="contain" accessibilityLabel={altLabel} />
          ) : null}
          <Pressable style={styles.closeButton} onPress={() => setSelected(null)}>
            <Text style={styles.closeButtonText}>Kapat</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  strip: {
    gap: spacing.two,
    paddingVertical: spacing.one,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.slate[100],
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: spacing.four,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.one,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
})
