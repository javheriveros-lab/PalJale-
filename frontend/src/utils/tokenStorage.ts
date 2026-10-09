import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// En nativo usamos SecureStore (almacenamiento seguro a nivel de SO).
// En web, expo-secure-store no tiene implementación real — usamos AsyncStorage,
// que en web corre sobre localStorage. Es el estándar aceptado para SPAs sin
// backend-for-frontend; no es almacenamiento "seguro" a nivel de SO como en móvil.
const isWeb = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  return isWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}
