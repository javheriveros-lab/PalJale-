import React, { useEffect, useCallback } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';
import StripeRootProvider from '../src/components/StripeRootProvider';
import { AuthProvider } from '../src/contexts/AuthContext';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

function PushNotificationRegister() {
  usePushNotifications();
  return null;
}

export default function RootLayout() {
  // Fuente display "Oswald" (condensada, industrial) para títulos y precios
  // — reemplaza la sans del sistema, que leía genérica, sin identidad de
  // "construcción sofisticada".
  const [fontsLoaded] = useFonts({ Oswald_600SemiBold, Oswald_700Bold });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => { onLayout(); }, [onLayout]);

  if (!fontsLoaded) return null;

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
