import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link, Redirect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Truck } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function LoginScreen() {
  const router = useRouter();
  const { user, login } = useAuth();

  if (user?.verification_status === 'verificado') {
    return <Redirect href="/(tabs)" />;
  }
  if (user) {
    return <Redirect href="/(auth)/verify" />;
  }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Error', 'Ingresa email y contraseña'); return; }
    try {
      setLoading(true);
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoBox}><Truck size={48} color={THEME_ORANGE} /></View>
      <Text style={styles.title}>Pal Jale</Text>
      <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Iniciar sesión</Text>}
      </TouchableOpacity>
      <Link href="/(auth)/register" asChild>
        <TouchableOpacity style={styles.linkBtn}><Text style={styles.linkText}>¿No tienes cuenta? <Text style={styles.linkBold}>Regístrate</Text></Text></TouchableOpacity>
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 24, justifyContent: 'center' },
  logoBox: { alignSelf: 'center', marginBottom: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 28 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 14 },
  btn: { backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { marginTop: 20, alignSelf: 'center' },
  linkText: { color: '#555', fontSize: 14 },
  linkBold: { color: THEME_ORANGE, fontWeight: '700' },
});
