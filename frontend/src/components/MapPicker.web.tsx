import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Navigation } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface Props { onLocationSelect: (lat: number, lng: number, address: string) => void; initialLat?: number; initialLng?: number; }

// Variante web: react-native-maps no tiene mapa real en navegador y
// Location.reverseGeocodeAsync tampoco está soportado en web. En vez de
// arrastrar un pin, se captura lat/lng con inputs numéricos o el botón de
// geolocalización del navegador (expo-location sí soporta eso en web).
export default function MapPicker({ onLocationSelect, initialLat, initialLng }: Props) {
  const [lat, setLat] = useState(initialLat != null ? String(initialLat) : '');
  const [lng, setLng] = useState(initialLng != null ? String(initialLng) : '');
  const [locating, setLocating] = useState(false);

  function commit(newLat: number, newLng: number) {
    onLocationSelect(newLat, newLng, `${newLat.toFixed(5)}, ${newLng.toFixed(5)}`);
  }

  async function useCurrentLocation() {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso denegado', 'Activa la ubicación en el navegador'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      setLat(String(loc.coords.latitude));
      setLng(String(loc.coords.longitude));
      commit(loc.coords.latitude, loc.coords.longitude);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo obtener tu ubicación');
    } finally {
      setLocating(false);
    }
  }

  function handleManualChange(nextLat: string, nextLng: string) {
    setLat(nextLat);
    setLng(nextLng);
    const parsedLat = parseFloat(nextLat);
    const parsedLng = parseFloat(nextLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) commit(parsedLat, parsedLng);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.locateBtn} onPress={useCurrentLocation} disabled={locating}>
        {locating ? <ActivityIndicator color="#fff" size="small" /> : <Navigation size={18} color="#fff" />}
        <Text style={styles.locateBtnText}>{locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}</Text>
      </TouchableOpacity>
      <Text style={styles.orText}>o ingresa las coordenadas manualmente:</Text>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Latitud</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={lat} onChangeText={(v) => handleManualChange(v, lng)} placeholder="19.4326" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Longitud</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={lng} onChangeText={(v) => handleManualChange(lat, v)} placeholder="-99.1332" />
        </View>
      </View>
      {lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) && (
        <View style={styles.previewRow}><MapPin size={16} color="#F37820" /><Text style={styles.previewText}>{parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width, maxWidth: 480, alignSelf: 'center', backgroundColor: '#f9fafb', borderRadius: 12, padding: 16 },
  locateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F37820', borderRadius: 10, paddingVertical: 12, marginBottom: 12 },
  locateBtnText: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  orText: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  label: { fontSize: 12, color: '#555', fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: '#fff' },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  previewText: { marginLeft: 6, fontSize: 13, color: '#555' },
});
