import React from 'react';
import { Stack } from 'expo-router';
import AuthGuard from '../../src/components/AuthGuard';

export default function ProviderLayout() {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGuard>
  );
}
