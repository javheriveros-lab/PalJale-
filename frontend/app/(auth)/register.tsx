import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link, Redirect } from 'expo-router';
import { useAuth, RegisterPayload } from '../../src/contexts/AuthContext';
import { UserPlus } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function RegisterScreen() {
  const router = useRouter();
  const { user, register } = useAuth();

  if (user?.verification_status === 'verificado') {
    return <Redirect href="/(tabs)" />;
  }
  const [payload, setPayload] = useState<RegisterPayload>({
    email: '', password: '', full_name: '', phone: '', role: 'cliente', address: '', profession: '', experience_years: 0,
  });
  const [loading, setLoading] = useState(false);

  const isProviderLike = payload.role === 'proveedor' || payload.role === 'profesional';

  function update<K extends keyof RegisterPayload>(key: K, value: RegisterPayload[K]) {
    setPayload((p) => ({ ...p, [key]: value }));
  }

  async function handleRegister() {
    if (!payload.email || !payload.password || !payload.full_name || !payload.phone) {
      Alert.alert('Error', 'Completa los campos obligatorios'); return;
    }
    try {
      setLoading(true);
      await register(payload);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}><UserPlus size={40} color={THEME_ORANGE} /><Text style={styles.title}>Crear cuenta</Text></View>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput style={styles.input} value={payload.full_name} onChangeText={(v) => update('full_name', v)} placeholder="Tu nombre" />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={payload.email} onChangeText={(v) => update('email', v)} placeholder="correo@ejemplo.com" autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>Teléfono</Text>
        <TextInput style={styles.input} value={payload.phone} onChangeText={(v) => update('phone', v)} placeholder="55 1234 5678" keyboardType="phone-pad" />
        <Text style={styles.label}>Contraseña</Text>
        <TextInput style={styles.input} value={payload.password} onChangeText={(v) => update('password', v)} placeholder="Mínimo 6 caracteres" secureTextEntry />
        <Text style={styles.label}>Dirección</Text>
        <TextInput style={styles.input} value={payload.address} onChangeText={(v) => update('address', v)} placeholder="Calle, número, colonia" />
        <Text style={styles.label}>Rol</Text>
        <View style={styles.chipRow}>
          {(['cliente', 'proveedor', 'profesional'] as const).map((r) => (
            <TouchableOpacity key={r} style={[styles.chip, payload.role === r && styles.chipActive]} onPress={() => update('role', r)}>
              <Text style={[styles.chipText, payload.role === r && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {isProviderLike && (
          <>
            <Text style={styles.label}>Profesión / Especialidad</Text>
            <TextInput style={styles.input} value={payload.profession} onChangeText={(v) => update('profession', v)} placeholder="Ej. Albañil, plomero" />
            <Text style={styles.label}>Años de experiencia</Text>
            <TextInput style={styles.input} value={String(payload.experience_years || '')} onChangeText={(v) => update('experience_years', parseInt(v || '0', 10))} placeholder="0" keyboardType="number-pad" />
          </>
        )}
        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Registrarme</Text>}
        </TouchableOpacity>
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkBtn}><Text style={styles.linkText}>¿Ya tienes cuenta? <Text style={styles.linkBold}>Inicia sesión</Text></Text></TouchableOpacity>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#e0e0e0', marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: THEME_ORANGE, borderColor: THEME_ORANGE },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  btn: { backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { marginTop: 20, alignSelf: 'center' },
  linkText: { color: '#555', fontSize: 14 },
  linkBold: { color: THEME_ORANGE, fontWeight: '700' },
});
