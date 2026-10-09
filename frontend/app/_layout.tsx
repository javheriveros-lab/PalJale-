import React from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StripeRootProvider from '../src/components/StripeRootProvider';
import { AuthProvider } from '../src/contexts/AuthContext';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

function PushNotificationRegister() {
  usePushNotifications();
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StripeRootProvider>
        <AuthProvider>
          <PushNotificationRegister />
          <Slot />
        </AuthProvider>
      </StripeRootProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
