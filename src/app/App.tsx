import { RouterProvider } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { router } from './routes';
import { AppProvider } from './i18n/app-context';
import { FontScaleProvider } from './context/font-scale-context';
import { AuthProvider, useAuth } from './auth/auth-context';
import { NavDateRangeProvider } from './context/nav-date-range-context';
import { LoginScreen } from './auth/LoginScreen';
import { Toaster } from './components/ui/sonner';

function AppShell() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginScreen />;
  return (
    <NavDateRangeProvider>
      <RouterProvider router={router} />
    </NavDateRangeProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AppProvider>
        <FontScaleProvider>
          <AuthProvider>
            <AppShell />
            <Toaster />
          </AuthProvider>
        </FontScaleProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
