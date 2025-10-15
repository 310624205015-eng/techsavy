
export interface LoadingOverlayProps {
  message?: string;
  isLoading: boolean;
  fullscreen?: boolean;
}

import React from 'react';

export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  fullscreen?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = 'Submitting registration...', isLoading, fullscreen = true }) => {
  if (!isLoading) return null;

  const containerClasses = fullscreen
    ? "fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
    : "absolute inset-0 bg-black/40 z-10";

  const contentClasses = fullscreen
    ? "bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-xl"
    : "";

  return (
    <div className={`${containerClasses} flex items-center justify-center transition-opacity duration-300`}>
      <div className={`${contentClasses} flex flex-col items-center`}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-medium">{message}</p>
        </div>
        
        <div className="flex space-x-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '200ms' }} />
          <div className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
    </div>
  );
}