import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Redirect } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';
import S3ImagePicker from '../../src/components/S3ImagePicker';
import Button from '../../src/components/ui/Button';
import { ShieldCheck } from 'lucide-react-native';
import { colors, spacing, radii, shadows } from '../../src/theme';

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
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerIcon}><ShieldCheck size={24} color={colors.primary} /></View>
            <Text style={styles.title}>Verificar identidad</Text>
          </View>
          <Text style={styles.desc}>Sube una foto de tu INE por el frente, una selfie y tu comprobante de domicilio para validar tu cuenta.</Text>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <Text style={styles.label}>INE frontal</Text>
          <S3ImagePicker folder="kyc/ine" onUploaded={setIneFront} size={160} />
          <Text style={styles.label}>Selfie</Text>
          <S3ImagePicker folder="kyc/selfies" onUploaded={setSelfie} size={160} />
          <Text style={styles.label}>Comprobante de domicilio</Text>
          <S3ImagePicker folder="kyc/address-proof" onUploaded={setAddressProof} size={160} />
          <Button title="Enviar verificación" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xxl, paddingBottom: spacing.xxxl * 2 },
  card: Platform.select({
    web: { maxWidth: 520, width: '100%', alignSelf: 'center', backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.xxxl, borderWidth: 1, borderColor: colors.border, ...shadows.lg },
    default: {},
  }) as object,
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  headerIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  desc: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.xxl },
  errorText: { fontSize: 14, color: colors.danger, backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md, marginTop: spacing.xl },
  submitBtn: { marginTop: spacing.xxl },
});
