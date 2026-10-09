import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Variante nativa (iOS/Android): envuelve con el provider real del SDK.
// Metro resuelve automáticamente StripeRootProvider.web.tsx en vez de este
// archivo cuando el target es web, así que @stripe/stripe-react-native
// (sin soporte web) nunca se importa en el bundle de navegador.
export default function StripeRootProvider({ children }: { children: React.ReactElement }) {
  return <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>{children}</StripeProvider>;
}
