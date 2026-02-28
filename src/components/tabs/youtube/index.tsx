import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, Settings as SettingsIcon, CheckCircle2 } from 'lucide-react';
import { TabContent } from '@/components/ui/TabContent';
import { SubTabs } from '@/components/ui/SubTabs';
import { DetailCard } from '@/components/ui/DetailCard';

export default function YoutubeTab({ onBack }: { onBack: () => void }) {
  const [activeYoutubeTab, setActiveYoutubeTab] = useState('Download');

  return (
    <TabContent 
      title="YouTube" 
      onBack={onBack}
      icon={Youtube}
    >
      <SubTabs 
        tabs={['Download', 'Fetch', 'Upload', 'Edit', 'Settings']} 
        activeTab={activeYoutubeTab} 
        onChange={setActiveYoutubeTab} 
        layoutIdPrefix="yt"
      />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeYoutubeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeYoutubeTab === 'Settings' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailCard title="Linked Accounts" icon={Youtube}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-sm">
                    <div className="flex items-center gap-3">
                      <Youtube className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">Premium Account</p>
                        <p className="text-xs text-gray-500">Last synced: 2 mins ago</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Active</span>
                  </div>
                  <button className="w-full py-2 border border-white/10 text-xs hover:bg-white/5 transition-colors">Add an account</button>
                </div>
              </DetailCard>
              <DetailCard title="Features" icon={SettingsIcon}>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-red-500" /> Background play</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-red-500" /> Ad-free experience</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-red-500" /> Offline downloads</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-red-500" /> YouTube Music Premium</li>
                </ul>
              </DetailCard>
            </div>
          ) : (
            <div className="acrylic-card p-8 text-center text-gray-400">
              <p>{activeYoutubeTab} functionality coming soon.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </TabContent>
  );
}
