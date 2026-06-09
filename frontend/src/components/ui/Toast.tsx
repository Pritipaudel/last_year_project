import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  const iconMap = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  };

  const bgColorMap = {
    success: "bg-green-50 border-green-200",
    error: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
    warning: "bg-yellow-50 border-yellow-200",
  };

  const textColorMap = {
    success: "text-green-800",
    error: "text-red-800",
    info: "text-blue-800",
    warning: "text-yellow-800",
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, x: 100 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 100 }}
            transition={{ duration: 0.3 }}
            className={`${bgColorMap[toast.type]} border rounded-lg shadow-lg p-4 max-w-sm pointer-events-auto`}
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {iconMap[toast.type]}
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold ${textColorMap[toast.type]}`}>
                  {toast.title}
                </h3>
                {toast.description && (
                  <p className={`text-sm mt-1 ${textColorMap[toast.type]} opacity-90`}>
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className={`flex-shrink-0 ${textColorMap[toast.type]} hover:opacity-70 transition-opacity`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
