import React from 'react';
import { Stack, Redirect } from 'expo-router';
import AuthGuard from '../../src/components/AuthGuard';
import { useAuth } from '../../src/contexts/AuthContext';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }
  return <>{children}</>;
}

export default function AdminLayout() {
  return (
    <AuthGuard>
      <RequireAdmin>
        <Stack screenOptions={{ headerShown: false }} />
      </RequireAdmin>
    </AuthGuard>
  );
}
