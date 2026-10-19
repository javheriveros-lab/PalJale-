import React from 'react';
import { Platform } from 'react-native';
import { Tabs, Slot } from 'expo-router';
import { Home, MapPin, ClipboardList, User, ShoppingCart } from 'lucide-react-native';
import WebAppShell from '../../src/components/WebAppShell';
import { colors } from '../../src/theme';

// Catálogo y Mapa son navegación pública (un visitante sin cuenta puede
// verlos y buscar); Carrito y Órdenes son datos de sesión y se auto-gatean
// adentro de cada pantalla con <Redirect> a login. Por eso ya no hay un
// AuthGuard general envolviendo todo el grupo — bloqueaba el catálogo para
// cualquiera que no hubiera iniciado sesión.
//
// En web se usa una barra de navegación superior (WebAppShell) en vez de
// tabs inferiores — ambas ramas viven en este único archivo de ruta porque
// Expo Router no resolvió _layout.web.tsx de forma confiable (confirmado
// al desplegar la web: el bundle seguía usando el _layout nativo).
export default function TabsLayout() {
  if (Platform.OS === 'web') {
    return (
      <WebAppShell>
        <Slot />
      </WebAppShell>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 60, paddingBottom: 8, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="cart" options={{ title: 'Carrito', tabBarIcon: ({ color, size }) => <ShoppingCart size={size} color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: 'Mapa', tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Órdenes', tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
    </Tabs>
  );
}
