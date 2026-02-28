import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, Loader2, Folder, File as FileIcon } from 'lucide-react';
import { S3Client, ListObjectsV2Command, _Object } from "@aws-sdk/client-s3";
import { TabContent } from '@/components/ui/TabContent';
import { SubTabs } from '@/components/ui/SubTabs';
import { DetailCard } from '@/components/ui/DetailCard';
import { ToggleCard } from '../home';

export function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.01 1.49l-6.12 10.49a1.7 1.7 0 0 0 0 1.73l5.24 9.03a1.7 1.7 0 0 0 1.47.85h10.45a1.7 1.7 0 0 0 1.47-2.55l-5.24-9.03a1.7 1.7 0 0 0-1.47-.85H7.36l4.65-7.97h10.46c.3 0 .58-.08.83-.22L13.48 1.49a1.7 1.7 0 0 0-1.47 0z"/>
    </svg>
  );
}

export function CloudflareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22.868 12.394c-.266-.14-.56-.214-.863-.214h-1.042c-.524-2.812-2.983-4.92-5.913-4.92-1.378 0-2.65.474-3.666 1.266a4.89 4.89 0 0 0-3.522-1.503c-2.43 0-4.444 1.776-4.83 4.108a3.528 3.528 0 0 0-1.782.483 3.543 3.543 0 0 0-1.764 3.064c0 1.95 1.585 3.535 3.535 3.535h16.312c1.95 0 3.535-1.585 3.535-3.535a3.53 3.53 0 0 0-1.042-2.504 3.53 3.53 0 0 0-1.042-.78z"/>
    </svg>
  );
}

export function DigitalOceanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.003 24C5.378 24 0 18.623 0 12h2.203c0 5.405 4.394 9.8 9.8 9.8 5.405 0 9.8-4.395 9.8-9.8s-4.395-9.8-9.8-9.8v-2.2C18.626 0 24 5.377 24 12c0 6.623-5.374 12-11.997 12zM7.16 12H4.957c0-3.886 3.155-7.043 7.043-7.043v2.203c-2.67 0-4.84 2.17-4.84 4.84zm2.203 0H7.16c0-2.67 2.17-4.84 4.84-4.84v2.203c-1.454 0-2.637 1.183-2.637 2.637z"/>
    </svg>
  );
}

const CLOUD_ITEMS: { id: string, icon: React.ComponentType<{ className?: string }>, title: string, desc: string, color: string }[] = [
  { id: 'gdrive', icon: GoogleDriveIcon, title: 'Google Drive', desc: 'Personal & team cloud storage', color: 'text-green-500' },
  { id: 'cloudflare', icon: CloudflareIcon, title: 'Cloudflare R2', desc: 'Zero egress fee object storage', color: 'text-orange-500' },
  { id: 'digitalocean', icon: DigitalOceanIcon, title: 'Digital Ocean', desc: 'Spaces object storage', color: 'text-blue-500' },
];

function DigitalOceanSpaces() {
  const [files, setFiles] = useState<_Object[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFiles() {
      try {
        const accessKeyId = process.env.NEXT_PUBLIC_DO_ACCESS_KEY_ID;
        const secretAccessKey = process.env.NEXT_PUBLIC_DO_SECRET_ACCESS_KEY;
        
        if (!accessKeyId || !secretAccessKey) {
          throw new Error("Missing DigitalOcean credentials in environment variables.");
        }

        const s3Client = new S3Client({
          endpoint: "https://fra1.digitaloceanspaces.com",
          region: "fra1",
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });

        const command = new ListObjectsV2Command({
          Bucket: "data4app",
        });

        const response = await s3Client.send(command);
        setFiles(response.Contents || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    
    fetchFiles();
  }, []);

  return (
    <div className="space-y-6">
      <DetailCard title="data4app Space" icon={DigitalOceanIcon}>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-sm">
            <div>
              <p className="text-sm font-medium">data4app</p>
              <p className="text-xs text-gray-500">fra1.digitaloceanspaces.com</p>
            </div>
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Connected</span>
          </div>
        </div>
      </DetailCard>

      <div className="acrylic-card p-6">
        <h3 className="text-lg font-medium mb-4">Files & Folders</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
            {error}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No files found in this space.
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {files.map((file, i) => {
              const isFolder = file.Key?.endsWith('/');
              const name = file.Key?.split('/').filter(Boolean).pop() || file.Key || 'Unknown';
              const size = isFolder ? '--' : ((file.Size || 0) / 1024).toFixed(2) + ' KB';
              const date = file.LastModified ? new Date(file.LastModified).toLocaleDateString() : 'Unknown';

              return (
                <div key={i} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-md transition-colors group cursor-pointer">
                  <div className="flex items-center gap-3">
                    {isFolder ? (
                      <Folder className="w-5 h-5 text-blue-400" />
                    ) : (
                      <FileIcon className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-sm font-medium group-hover:text-blue-400 transition-colors">{name}</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-gray-500">
                    <span>{date}</span>
                    <span className="w-16 text-right">{size}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CloudTab({ onBack }: { onBack: () => void }) {
  const [activeCloudTab, setActiveCloudTab] = useState('Google Drive');

  return (
    <TabContent 
      title="Cloud Storage" 
      onBack={onBack}
      icon={Cloud}
    >
      <SubTabs 
        tabs={['Google Drive', 'Cloudflare R2', 'DigitalOcean Spaces', 'Settings']} 
        activeTab={activeCloudTab} 
        onChange={setActiveCloudTab} 
        layoutIdPrefix="cloud"
      />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCloudTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeCloudTab === 'Google Drive' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailCard title="Storage Overview" icon={GoogleDriveIcon}>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Used: 45 GB</span>
                    <span className="text-gray-400">Total: 100 GB</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[45%]" />
                  </div>
                  <button className="w-full py-2 border border-white/10 text-xs hover:bg-white/5 transition-colors mt-4">Manage Storage</button>
                </div>
              </DetailCard>
            </div>
          )}
          {activeCloudTab === 'Cloudflare R2' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailCard title="Bucket Status" icon={CloudflareIcon}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-sm">
                    <div>
                      <p className="text-sm font-medium">production-assets</p>
                      <p className="text-xs text-gray-500">us-east-1</p>
                    </div>
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Active</span>
                  </div>
                </div>
              </DetailCard>
            </div>
          )}
          {activeCloudTab === 'DigitalOcean Spaces' && (
            <DigitalOceanSpaces />
          )}
          {activeCloudTab === 'Settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {CLOUD_ITEMS.map((item, index) => (
                <ToggleCard key={item.id} item={item} index={index} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </TabContent>
  );
}
