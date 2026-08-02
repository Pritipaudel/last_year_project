import { RouterProvider } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { ToastContainer } from "./components/ui/Toast";
import { router } from "./routes";
import { useAuthStore } from "./store/authStore";
import { useEffect } from "react";

function App() {
  console.log("App component rendering...");

  // Force incomplete setups to login screen upon app reload
  useEffect(() => {
    const auth = useAuthStore.getState();
    if (auth.isAuthenticated && auth.user && auth.user.onboardingComplete === false) {
      auth.logout();
    }
  }, []);

  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait">
        <RouterProvider router={router} />
      </AnimatePresence>
      <ToastContainer />
    </ErrorBoundary>
  );
}


export default App;
