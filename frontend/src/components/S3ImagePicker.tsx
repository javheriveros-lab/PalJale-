import React, { useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getPresignedUploadUrl, uploadFileToS3 } from '../api/storage';
import { Camera, Upload } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

interface Props { folder: string; onUploaded: (url: string) => void; existingUrl?: string; size?: number; }

export default function S3ImagePicker({ folder, onUploaded, existingUrl, size = 120 }: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(existingUrl || null);

  async function pickAndUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permiso requerido', 'Se necesita acceso a la galería'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setLoading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const filename = asset.uri.split('/').pop() || 'image.jpg';
      const { signed_url, public_url } = await getPresignedUploadUrl(filename, blob.type || 'image/jpeg', folder);
      await uploadFileToS3(blob, signed_url);
      setPreview(public_url); onUploaded(public_url);
    } catch (err: any) { Alert.alert('Error', err.message || 'No se pudo subir la imagen'); }
    finally { setLoading(false); }
  }

  return (
    <TouchableOpacity onPress={pickAndUpload} style={[styles.container, { width: size, height: size }]}>
      {preview ? <Image source={{ uri: preview }} style={[styles.image, { width: size, height: size }]} /> : (
        <View style={[styles.placeholder, { width: size, height: size }]}><Camera size={28} color="#999" /></View>
      )}
      {loading && <View style={[styles.overlay, { width: size, height: size }]}><ActivityIndicator color={THEME_ORANGE} /></View>}
      {!loading && <View style={styles.badge}><Upload size={12} color="#fff" /></View>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  image: { borderRadius: 12 },
  placeholder: { backgroundColor: '#f0f0f0', borderRadius: 12, borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: THEME_ORANGE, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
