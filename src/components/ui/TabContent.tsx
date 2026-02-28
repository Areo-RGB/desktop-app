import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon, ChevronLeft } from 'lucide-react';

export function TabContent({ title, onBack, children, icon: Icon }: { title: string, onBack: () => void, children: React.ReactNode, icon: LucideIcon }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3">
          <Icon className="w-8 h-8 text-blue-400" />
          <h2 className="text-3xl font-light">{title}</h2>
        </div>
      </div>
      <div className="mt-8">
        {children}
      </div>
    </motion.div>
  );
}
