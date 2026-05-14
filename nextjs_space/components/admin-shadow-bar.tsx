// START ST-900 Logic — Persistent Shadow Mode Admin Bar
'use client';

import { useShadow } from '@/lib/shadow-context';
import { Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AdminShadowBar() {
  const { isActive, shadowUserName, shadowUserEmail, exitShadow } = useShadow();

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] h-10 bg-purple-600 flex items-center justify-center gap-3 text-white text-xs font-mono shadow-lg"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>
            SHADOWING: <strong>{shadowUserName ?? shadowUserEmail}</strong>
          </span>
          <span className="text-purple-200">|</span>
          <span className="text-purple-200 text-[10px]">Read-Only View</span>
          <button
            onClick={exitShadow}
            className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors text-[10px] font-semibold uppercase"
          >
            <X className="w-3 h-3" /> Exit
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
// END ST-900 Logic
