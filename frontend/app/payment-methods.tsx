// Archivo de ruta delgado: la implementación vive en src/components/PaymentMethodsScreen,
// con una variante .web.tsx que Metro resuelve automáticamente en el bundle de navegador
// (evita que @stripe/stripe-react-native, sin soporte web, se importe ahí).
export { default } from '../src/components/PaymentMethodsScreen';
