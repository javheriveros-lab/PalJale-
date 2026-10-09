import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link, Redirect } from 'expo-router';
import { UserPlus, User, Store, HardHat, Mail, Phone, Lock, MapPin, Briefcase } from 'lucide-react-native';
import { useAuth, RegisterPayload } from '../../src/contexts/AuthContext';
import TextField from '../../src/components/ui/TextField';
import Button from '../../src/components/ui/Button';
import RoleCard from '../../src/components/ui/RoleCard';
import { colors, spacing, radii, shadows } from '../../src/theme';

const ROLES = [
  { value: 'cliente', title: 'Cliente', description: 'Rento o compro equipo y materiales', icon: User },
  { value: 'proveedor', title: 'Proveedor', description: 'Vendo o rento equipo y materiales', icon: Store },
  { value: 'profesional', title: 'Profesional', description: 'Ofrezco mano de obra u oficio', icon: HardHat },
] as const;

export default function RegisterScreen() {
  const router = useRouter();
  const { user, register } = useAuth();

  if (user?.verification_status === 'verificado') {
    return <Redirect href="/(tabs)" />;
  }
  const [payload, setPayload] = useState<RegisterPayload>({
    email: '', password: '', full_name: '', phone: '', role: 'cliente', address: '', profession: '', experience_years: 0,
  });
  const [loading, setLoading] = useState(false);

  const isProviderLike = payload.role === 'proveedor' || payload.role === 'profesional';

  function update<K extends keyof RegisterPayload>(key: K, value: RegisterPayload[K]) {
    setPayload((p) => ({ ...p, [key]: value }));
  }

  async function handleRegister() {
    if (!payload.email || !payload.password || !payload.full_name || !payload.phone) {
      Alert.alert('Error', 'Completa los campos obligatorios'); return;
    }
    try {
      setLoading(true);
      await register(payload);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerIcon}><UserPlus size={24} color={colors.primary} /></View>
            <Text style={styles.title}>Crear cuenta</Text>
          </View>

          <TextField label="Nombre completo" value={payload.full_name} onChangeText={(v) => update('full_name', v)} placeholder="Tu nombre" />
          <TextField label="Email" value={payload.email} onChangeText={(v) => update('email', v)} placeholder="correo@ejemplo.com" autoCapitalize="none" keyboardType="email-address" leftIcon={<Mail size={18} color={colors.textMuted} />} />
          <TextField label="Teléfono" value={payload.phone} onChangeText={(v) => update('phone', v)} placeholder="55 1234 5678" keyboardType="phone-pad" leftIcon={<Phone size={18} color={colors.textMuted} />} />
          <TextField label="Contraseña" value={payload.password} onChangeText={(v) => update('password', v)} placeholder="Mínimo 6 caracteres" secureTextEntry leftIcon={<Lock size={18} color={colors.textMuted} />} />
          <TextField label="Dirección" value={payload.address} onChangeText={(v) => update('address', v)} placeholder="Calle, número, colonia" leftIcon={<MapPin size={18} color={colors.textMuted} />} />

          <Text style={styles.label}>¿Qué tipo de cuenta quieres?</Text>
          <View style={styles.roleGrid}>
            {ROLES.map((r) => (
              <RoleCard
                key={r.value}
                icon={<r.icon size={20} color={payload.role === r.value ? colors.primary : colors.textMuted} />}
                title={r.title}
                description={r.description}
                selected={payload.role === r.value}
                onPress={() => update('role', r.value)}
              />
            ))}
          </View>

          {isProviderLike && (
            <>
              <TextField
                label="Profesión / Especialidad"
                value={payload.profession}
                onChangeText={(v) => update('profession', v)}
                placeholder={payload.role === 'proveedor'
                  ? 'Ej. Proveedor de materiales, renta de maquinaria, herramientas...'
                  : 'Ej. Ingeniero, Arquitecto, Albañil, Plomero...'}
                leftIcon={<Briefcase size={18} color={colors.textMuted} />}
              />
              <TextField
                label="Años de experiencia"
                value={String(payload.experience_years || '')}
                onChangeText={(v) => update('experience_years', parseInt(v || '0', 10))}
                placeholder="0"
                keyboardType="number-pad"
              />
            </>
          )}

          <View style={styles.submitBtnWrapper}>
            <Button title="Registrarme" onPress={handleRegister} loading={loading} style={styles.submitBtn} />
          </View>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.linkBtn}>
              <Text style={styles.linkText}>¿Ya tienes cuenta? <Text style={styles.linkBold}>Inicia sesión</Text></Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xxl, paddingBottom: spacing.xxxl * 2 },
  card: Platform.select({
    web: { maxWidth: 520, width: '100%', alignSelf: 'center', backgroundColor: colors.card, borderRadius: radii.xl, padding: spacing.xxxl, borderWidth: 1, borderColor: colors.border, ...shadows.lg },
    default: {},
  }) as object,
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl },
  headerIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  submitBtnWrapper: { marginTop: spacing.lg, alignItems: 'center' },
  submitBtn: { width: '100%', maxWidth: 320, alignSelf: 'center' },
  linkBtn: { marginTop: spacing.xl, alignSelf: 'center' },
  linkText: { color: colors.textMuted, fontSize: 14 },
  linkBold: { color: colors.primary, fontWeight: '700' },
});
