import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LucideIcon, Search as SearchIcon, CheckCircle2, Copy } from 'lucide-react';
import { SETTINGS_ITEMS } from '../home/constants';

import { 
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

function CopyCard({ item, index }: { item: { id: string, icon: string, title: string, desc: string, color: string }, index: number }) {
  const [copied, setCopied] = useState(false);
  const Icon = ICON_MAP[item.icon] || Monitor;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${item.title}\n${item.desc}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="acrylic-card p-4 flex gap-5 cursor-pointer group items-start relative"
    >
      <div className={`mt-0.5 ${item.color}`}>
        <Icon className="w-7 h-7 stroke-[1.5]" />
      </div>
      <div className="flex-1 pr-8">
        <h3 className="text-[15px] font-medium text-white group-hover:text-white transition-colors">{item.title}</h3>
        <p className="text-[13px] text-gray-400 mt-0.5 leading-snug">{item.desc}</p>
      </div>
      <button 
        onClick={handleCopy}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        title="Copy to clipboard"
      >
        {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </motion.div>
  );
}

export default function CopyTab() {
  return (
    <motion.div
      key="copy"
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
            placeholder="Search to Copy" 
            className="w-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-colors rounded-sm py-2.5 px-4 pl-4 pr-10 focus:outline-none focus:bg-white/[0.08] focus:border-white/[0.2] text-[15px] placeholder:text-gray-400"
          />
          <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
        {SETTINGS_ITEMS.map((item, index) => (
          <CopyCard key={item.id} item={item} index={index} />
        ))}
      </div>
    </motion.div>
  );
}
