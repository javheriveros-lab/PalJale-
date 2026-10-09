import React from 'react';

// Variante web: NO importa @stripe/stripe-react-native (sin soporte web,
// rompe el bundle de Metro al importar codegenNativeComponent). En web los
// pagos se hacen vía Stripe Checkout hospedado (expo-web-browser), que no
// requiere este SDK.
export default function StripeRootProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
