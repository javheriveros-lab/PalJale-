import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { getTrackingLocation, updateTrackingLocation, startTracking } from '../../src/api/tracking';
import { apiClient } from '../../src/api/client';
import { MapPin, Navigation, Play } from 'lucide-react-native';
import TrackingMapView from '../../src/components/TrackingMapView';

const THEME_ORANGE = '#F37820';

export default function DropoffTrackingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProvider, setIsProvider] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadOrder = useCallback(async () => {
    try {
      const [o, me] = await Promise.all([apiClient(`/api/orders/${id}`), apiClient('/api/auth/me')]);
      setOrder(o);
      setIsProvider(o.provider_id === me.id);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }, [id]);

  const loadTracking = useCallback(async () => {
    try {
      const t = await getTrackingLocation(id as string);
      setTracking(t);
    } catch (err: any) {
      console.log('tracking error', err.message);
    }
  }, [id]);

  useEffect(() => { loadOrder().then(() => setLoading(false)); loadTracking(); }, [loadOrder, loadTracking]);

  useEffect(() => {
    intervalRef.current = setInterval(loadTracking, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadTracking]);

  async function handleStartTracking() {
    try {
      await startTracking(id as string);
      setTrackingActive(true);
      Alert.alert('Tracking iniciado', 'Tu ubicación se compartirá con el comprador.');
    } catch (err: any) { Alert.alert('Error', err.message); }
  }

  async function handleShareLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Activa la ubicación'); return; }
    try {
      const loc = await Location.getCurrentPositionAsync({});
      await updateTrackingLocation(id as string, loc.coords.latitude, loc.coords.longitude, 'en_camino');
      await loadTracking();
      Alert.alert('Ubicación enviada', '');
    } catch (err: any) { Alert.alert('Error', err.message); }
  }

  if (loading || !order) return <View style={styles.center}><ActivityIndicator size="large" color={THEME_ORANGE} /></View>;

  const providerLoc = tracking?.provider_location || (order.product_lat && order.product_lng ? { lat: order.product_lat, lng: order.product_lng } : null);
  const deliveryLoc = tracking?.delivery_location || (order.delivery_lat && order.delivery_lng ? { lat: order.delivery_lat, lng: order.delivery_lng } : null);
  const currentLoc = tracking?.lat && tracking?.lng ? { lat: tracking.lat, lng: tracking.lng } : providerLoc;

  const region = {
    latitude: currentLoc?.lat || 19.4326,
    longitude: currentLoc?.lng || -99.1332,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tracking de entrega</Text>
        <Text style={styles.subtitle}>Orden #{String(id).slice(-6)}</Text>
      </View>
      <TrackingMapView region={region} providerLoc={providerLoc} deliveryLoc={deliveryLoc} currentLoc={currentLoc} />
      <View style={styles.panel}>
        <View style={styles.row}><Navigation size={18} color={THEME_ORANGE} /><Text style={styles.statusText}>Estado: {tracking?.status || order.status || 'pendiente'}</Text></View>
        <Text style={styles.lastUpdate}>Última actualización: {tracking?.updated_at ? new Date(tracking.updated_at).toLocaleTimeString() : '—'}</Text>
        {isProvider ? (
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleStartTracking}><Play size={18} color="#fff" /><Text style={styles.btnText}>Iniciar ruta</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleShareLocation}><MapPin size={18} color="#fff" /><Text style={styles.btnText}>Enviar ubicación</Text></TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.hint}>La ubicación del transportista se actualiza cada 10 segundos.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  panel: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusText: { marginLeft: 8, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  lastUpdate: { fontSize: 12, color: '#888', marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  btnPrimary: { backgroundColor: THEME_ORANGE },
  btnSecondary: { backgroundColor: '#333' },
  btnText: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  hint: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 8 },
});
