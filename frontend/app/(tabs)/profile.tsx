import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { User, ShieldCheck, Store, LogOut, ChevronRight, CreditCard } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

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
          <TouchableOpacity style={styles.btn} onPress={() => router.push('/(auth)/login')}><Text style={styles.btnText}>Ir a login</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isProviderLike = user.role === 'proveedor' || user.role === 'profesional';
  const isVerified = user.verification_status === 'verificado';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}><User size={40} color="#fff" /></View>
          <View>
            <Text style={styles.name}>{user.full_name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <Text style={styles.role}>{user.role} • {user.verification_status}</Text>
          </View>
        </View>

        {!isVerified && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(auth)/verify')}>
            <ShieldCheck size={22} color={THEME_ORANGE} />
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Verificar identidad</Text>
              <Text style={styles.menuDesc}>Sube tu INE y selfie para habilitar compras</Text>
            </View>
            <ChevronRight size={18} color="#999" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/payment-methods')}>
          <CreditCard size={22} color={THEME_ORANGE} />
          <View style={styles.menuTextBox}>
            <Text style={styles.menuTitle}>Métodos de pago</Text>
            <Text style={styles.menuDesc}>Administra tus tarjetas guardadas</Text>
          </View>
          <ChevronRight size={18} color="#999" />
        </TouchableOpacity>

        {isProviderLike && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/provider')}>
            <Store size={22} color={THEME_ORANGE} />
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Panel proveedor</Text>
              <Text style={styles.menuDesc}>Administra productos y órdenes recibidas</Text>
            </View>
            <ChevronRight size={18} color="#999" />
          </TouchableOpacity>
        )}

        {user.role === 'admin' && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin/user-payments')}>
            <ShieldCheck size={22} color={THEME_ORANGE} />
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Métodos de pago (admin)</Text>
              <Text style={styles.menuDesc}>Consulta de solo lectura para soporte</Text>
            </View>
            <ChevronRight size={18} color="#999" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
          <LogOut size={22} color="#ef4444" />
          <View style={styles.menuTextBox}>
            <Text style={[styles.menuTitle, { color: '#ef4444' }]}>Cerrar sesión</Text>
          </View>
          <ChevronRight size={18} color="#999" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: THEME_ORANGE, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  name: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  email: { fontSize: 14, color: '#666', marginTop: 2 },
  role: { fontSize: 12, color: '#888', marginTop: 4, textTransform: 'capitalize' },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  menuTextBox: { flex: 1, marginLeft: 14 },
  menuTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  menuDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  logoutItem: { marginTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText: { color: '#666', fontSize: 15, marginBottom: 16 },
  btn: { backgroundColor: THEME_ORANGE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  btnText: { color: '#fff', fontWeight: '700' },
});
