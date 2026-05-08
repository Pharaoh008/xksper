import React from 'react';
import { X } from 'lucide-react';

interface VariableBadgeProps {
  name: string;
  type?: string;
  onClick?: () => void;
  deletable?: boolean;
  onDelete?: () => void;
}

export const VariableBadge: React.FC<VariableBadgeProps> = ({
  name,
  type,
  onClick,
  deletable = false,
  onDelete,
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 bg-[#f3f4f6] text-[#4b5563] text-xs rounded-full font-mono cursor-pointer hover:bg-[#e5e7eb] transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <span className="text-[10px] text-[#9ca3af]">{'{{'}</span>
      <span>{name}</span>
      {type && <span className="text-[10px] text-[#9ca3af]">:{type}</span>}
      <span className="text-[10px] text-[#9ca3af]">{'}}'}</span>
      {deletable && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 hover:text-destructive transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};
