import { RouterProvider } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { router } from "./routes";

function App() {
  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait">
        <RouterProvider router={router} />
      </AnimatePresence>
    </ErrorBoundary>
  );
}

export default App;
