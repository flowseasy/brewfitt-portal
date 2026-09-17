"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

/** Page transition: a short fade and lift, skipped when the user prefers reduced motion. */
export default function PortalTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
