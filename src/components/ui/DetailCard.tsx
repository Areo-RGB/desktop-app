import React from 'react';

export function DetailCard({ title, icon: Icon, children }: { title: string, icon: React.ComponentType<{ className?: string }>, children: React.ReactNode }) {
  return (
    <div className="acrylic-card p-6 space-y-4">
      <div className="flex items-center gap-3 border-bottom border-white/5 pb-3 mb-4">
        <Icon className="w-5 h-5 text-gray-400" />
        <h3 className="text-sm font-medium uppercase tracking-wider text-gray-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}
