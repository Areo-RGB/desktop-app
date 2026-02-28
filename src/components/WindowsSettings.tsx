import React, { useState } from 'react';
import { 
  Youtube, 
  Server, 
  FileText, 
  Copy, 
  Cloud,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';

import { StatusItem } from './ui/StatusItem';
import HomeTab from './tabs/home';
import YoutubeTab from './tabs/youtube';
import McpTab from './tabs/mcp';
import PdfTab from './tabs/pdf';
import CopyTab from './tabs/copy';
import CloudTab from './tabs/cloud';

type ViewType = 'home' | 'youtube' | 'mcp' | 'pdf' | 'copy' | 'cloud';

export default function WindowsSettings() {
  const [activeView, setActiveView] = useState<ViewType>('home');

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header - Solid Black */}
      <div className="bg-black px-6 md:px-12 py-8 z-10 relative">
        <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex items-center gap-6">
            <div 
              className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setActiveView('home')}
            >
              <img 
                src="https://picsum.photos/seed/building/200" 
                alt="Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="flex gap-8 md:gap-12 mr-4 md:mr-12">
            <StatusItem 
              icon={Youtube} 
              label="YouTube" 
              status="Connected" 
              isActive={activeView === 'youtube'}
              onClick={() => setActiveView('youtube')}
            />
            <StatusItem 
              icon={Server} 
              label="MCP" 
              status="Up-to-date" 
              isActive={activeView === 'mcp'}
              onClick={() => setActiveView('mcp')}
            />
            <StatusItem 
              icon={FileText} 
              label="PDF" 
              status="Ready" 
              isActive={activeView === 'pdf'}
              onClick={() => setActiveView('pdf')}
            />
            <StatusItem 
              icon={Copy} 
              label="Copy" 
              status="Active" 
              isActive={activeView === 'copy'}
              onClick={() => setActiveView('copy')}
            />
            <StatusItem 
              icon={Cloud} 
              label="Cloud" 
              status="Synced" 
              isActive={activeView === 'cloud'}
              onClick={() => setActiveView('cloud')}
            />
          </div>
        </header>
      </div>

      {/* Main Content - Gradient Background */}
      <div className="flex-1 relative overflow-hidden">
        {/* The gradient background matching the image */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{ 
            background: 'radial-gradient(circle at 50% -20%, #4a1c40 0%, #1a0b16 50%, #000000 90%)',
            opacity: 0.9
          }} 
        />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-8 pb-12">
          <AnimatePresence mode="wait">
            {activeView === 'home' && <HomeTab key="home" />}
            {activeView === 'youtube' && <YoutubeTab key="youtube" onBack={() => setActiveView('home')} />}
            {activeView === 'mcp' && <McpTab key="mcp" onBack={() => setActiveView('home')} />}
            {activeView === 'pdf' && <PdfTab key="pdf" onBack={() => setActiveView('home')} />}
            {activeView === 'copy' && <CopyTab key="copy" />}
            {activeView === 'cloud' && <CloudTab key="cloud" onBack={() => setActiveView('home')} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
