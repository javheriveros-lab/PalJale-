import { ViewStyle } from 'react-native';

// react-native-web traduce shadow*/elevation a box-shadow automáticamente,
// así que un solo objeto por nivel sirve para iOS/Android/web.
export const shadows: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};
