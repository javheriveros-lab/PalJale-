import React, { useRef } from 'react';
import { Pressable, Text, View, StyleSheet, Animated } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { colors, radii, spacing, shadows } from '../../theme';

interface Props {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

export default function RoleCard({ icon, title, description, selected, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start()}
        style={({ hovered }: any) => [
          styles.card,
          hovered && !selected && styles.cardHovered,
          selected && styles.cardSelected,
        ]}
      >
        <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>{icon}</View>
        <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {selected && (
          <View style={styles.check}>
            <CheckCircle2 size={18} color={colors.primary} fill={colors.white} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, minWidth: 140 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardHovered: {
    borderColor: colors.borderStrong,
    ...shadows.md,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    ...shadows.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconBoxSelected: { backgroundColor: colors.primaryLight },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textTransform: 'capitalize' },
  titleSelected: { color: colors.primaryDark },
  description: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 16 },
  check: { position: 'absolute', top: spacing.md, right: spacing.md },
});
