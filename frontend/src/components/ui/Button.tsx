import React, { useRef } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, Animated, ViewStyle } from 'react-native';
import { colors, radii, spacing, shadows } from '../../theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export default function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  }

  const isDisabled = disabled || loading;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={isDisabled}
        style={[styles.base, variantStyles[variant], isDisabled && styles.disabled, style]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.white} />
        ) : (
          <>
            {icon}
            <Text style={[styles.text, textVariantStyles[variant], icon ? { marginLeft: spacing.sm } : undefined]}>{title}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  disabled: { opacity: 0.6 },
  text: { fontSize: 15, fontWeight: '700' },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary, ...shadows.sm },
  secondary: { backgroundColor: colors.textPrimary },
  outline: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
};

const textVariantStyles: Record<Variant, { color: string }> = {
  primary: { color: colors.white },
  secondary: { color: colors.white },
  outline: { color: colors.textPrimary },
  danger: { color: colors.white },
};
