import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import TodayPage from "./pages/TodayPage.tsx";
import BookingsPage from "./pages/BookingsPage.tsx";
import ClientsPage from "./pages/ClientsPage.tsx";
import ClientProfilePage from "./pages/ClientProfilePage.tsx";
import FleetPage from "./pages/FleetPage.tsx";
import FleetFormPage from "./pages/FleetFormPage.tsx";
import MoneyPage from "./pages/MoneyPage.tsx";
import InsightsPage from "./pages/InsightsPage.tsx";
import BookingFormPage from "./pages/BookingFormPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<TodayPage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:id" element={<ClientProfilePage />} />
                <Route path="/fleet" element={<FleetPage />} />
                <Route path="/money" element={<MoneyPage />} />
                <Route path="/insights" element={<InsightsPage />} />
              </Route>
              <Route path="/fleet/new" element={<FleetFormPage />} />
              <Route path="/booking/new" element={<BookingFormPage />} />
              <Route path="/booking/:id" element={<BookingFormPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
