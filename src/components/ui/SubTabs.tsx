import React from 'react';
import { motion } from 'motion/react';

export function SubTabs({ tabs, activeTab, onChange, layoutIdPrefix }: { tabs: string[], activeTab: string, onChange: (tab: string) => void, layoutIdPrefix: string }) {
  return (
    <div className="flex gap-6 border-b border-white/10 mb-8 overflow-x-auto hide-scrollbar">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`pb-3 text-[14px] font-medium transition-colors relative whitespace-nowrap ${activeTab === tab ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
        >
          {tab}
          {activeTab === tab && (
            <motion.div 
              layoutId={`activeSubTab-${layoutIdPrefix}`}
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
            />
          )}
        </button>
      ))}
    </div>
  );
}
