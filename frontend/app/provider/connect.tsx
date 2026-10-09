import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  getConnectStatus,
  getConnectRequirements,
  createConnectAccount,
  refreshConnectAccountLink,
  previewPayout,
  ConnectStatus,
  ConnectRequirements,
  PayoutPreview,
} from '../../src/api/connect';
import { Wallet, RefreshCw, CheckCircle, AlertTriangle, Calculator, ArrowLeft } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function ConnectOnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ success?: string; refresh?: string; account?: string }>();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [requirements, setRequirements] = useState<ConnectRequirements | null>(null);
  const [loading, setLoading] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [amount, setAmount] = useState('10000');
  const [isInternational, setIsInternational] = useState(false);
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const s = await getConnectStatus();
      setStatus(s);
      if (s.stripe_account_id && s.requirements_due) {
        const r = await getConnectRequirements();
        setRequirements(r);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cargar el estado de Stripe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (params.success) {
      Alert.alert('Onboarding completado', 'Estamos verificando el estado de tu cuenta...');
      loadStatus();
    }
    if (params.refresh) {
      Alert.alert('Onboarding incompleto', 'Por favor continúa con tu registro.');
      loadStatus();
    }
  }, [params.success, params.refresh, loadStatus]);

  const openOnboarding = async () => {
    try {
      setOnboardingLoading(true);
      let link: { account_link_url: string };
      if (status?.stripe_account_id) {
        link = await refreshConnectAccountLink(status.stripe_account_id);
      } else {
        link = await createConnectAccount();
      }
      await WebBrowser.openBrowserAsync(link.account_link_url);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo abrir el onboarding');
    } finally {
      setOnboardingLoading(false);
    }
  };

  const calculatePreview = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0');
      return;
    }
    try {
      setPreviewLoading(true);
      const result = await previewPayout(value, isInternational);
      setPreview(result);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo calcular el preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const isActive = status?.status === 'active' && status.charges_enabled && status.payouts_enabled;
  const isPending = !status?.stripe_account_id || status.status === 'pending';
  const isRestricted = status?.status === 'restricted';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#333" />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Cuenta de pagos</Text>
        <Text style={styles.subtitle}>Conecta tu cuenta bancaria para recibir pagos de rentas y ventas.</Text>

        {loading ? (
          <ActivityIndicator color={THEME_ORANGE} style={styles.loader} />
        ) : (
          <>
            <View style={[styles.statusCard, isActive ? styles.activeCard : isRestricted ? styles.restrictedCard : styles.pendingCard]}>
              <View style={styles.statusHeader}>
                {isActive ? (
                  <CheckCircle size={28} color="#16a34a" />
                ) : isRestricted ? (
                  <AlertTriangle size={28} color="#d97706" />
                ) : (
                  <Wallet size={28} color="#2563eb" />
                )}
                <Text style={styles.statusTitle}>
                  {isActive ? 'Cuenta activa' : isRestricted ? 'Cuenta restringida' : 'Cuenta pendiente'}
                </Text>
              </View>
              <Text style={styles.statusDesc}>
                {isActive
                  ? 'Ya puedes recibir pagos. Los fondos se transfieren a tu cuenta bancaria registrada.'
                  : isRestricted
                  ? 'Faltan documentos o hay un problema con tu cuenta. Revisa los requisitos pendientes.'
                  : 'Completa el registro en Stripe para empezar a recibir pagos.'}
              </Text>
            </View>

            {!isActive && (
              <TouchableOpacity
                style={[styles.actionBtn, onboardingLoading && styles.disabledBtn]}
                onPress={openOnboarding}
                disabled={onboardingLoading}
              >
                <RefreshCw size={20} color="#fff" />
                <Text style={styles.actionText}>
                  {onboardingLoading ? 'Abriendo...' : status?.stripe_account_id ? 'Continuar registro' : 'Conectar cuenta bancaria'}
                </Text>
              </TouchableOpacity>
            )}

            {requirements && requirements.currently_due.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Requisitos pendientes</Text>
                {requirements.currently_due.map((req, idx) => (
                  <View key={idx} style={styles.requirementRow}>
                    <AlertTriangle size={16} color="#d97706" />
                    <Text style={styles.requirementText}>{req}</Text>
                  </View>
                ))}
                {requirements.disabled_reason && (
                  <Text style={styles.disabledReason}>Razón: {requirements.disabled_reason}</Text>
                )}
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Calculator size={20} color={THEME_ORANGE} />
                <Text style={styles.sectionTitle}>Calculadora de ganancias</Text>
              </View>
              <Text style={styles.label}>Monto de la transacción (MXN)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="Ej. 10000"
              />
              <View style={styles.switchRow}>
                <Text style={styles.label}>Tarjeta internacional (+1%)</Text>
                <Switch value={isInternational} onValueChange={setIsInternational} />
              </View>
              <TouchableOpacity style={styles.calcBtn} onPress={calculatePreview} disabled={previewLoading}>
                <Text style={styles.calcBtnText}>{previewLoading ? 'Calculando...' : 'Calcular'}</Text>
              </TouchableOpacity>

              {preview && (
                <View style={styles.previewCard}>
                  <PreviewRow label="Subtotal" value={preview.subtotal_mxn} />
                  <PreviewRow label="Comisión Pal Jale (5%)" value={-preview.platform_fee_mxn} accent />
                  <PreviewRow label="Comisión Stripe" value={-preview.stripe_fee_mxn} />
                  <PreviewRow label="IVA sobre comisión Stripe" value={-preview.stripe_fee_iva_mxn} />
                  <View style={styles.divider} />
                  <PreviewRow label="Tu ganancia neta" value={preview.provider_net_mxn} bold />
                  <Text style={styles.netPercent}>
                    Aprox. {(preview.provider_net_percent * 100).toFixed(2)}% del subtotal
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PreviewRow({ label, value, accent, bold }: { label: string; value: number; accent?: boolean; bold?: boolean }) {
  const color = bold ? '#16a34a' : accent ? THEME_ORANGE : '#555';
  return (
    <View style={styles.previewRow}>
      <Text style={[styles.previewLabel, bold && styles.boldText]}>{label}</Text>
      <Text style={[styles.previewValue, { color }, bold && styles.boldText]}>
        {value >= 0 ? '$' : '-$'}{Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20, paddingBottom: 40 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { marginLeft: 6, color: '#333', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 20 },
  loader: { marginVertical: 40 },
  statusCard: { borderRadius: 16, padding: 18, marginBottom: 20 },
  activeCard: { backgroundColor: '#dcfce7' },
  pendingCard: { backgroundColor: '#dbeafe' },
  restrictedCard: { backgroundColor: '#fef3c7' },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusTitle: { fontSize: 17, fontWeight: '800', marginLeft: 10, color: '#1a1a1a' },
  statusDesc: { fontSize: 14, color: '#444', lineHeight: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 14, marginBottom: 24 },
  disabledBtn: { opacity: 0.7 },
  actionText: { color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 15 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginLeft: 8, color: '#1a1a1a' },
  requirementRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  requirementText: { marginLeft: 8, color: '#444', fontSize: 14, flex: 1 },
  disabledReason: { marginTop: 10, fontSize: 13, color: '#92400e', fontWeight: '600' },
  label: { fontSize: 14, color: '#555', marginBottom: 8, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  calcBtn: { backgroundColor: '#1a1a1a', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  calcBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  previewCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginTop: 18 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  previewLabel: { fontSize: 14, color: '#555' },
  previewValue: { fontSize: 14, fontWeight: '700' },
  boldText: { fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  netPercent: { fontSize: 13, color: '#666', marginTop: 8, textAlign: 'right' },
});
