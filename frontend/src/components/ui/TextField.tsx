import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet, Animated } from 'react-native';
import { colors, radii, spacing } from '../../theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export default function TextField({ label, error, leftIcon, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  function handleFocus(e: any) {
    setFocused(true);
    Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: false }).start();
    onFocus?.(e);
  }
  function handleBlur(e: any) {
    setFocused(false);
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: false }).start();
    onBlur?.(e);
  }

  const borderColor = anim.interpolate({
    outputRange: [error ? colors.danger : colors.border, error ? colors.danger : colors.primary],
    inputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>}
      <Animated.View style={[styles.inputBox, { borderColor }, focused && styles.inputBoxFocused]}>
        {leftIcon}
        <TextInput
          style={[styles.input, leftIcon ? { marginLeft: spacing.sm } : undefined, style]}
          placeholderTextColor={colors.textPlaceholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  labelFocused: { color: colors.primary },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
  },
  inputBoxFocused: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: colors.textPrimary },
  error: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
});
