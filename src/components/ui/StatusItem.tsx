import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon, CheckCircle2 } from 'lucide-react';

export function StatusItem({ 
  icon: Icon, 
  label, 
  status, 
  isActive, 
  onClick 
}: { 
  icon: LucideIcon, 
  label: string, 
  status: string, 
  isActive: boolean,
  onClick: () => void 
}) {
  return (
    <div 
      className={`flex flex-col items-center gap-1.5 group cursor-pointer relative pb-3 transition-all ${isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
      onClick={onClick}
    >
      <div className="relative mb-1">
        <Icon className={`w-8 h-8 stroke-[1.5] transition-colors ${isActive ? 'text-white' : 'text-white group-hover:text-white'}`} />
        <div className="absolute -bottom-1 -right-1 bg-[#23a127] rounded-full p-[2px] border-2 border-black">
          <CheckCircle2 className="w-2.5 h-2.5 text-white stroke-[3]" />
        </div>
      </div>
      <span className="text-[13px] font-semibold text-white mt-1">{label}</span>
      <span className="text-[11px] text-gray-400 uppercase tracking-wide">{status}</span>
      
      {isActive && (
        <motion.div 
          layoutId="activeTab"
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full"
        />
      )}
    </div>
  );
}
