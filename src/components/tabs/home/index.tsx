import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search as SearchIcon } from 'lucide-react';
import { SETTINGS_ITEMS } from './constants';

import { 
  LucideIcon,
  Monitor, 
  Speaker, 
  Smartphone, 
  Globe, 
  Palette, 
  LayoutGrid, 
  User, 
  Languages, 
  Gamepad2, 
  Accessibility, 
  Search, 
  Circle, 
  Lock, 
  RefreshCw 
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Monitor, 
  Speaker, 
  Smartphone, 
  Globe, 
  Palette, 
  LayoutGrid, 
  User, 
  Languages, 
  Gamepad2, 
  Accessibility, 
  Search, 
  Circle, 
  Lock, 
  RefreshCw
};

export function ToggleCard({ item, index }: { item: { id: string, icon: string | React.ComponentType<{ className?: string }>, title: string, desc: string, color: string }, index: number }) {
  const [isOn, setIsOn] = useState(false);
  const Icon = typeof item.icon === 'string' ? (ICON_MAP[item.icon] || Monitor) : item.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="acrylic-card p-4 flex gap-5 cursor-pointer group items-start relative"
      onClick={() => setIsOn(!isOn)}
    >
      <div className={`mt-0.5 ${item.color}`}>
        <Icon className="w-7 h-7 stroke-[1.5]" />
      </div>
      <div className="flex-1 pr-12">
        <h3 className="text-[15px] font-medium text-white group-hover:text-white transition-colors">{item.title}</h3>
        <p className="text-[13px] text-gray-400 mt-0.5 leading-snug">{item.desc}</p>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <div className={`w-10 h-5 rounded-full p-1 transition-colors ${isOn ? 'bg-blue-500' : 'bg-gray-600'}`}>
          <motion.div 
            className="w-3 h-3 bg-white rounded-full shadow-sm"
            animate={{ x: isOn ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function HomeTab() {
  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Search Bar */}
      <div className="flex justify-center mb-16">
        <div className="relative w-full max-w-2xl">
          <input 
            type="text" 
            placeholder="Search in Settings" 
            className="w-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-colors rounded-sm py-2.5 px-4 pl-4 pr-10 focus:outline-none focus:bg-white/[0.08] focus:border-white/[0.2] text-[15px] placeholder:text-gray-400"
          />
          <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
        {SETTINGS_ITEMS.map((item, index) => (
          <ToggleCard key={item.id} item={item} index={index} />
        ))}
      </div>
    </motion.div>
  );
}
