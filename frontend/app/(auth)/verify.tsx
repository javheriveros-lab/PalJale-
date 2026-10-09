import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Redirect } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';
import S3ImagePicker from '../../src/components/S3ImagePicker';
import { ShieldCheck } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function VerifyScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.verification_status === 'verificado') return <Redirect href="/(tabs)" />;
  const [ineFront, setIneFront] = useState('');
  const [selfie, setSelfie] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!ineFront || !selfie) { Alert.alert('Error', 'Sube ambas imágenes'); return; }
    try {
      setLoading(true);
      await apiClient('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ ine_front_b64: ineFront, selfie_b64: selfie }),
      });
      await refreshUser();
      Alert.alert('Éxito', 'Identidad enviada a verificación', [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo enviar la verificación');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}><ShieldCheck size={40} color={THEME_ORANGE} /><Text style={styles.title}>Verificar identidad</Text></View>
        <Text style={styles.desc}>Sube una foto de tu INE por el frente y una selfie para validar tu cuenta.</Text>
        <Text style={styles.label}>INE frontal</Text>
        <S3ImagePicker folder="kyc/ine" onUploaded={setIneFront} size={160} />
        <Text style={styles.label}>Selfie</Text>
        <S3ImagePicker folder="kyc/selfies" onUploaded={setSelfie} size={160} />
        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enviar verificación</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  desc: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 12, marginTop: 20 },
  btn: { backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
