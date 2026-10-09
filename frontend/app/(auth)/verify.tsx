import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Redirect } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';
import S3ImagePicker from '../../src/components/S3ImagePicker';
import { ShieldCheck } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

function notify(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
    onOk?.();
  } else {
    Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
  }
}

export default function VerifyScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.verification_status === 'verificado') return <Redirect href="/(tabs)" />;
  const [ineFront, setIneFront] = useState('');
  const [selfie, setSelfie] = useState('');
  const [addressProof, setAddressProof] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!ineFront || !selfie || !addressProof) {
      const msg = 'Sube tu INE, una selfie y tu comprobante de domicilio';
      setError(msg);
      notify('Error', msg);
      return;
    }
    try {
      setLoading(true);
      await apiClient('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ ine_front_b64: ineFront, selfie_b64: selfie, address_proof_b64: addressProof }),
      });
      await refreshUser();
      notify('Éxito', 'Documentos enviados a revisión', () => router.replace('/(tabs)'));
    } catch (err: any) {
      const msg = err.message || 'No se pudo enviar la verificación';
      setError(msg);
      notify('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}><ShieldCheck size={40} color={THEME_ORANGE} /><Text style={styles.title}>Verificar identidad</Text></View>
        <Text style={styles.desc}>Sube una foto de tu INE por el frente, una selfie y tu comprobante de domicilio para validar tu cuenta.</Text>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <Text style={styles.label}>INE frontal</Text>
        <S3ImagePicker folder="kyc/ine" onUploaded={setIneFront} size={160} />
        <Text style={styles.label}>Selfie</Text>
        <S3ImagePicker folder="kyc/selfies" onUploaded={setSelfie} size={160} />
        <Text style={styles.label}>Comprobante de domicilio</Text>
        <S3ImagePicker folder="kyc/address-proof" onUploaded={setAddressProof} size={160} />
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
  errorText: { fontSize: 14, color: '#dc2626', backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 12, marginTop: 20 },
  btn: { backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
