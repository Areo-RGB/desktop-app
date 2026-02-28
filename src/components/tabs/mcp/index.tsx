import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LucideIcon, Server, CheckCircle2, XCircle, Settings as SettingsIcon, HardDrive } from 'lucide-react';
import { TabContent } from '@/components/ui/TabContent';

function ActionCard({ icon: Icon, title, desc }: { icon: LucideIcon, title: string, desc: string }) {
  const [isActive, setIsActive] = useState(false);

  return (
    <div 
      className="acrylic-card p-4 flex flex-col gap-3 cursor-pointer group"
      onClick={() => setIsActive(!isActive)}
    >
      <Icon className={`w-6 h-6 transition-transform group-hover:scale-110 ${isActive ? 'text-red-500' : 'text-blue-400'}`} />
      <div>
        <h4 className="text-sm font-medium">{title}</h4>
        <p className="text-xs text-gray-500 mt-1">{desc}</p>
      </div>
    </div>
  );
}

export default function McpTab({ onBack }: { onBack: () => void }) {
  const [serverRunning, setServerRunning] = useState(true);

  return (
    <TabContent 
      title="MCP Server" 
      onBack={onBack}
      icon={Server}
    >
      <div className="space-y-6">
        <div 
          className="acrylic-card p-6 flex items-center justify-between cursor-pointer"
          onClick={() => setServerRunning(!serverRunning)}
        >
          <div className="flex items-center gap-4">
            <div className={`${serverRunning ? 'bg-green-500/20' : 'bg-red-500/20'} p-3 rounded-full transition-colors`}>
              {serverRunning ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-medium">{serverRunning ? 'Server is running' : 'Server is offline'}</h2>
              <p className="text-sm text-gray-400">{serverRunning ? 'Uptime: 14 days, 2 hours' : 'Server stopped manually'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${serverRunning ? 'bg-blue-500' : 'bg-gray-600'}`}>
              <motion.div 
                className="w-4 h-4 bg-white rounded-full shadow-sm"
                animate={{ x: serverRunning ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
            <button 
              className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-sm text-sm font-medium transition-colors"
              onClick={(e) => { e.stopPropagation(); setServerRunning(true); }}
            >
              Restart Server
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard icon={Server} title="Server Status" desc="View detailed metrics" />
          <ActionCard icon={SettingsIcon} title="Configuration" desc="Manage server settings" />
          <ActionCard icon={HardDrive} title="Storage" desc="Manage server storage" />
        </div>
      </div>
    </TabContent>
  );
}
