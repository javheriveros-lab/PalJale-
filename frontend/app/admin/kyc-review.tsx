import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck, ShieldX, User as UserIcon } from 'lucide-react-native';
import { getPendingKyc, approveKyc, rejectKyc } from '../../src/api/kyc';
import { KycPendingUser } from '../../src/types/models';
import Button from '../../src/components/ui/Button';
import { colors, spacing, radii, shadows, fonts } from '../../src/theme';

const IS_WEB = Platform.OS === 'web';

function notify(title: string, message: string) {
  if (IS_WEB) {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function KycReviewScreen() {
  const router = useRouter();
  const [items, setItems] = useState<KycPendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getPendingKyc();
      setItems(res.items);
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar la lista de verificaciones pendientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(user: KycPendingUser) {
    try {
      setActingId(user.id);
      await approveKyc(user.id);
      setItems((prev) => prev.filter((u) => u.id !== user.id));
      notify('Aprobado', `${user.full_name} ya puede comprar/vender en la plataforma.`);
    } catch (err: any) {
      notify('Error', err.message || 'No se pudo aprobar la verificación');
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(user: KycPendingUser) {
    try {
      setActingId(user.id);
      await rejectKyc(user.id);
      setItems((prev) => prev.filter((u) => u.id !== user.id));
      notify('Rechazado', `Se marcó la verificación de ${user.full_name} como rechazada.`);
    } catch (err: any) {
      notify('Error', err.message || 'No se pudo rechazar la verificación');
    } finally {
      setActingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, IS_WEB && styles.scrollWeb]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <ShieldCheck size={22} color={colors.primary} />
          <Text style={styles.title}>Verificaciones pendientes</Text>
        </View>
        <Text style={styles.subtitle}>
          Revisa el INE, la selfie y el comprobante de domicilio de cada usuario antes de aprobar o rechazar su cuenta.
        </Text>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && !error && items.length === 0 && (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No hay verificaciones pendientes por ahora.</Text>
          </View>
        )}

        {items.map((u) => (
          <View key={u.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}><UserIcon size={20} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{u.full_name}</Text>
                <Text style={styles.meta}>{u.email} · {u.role}{u.phone ? ` · ${u.phone}` : ''}</Text>
              </View>
            </View>

            <View style={styles.imagesRow}>
              <KycImage label="INE" uri={u.kyc_data?.ine_front_b64} />
              <KycImage label="Selfie" uri={u.kyc_data?.selfie_b64} />
              <KycImage label="Comprobante" uri={u.kyc_data?.address_proof_b64} />
            </View>

            <View style={styles.actionsRow}>
              <Button
                title="Rechazar"
                variant="outline"
                onPress={() => handleReject(u)}
                loading={actingId === u.id}
                icon={<ShieldX size={18} color={colors.textPrimary} />}
                style={styles.actionBtn}
              />
              <Button
                title="Aprobar"
                variant="primary"
                onPress={() => handleApprove(u)}
                loading={actingId === u.id}
                icon={<ShieldCheck size={18} color={colors.white} />}
                style={styles.actionBtn}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function KycImage({ label, uri }: { label: string; uri?: string | null }) {
  const isUrl = !!uri && uri.startsWith('http');
  return (
    <View style={styles.imageBox}>
      <Text style={styles.imageLabel}>{label}</Text>
      {isUrl ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imageMissing]}>
          <Text style={styles.imageMissingText}>Sin foto</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  scrollWeb: { maxWidth: 820, width: '100%', alignSelf: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  backText: { marginLeft: 6, color: colors.textPrimary, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  title: { fontSize: 20, fontFamily: fonts.displayBold, color: colors.textPrimary, marginLeft: 8 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 19 },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  errorText: { color: colors.danger, fontSize: 14, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  name: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  imagesRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  imageBox: { flex: 1, minWidth: 100 },
  imageLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  image: { width: '100%', aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.cardMuted },
  imageMissing: { alignItems: 'center', justifyContent: 'center' },
  imageMissingText: { fontSize: 11, color: colors.textMuted },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1 },
});
