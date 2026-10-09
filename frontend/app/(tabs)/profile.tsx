import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { User, ShieldCheck, Store, LogOut, ChevronRight, CreditCard } from 'lucide-react-native';
import Button from '../../src/components/ui/Button';
import { colors, spacing, radii, shadows } from '../../src/theme';

const IS_WEB = Platform.OS === 'web';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.centerText}>Inicia sesión para ver tu perfil</Text>
          <Button title="Ir a login" onPress={() => router.push('/(auth)/login')} />
        </View>
      </SafeAreaView>
    );
  }

  const isProviderLike = user.role === 'proveedor' || user.role === 'profesional';
  const isVerified = user.verification_status === 'verificado';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, IS_WEB && styles.scrollWeb]}>
        <View style={styles.header}>
          <View style={styles.avatar}><User size={40} color={colors.white} /></View>
          <View>
            <Text style={styles.name}>{user.full_name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <Text style={styles.role}>{user.role} • {user.verification_status}</Text>
          </View>
        </View>

        {!isVerified && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(auth)/verify')}>
            <View style={styles.menuIconBox}><ShieldCheck size={20} color={colors.primary} /></View>
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Verificar identidad</Text>
              <Text style={styles.menuDesc}>Sube tu INE y selfie para habilitar compras</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/payment-methods')}>
          <View style={styles.menuIconBox}><CreditCard size={20} color={colors.primary} /></View>
          <View style={styles.menuTextBox}>
            <Text style={styles.menuTitle}>Métodos de pago</Text>
            <Text style={styles.menuDesc}>Administra tus tarjetas guardadas</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {isProviderLike && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/provider')}>
            <View style={styles.menuIconBox}><Store size={20} color={colors.primary} /></View>
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Panel proveedor</Text>
              <Text style={styles.menuDesc}>Administra productos y órdenes recibidas</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {user.role === 'admin' && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin/user-payments')}>
            <View style={styles.menuIconBox}><ShieldCheck size={20} color={colors.primary} /></View>
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Métodos de pago (admin)</Text>
              <Text style={styles.menuDesc}>Consulta de solo lectura para soporte</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
          <View style={[styles.menuIconBox, styles.menuIconBoxDanger]}><LogOut size={20} color={colors.danger} /></View>
          <View style={styles.menuTextBox}>
            <Text style={[styles.menuTitle, { color: colors.danger }]}>Cerrar sesión</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: 40 },
  scrollWeb: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.xl, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg },
  name: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  role: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, textTransform: 'capitalize' },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  menuIconBox: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuIconBoxDanger: { backgroundColor: colors.dangerBg },
  menuTextBox: { flex: 1, marginLeft: spacing.md },
  menuTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  menuDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  logoutItem: { marginTop: spacing.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  centerText: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.lg },
});
