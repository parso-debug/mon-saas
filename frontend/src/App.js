import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Onboarding from "@/pages/Onboarding";
import Generating from "@/pages/Generating";
import Builder from "@/pages/Builder";
import PublicSite from "@/pages/PublicSite";
import Billing from "@/pages/Billing";
import BillingSuccess from "@/pages/BillingSuccess";
import BillingCancel from "@/pages/BillingCancel";
import Admin from "@/pages/Admin";
import Avis from "@/pages/Avis";
import ShopBuilder from "@/pages/ShopBuilder";
import OnboardingShop from "@/pages/OnboardingShop";
import PublicShop from "@/pages/PublicShop";
import PublicProduct from "@/pages/PublicProduct";
import ShopCheckout from "@/pages/ShopCheckout";
import ShopSuccess from "@/pages/ShopSuccess";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/avis" element={<Avis />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
          <Route path="/generating" element={<Protected><Generating /></Protected>} />
          <Route path="/builder/:siteId" element={<Protected><Builder /></Protected>} />
          <Route path="/billing" element={<Protected><Billing /></Protected>} />
          <Route path="/billing/success" element={<Protected><BillingSuccess /></Protected>} />
          <Route path="/billing/cancel" element={<Protected><BillingCancel /></Protected>} />
          <Route path="/admin" element={<Protected><Admin /></Protected>} />
          <Route path="/shop-builder/:shopId" element={<Protected><ShopBuilder /></Protected>} />
          <Route path="/onboarding-shop" element={<Protected><OnboardingShop /></Protected>} />
          <Route path="/shop/:slug" element={<PublicShop />} />
          <Route path="/shop/:slug/product/:productSlug" element={<PublicProduct />} />
          <Route path="/shop/:slug/checkout" element={<ShopCheckout />} />
          <Route path="/shop/:slug/success" element={<ShopSuccess />} />
          <Route path="/site/:slug" element={<PublicSite />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
