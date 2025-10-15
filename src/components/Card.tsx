import React from 'react';
import { Event } from '../lib/supabase';
import { Button } from './Form';
import { Plus } from 'lucide-react';

export const CardWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-900 rounded-xl border border-zinc-800/50 shadow-xl 
    backdrop-blur-sm p-6 relative overflow-hidden group transition-all duration-300 hover:border-red-500/30">
    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-black opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative z-10">{children}</div>
  </div>
);

interface EmptyStateProps {
  onCreateNew: () => void;
  message: string;
  description: string;
}

export const EmptyState = ({ onCreateNew, message, description }: EmptyStateProps) => (
  <CardWrapper>
    <div className="py-12 text-center">
      <svg className="mx-auto h-12 w-12 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15M9 11l3 3m0 0l3-3m-3 3V8" />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-zinc-400">{message}</h3>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
      <div className="mt-6">
        <Button variant="primary" onClick={onCreateNew}>
          <Plus className="w-4 h-4" />
          Create New
        </Button>
      </div>
    </div>
  </CardWrapper>
);

interface EventCardProps {
  event: Event;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

export const EventCard = ({ event, selected, onSelect, onDelete, onToggleActive }: EventCardProps) => (
  <CardWrapper>
    <div
      className={`group relative cursor-pointer ${
        selected ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-black' : ''
      }`}
      onClick={() => onSelect(event.id)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white truncate">{event.name}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              event.is_active 
                ? 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20' 
                : 'bg-zinc-500/10 text-zinc-400 ring-1 ring-inset ring-zinc-500/20'
            }`}>
              {event.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{event.description}</p>
          
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Max Team: {event.max_team_size}</span>
            </div>
            {event.registration_deadline && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>
                  Due: {new Date(event.registration_deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive(event.id, !event.is_active);
            }}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(event.id);
            }}
            className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </CardWrapper>
);