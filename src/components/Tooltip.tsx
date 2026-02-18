'use client';
import { useState, ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

export function Tooltip({ text, children }: { text: string; children?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children || <HelpCircle className="w-3.5 h-3.5 text-gray-500 cursor-help" />}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded-lg shadow-xl whitespace-normal w-64 text-center">
          {text}
        </span>
      )}
    </span>
  );
}
