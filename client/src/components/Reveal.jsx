import { motion } from "framer-motion";

export default function Reveal({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.38, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
