import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth-context';
import { LoadingState } from '../components/ui';

export function RequireAuth({
  children,
  requirePlatformStaff,
}: {
  children: ReactNode;
  requirePlatformStaff?: boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState />;

  if (!user) {
    return <Navigate to="/masuk" replace state={{ from: location.pathname }} />;
  }

  // Kewajiban ganti kata sandi ditegakkan sebelum halaman lain dapat dibuka.
  if (user.mustChangePassword) {
    return <Navigate to="/ganti-kata-sandi" replace />;
  }

  if (requirePlatformStaff && !user.isPlatformStaff) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
