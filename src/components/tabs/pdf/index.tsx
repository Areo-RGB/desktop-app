import React from 'react';
import { LucideIcon, FileText, Settings as SettingsIcon, HardDrive, Lock, Palette } from 'lucide-react';
import { TabContent } from '@/components/ui/TabContent';

function SecurityItem({ icon: Icon, title, status }: { icon: LucideIcon, title: string, status: string }) {
  return (
    <div className="acrylic-card p-5 flex flex-col gap-4 group cursor-pointer">
      <div className="flex justify-between items-start">
        <Icon className="w-8 h-8 text-blue-400" />
        <div className="bg-green-500 w-2 h-2 rounded-full" />
      </div>
      <div>
        <h4 className="text-sm font-medium group-hover:text-blue-400 transition-colors">{title}</h4>
        <p className="text-xs text-gray-400 mt-1">{status}</p>
      </div>
    </div>
  );
}

export default function PdfTab({ onBack }: { onBack: () => void }) {
  return (
    <TabContent 
      title="PDF Settings" 
      onBack={onBack}
      icon={FileText}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SecurityItem icon={FileText} title="Default PDF Reader" status="Microsoft Edge" />
        <SecurityItem icon={SettingsIcon} title="PDF Conversion" status="Enabled" />
        <SecurityItem icon={HardDrive} title="Storage Location" status="C:\Users\Documents\PDFs" />
        <SecurityItem icon={Lock} title="PDF Security" status="Manage passwords and permissions" />
        <SecurityItem icon={Palette} title="Annotation Tools" status="Highlight, draw, and comment" />
      </div>
    </TabContent>
  );
}
