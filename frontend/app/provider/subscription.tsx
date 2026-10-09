import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createProSubscription, getProStatus, cancelProSubscription } from '../../src/api/subscriptions';
import { useAuth } from '../../src/contexts/AuthContext';
import { Crown, Check, X, ArrowLeft, Sparkles } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';

const THEME_ORANGE = '#F37820';

export default function SubscriptionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    if (params.success) {
      Alert.alert('¡Bienvenido a Pro!', 'Tu suscripción está siendo activada.');
      loadStatus().then(refreshUser);
    }
    if (params.canceled) {
      Alert.alert('Suscripción cancelada', 'Puedes intentarlo cuando quieras.');
    }
  }, [params]);

  async function loadStatus() {
    try {
      const s = await getProStatus();
      setStatus(s);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe() {
    try {
      setProcessing(true);
      const res = await createProSubscription();
      if (res.url) {
        await WebBrowser.openBrowserAsync(res.url);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleCancel() {
    Alert.alert(
      'Cancelar Pro',
      '¿Seguro? Seguirás teniendo beneficios hasta el final del período pagado.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);
              await cancelProSubscription();
              await loadStatus();
              await refreshUser();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={THEME_ORANGE} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.title}>Suscripción Pro</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <Crown size={48} color={THEME_ORANGE} />
          <Text style={styles.planTitle}>Pal Jale Pro</Text>
          <Text style={styles.planPrice}>$299 MXN<Text style={styles.planPeriod}>/mes</Text></Text>
          <Text style={styles.planDesc}>Destaca tus anuncios y aparece en la sección de productos destacados.</Text>

          <View style={styles.benefit}><Check size={18} color={THEME_ORANGE} /><Text style={styles.benefitText}>Productos destacados en inicio</Text></View>
          <View style={styles.benefit}><Check size={18} color={THEME_ORANGE} /><Text style={styles.benefitText}>Mayor visibilidad en búsquedas</Text></View>
          <View style={styles.benefit}><Check size={18} color={THEME_ORANGE} /><Text style={styles.benefitText}>Insignia Pro en tu perfil</Text></View>
          <View style={styles.benefit}><Check size={18} color={THEME_ORANGE} /><Text style={styles.benefitText}>Soporte prioritario</Text></View>
        </View>

        {status?.is_pro ? (
          <View style={styles.activeCard}>
            <View style={styles.row}><Sparkles size={20} color={THEME_ORANGE} /><Text style={styles.activeTitle}>Tienes Pro activa</Text></View>
            <Text style={styles.activeText}>Estado: {status.status}</Text>
            {status.current_period_end && <Text style={styles.activeText}>Renueva: {new Date(status.current_period_end * 1000).toLocaleDateString()}</Text>}
            {status.cancel_at_period_end && <Text style={styles.warningText}>Se cancelará al final del período</Text>}
            {!status.cancel_at_period_end && (
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={handleCancel} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" /> : <><X size={18} color="#fff" /><Text style={styles.btnText}> Cancelar renovación</Text></>}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.subscribeBtn]} onPress={handleSubscribe} disabled={processing}>
            {processing ? <ActivityIndicator color="#fff" /> : <><Crown size={18} color="#fff" /><Text style={styles.btnText}> Suscribirme a Pro</Text></>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  planTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginTop: 12 },
  planPrice: { fontSize: 32, fontWeight: '800', color: THEME_ORANGE, marginTop: 8 },
  planPeriod: { fontSize: 16, fontWeight: '600', color: '#666' },
  planDesc: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 12, marginBottom: 20 },
  benefit: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 12 },
  benefitText: { marginLeft: 10, fontSize: 15, color: '#333' },
  activeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  activeTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginLeft: 8 },
  activeText: { fontSize: 14, color: '#555', marginBottom: 4 },
  warningText: { fontSize: 13, color: '#c0392b', marginTop: 8, fontWeight: '600' },
  btn: { borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  subscribeBtn: { backgroundColor: THEME_ORANGE },
  cancelBtn: { backgroundColor: '#555' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
});
