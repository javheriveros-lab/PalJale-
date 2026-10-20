import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../api/storage';
import { Camera, X, Upload } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

interface Props {
  folder: string;
  images: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

export default function S3MultiImagePicker({ folder, images, onChange, max = 5 }: Props) {
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload() {
    if (images.length >= max) { notify('Límite alcanzado', `Máximo ${max} imágenes`); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { notify('Permiso requerido', 'Se necesita acceso a la galería'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: max - images.length,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const asset of result.assets) {
        if (!asset.base64) continue;
        const mimeType = asset.mimeType || 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${asset.base64}`;
        const filename = asset.uri.split('/').pop() || 'image.jpg';
        const url = await uploadImage(dataUri, filename, folder);
        uploadedUrls.push(url);
      }
      onChange([...images, ...uploadedUrls]);
    } catch (err: any) {
      notify('Error', err.message || 'No se pudieron subir las imágenes');
      console.error('Error al subir imágenes:', err);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    const next = [...images];
    next.splice(index, 1);
    onChange(next);
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {images.map((url, idx) => (
          <View key={`${url}-${idx}`} style={styles.thumbWrap}>
            <Image source={{ uri: url }} style={styles.thumb} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(idx)}>
              <X size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {images.length < max && (
          <TouchableOpacity onPress={pickAndUpload} style={styles.addBtn} disabled={uploading}>
            {uploading ? <ActivityIndicator color={THEME_ORANGE} /> : <><Camera size={24} color="#999" /><Upload size={14} color={THEME_ORANGE} style={styles.uploadIcon} /></>}
          </TouchableOpacity>
        )}
      </ScrollView>
      <Text style={styles.hint}>{images.length}/{max} imágenes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  scroll: { gap: 10 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#e0e0e0' },
  removeBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ff4444', borderRadius: 12, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 90, height: 90, borderRadius: 10, borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9' },
  uploadIcon: { marginTop: 4 },
  hint: { fontSize: 12, color: '#888', marginTop: 6 },
});
