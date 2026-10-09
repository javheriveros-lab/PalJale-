import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getPresignedUploadUrl, uploadFileToS3 } from '../api/storage';
import { Camera, X, Upload } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

interface Props {
  folder: string;
  images: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

export default function S3MultiImagePicker({ folder, images, onChange, max = 5 }: Props) {
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload() {
    if (images.length >= max) { Alert.alert('Límite alcanzado', `Máximo ${max} imágenes`); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permiso requerido', 'Se necesita acceso a la galería'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: max - images.length,
    });

    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const asset of result.assets) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const filename = asset.uri.split('/').pop() || 'image.jpg';
        const { signed_url, public_url } = await getPresignedUploadUrl(filename, blob.type || 'image/jpeg', folder);
        await uploadFileToS3(blob, signed_url);
        uploadedUrls.push(public_url);
      }
      onChange([...images, ...uploadedUrls]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron subir las imágenes');
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
