import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from '@/context/AppContext';
import AppShell from '@/components/AppShell';
import LoginPage from '@/pages/LoginPage';
import RegistroPage from '@/pages/RegistroPage';

const GraficosPage = lazy(() => import('@/pages/GraficosPage'));
const ComparativaPage = lazy(() => import('@/pages/ComparativaPage'));
const AlertasPage = lazy(() => import('@/pages/AlertasPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));

function PageLoader() {
  return (
    <div className="py-20 flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children, sysadminOnly = false }) {
  const { currentUser } = useApp();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (sysadminOnly && currentUser.rol !== 'sysadmin') {
    return <Navigate to="/registro" replace />;
  }
  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </AppShell>
  );
}

function PublicLoginRoute() {
  const { currentUser } = useApp();
  if (currentUser) {
    return <Navigate to="/registro" replace />;
  }
  return <LoginPage />;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicLoginRoute />} />
          <Route
            path="/registro"
            element={
              <ProtectedRoute>
                <RegistroPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/graficos"
            element={
              <ProtectedRoute>
                <GraficosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/comparativa"
            element={
              <ProtectedRoute sysadminOnly>
                <ComparativaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alertas"
            element={
              <ProtectedRoute>
                <AlertasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute sysadminOnly>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/registro" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
