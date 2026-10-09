import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface Props {
  variant?: 'mark' | 'lockup';
  size?: number;
}

const SOURCES = {
  mark: require('../../../assets/brand/logo-mark.png'),
  lockup: require('../../../assets/brand/logo-lockup.png'),
};

const ASPECT = {
  mark: 1,
  lockup: 529 / 564,
};

export default function Logo({ variant = 'mark', size = 40 }: Props) {
  return (
    <Image
      source={SOURCES[variant]}
      style={[styles.base, { width: size * ASPECT[variant], height: size }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  base: {},
});
