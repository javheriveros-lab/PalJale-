import React, { useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert, Platform, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../api/storage';
import { Camera, Upload } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

interface Props { folder: string; onUploaded: (url: string) => void; existingUrl?: string; size?: number; }

export default function S3ImagePicker({ folder, onUploaded, existingUrl, size = 120 }: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(existingUrl || null);
  const [error, setError] = useState('');

  async function pickAndUpload() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { notify('Permiso requerido', 'Se necesita acceso a la galería'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8, base64: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { notify('Error', 'No se pudo leer la imagen seleccionada'); return; }
    setLoading(true);
    try {
      const mimeType = asset.mimeType || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${asset.base64}`;
      const filename = asset.uri.split('/').pop() || 'image.jpg';
      const url = await uploadImage(dataUri, filename, folder);
      setPreview(url); onUploaded(url);
    } catch (err: any) {
      const msg = err.message || 'No se pudo subir la imagen';
      setError(msg);
      notify('Error', msg);
      console.error('Error al subir imagen:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View>
      <TouchableOpacity onPress={pickAndUpload} style={[styles.container, { width: size, height: size }]}>
        {preview ? <Image source={{ uri: preview }} style={[styles.image, { width: size, height: size }]} /> : (
          <View style={[styles.placeholder, { width: size, height: size }]}><Camera size={28} color="#999" /></View>
        )}
        {loading && <View style={[styles.overlay, { width: size, height: size }]}><ActivityIndicator color={THEME_ORANGE} /></View>}
        {!loading && <View style={styles.badge}><Upload size={12} color="#fff" /></View>}
      </TouchableOpacity>
      {!!error && <Text style={[styles.errorText, { width: size }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  errorText: { fontSize: 11, color: '#dc2626', marginTop: 4 },
  container: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  image: { borderRadius: 12 },
  placeholder: { backgroundColor: '#f0f0f0', borderRadius: 12, borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: THEME_ORANGE, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
