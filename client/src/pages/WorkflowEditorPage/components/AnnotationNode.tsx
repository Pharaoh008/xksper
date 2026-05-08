import React, { useState } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { StickyNote } from 'lucide-react';

interface AnnotationData extends Record<string, unknown> {
  content: string;
  onContentChange?: (content: string) => void;
}

export function AnnotationNode(props: NodeProps<Node<AnnotationData>>) {
  const { data, selected } = props;
  const [isEditing, setIsEditing] = useState(false);
  const nodeData = data as AnnotationData;
  const content = nodeData.content || '添加注释...';

  return (
    <div
      className={`min-w-[180px] max-w-[300px] bg-[#fef9c3] border-2 rounded-lg shadow-sm overflow-hidden transition-shadow ${
        selected
          ? 'border-[#eab308] shadow-md'
          : 'border-[#fef08a]'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[#fef08a]/50 border-b border-[#fef08a]">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-[#ca8a04]" />
          <span className="text-sm font-medium text-[#854d0e]">注释</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {isEditing ? (
          <textarea
            className="w-full min-h-[60px] bg-transparent border-0 resize-none text-sm text-[#713f12] placeholder:text-[#a16207]/50 focus:outline-none focus:ring-0"
            value={content}
              onChange={(e) => nodeData.onContentChange?.(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditing(false);
              }
            }}
            placeholder="添加注释..."
            autoFocus
          />
        ) : (
          <div
            className="min-h-[40px] text-sm text-[#713f12] cursor-text"
            onClick={() => setIsEditing(true)}
          >
            {content}
          </div>
        )}
      </div>

      {/* Decorative corner fold */}
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[20px] border-t-[#fef08a] border-l-[20px] border-l-transparent" />
    </div>
  );
};
