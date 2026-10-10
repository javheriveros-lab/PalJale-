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
        style={({ hovered }: any) => [
          styles.base,
          variantStyles[variant],
          hovered && !isDisabled && hoverVariantStyles[variant],
          isDisabled && styles.disabled,
          style,
        ]}
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

// Solo tiene efecto en web — react-native-web traduce `hovered` del Pressable
// a un estilo real; en iOS/Android no hay puntero, así que no se aplica.
const hoverVariantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primaryDark },
  secondary: { backgroundColor: '#000000' },
  outline: { backgroundColor: colors.cardMuted, borderColor: colors.borderStrong },
  danger: { backgroundColor: '#b91c1c' },
};

const textVariantStyles: Record<Variant, { color: string }> = {
  primary: { color: colors.white },
  secondary: { color: colors.white },
  outline: { color: colors.textPrimary },
  danger: { color: colors.white },
};
