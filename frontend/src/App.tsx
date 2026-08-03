import { RouterProvider } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { ToastContainer } from "./components/ui/Toast";
import { router } from "./routes";

function App() {
  console.log("App component rendering...");

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
