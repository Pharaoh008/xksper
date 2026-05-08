import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Type } from 'lucide-react';

interface NodeData extends Record<string, unknown> {
  label: string;
  operation?: string;
  inputVariable?: string;
  outputVariable?: string;
  config?: {
    pattern?: string;
    replacement?: string;
    caseSensitive?: boolean;
    trimWhitespace?: boolean;
  };
}

const TEXT_COLOR = '#ec4899';

const OPERATION_LABELS: Record<string, string> = {
  replace: '文本替换',
  trim: '去除空格',
  uppercase: '转大写',
  lowercase: '转小写',
  split: '分割文本',
  join: '合并文本',
  regex: '正则匹配',
  substring: '截取文本',
};

export function TextProcessNode(props: NodeProps<Node<NodeData>>) {
  const { data, selected } = props;
  const nodeData = data as NodeData;

  return (
    <div
      className={`min-w-[180px] bg-card border-2 rounded-lg shadow-sm overflow-hidden transition-shadow ${
        selected ? 'border-primary shadow-lg' : 'border-[#e8efff]'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[#fdf2f8] border-b border-[#e8efff]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#ec4899]">
            <Type className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              {nodeData.label || '文本处理'}
            </div>
            {nodeData.operation && (
              <div className="text-xs text-muted-foreground truncate">
                {OPERATION_LABELS[nodeData.operation] || nodeData.operation}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Input Variable */}
        {nodeData.inputVariable && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">输入</div>
            <div className="px-1.5 py-0.5 bg-[#fef3c7] text-[#d97706] text-xs rounded font-mono truncate">
              {nodeData.inputVariable}
            </div>
          </div>
        )}

        {/* Output Variable */}
        {nodeData.outputVariable && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">输出</div>
            <div className="px-1.5 py-0.5 bg-[#dcfce7] text-[#16a34a] text-xs rounded font-mono truncate">
              {nodeData.outputVariable}
            </div>
          </div>
        )}

        {/* Config Preview */}
        {nodeData.config && (nodeData.config.pattern || nodeData.config.replacement) && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">配置</div>
            {nodeData.config.pattern && (
              <div className="text-xs text-muted-foreground/70 bg-[#f9fafb] rounded px-2 py-1 font-mono truncate">
                模式: {nodeData.config.pattern}
              </div>
            )}
            {nodeData.config.replacement && (
              <div className="text-xs text-muted-foreground/70 bg-[#f9fafb] rounded px-2 py-1 font-mono truncate">
                替换: {nodeData.config.replacement}
              </div>
            )}
          </div>
        )}

        {/* Boolean Options */}
        {nodeData.config && (
          <div className="flex flex-wrap gap-2 text-xs">
            {nodeData.config.caseSensitive !== undefined && (
              <span className={`px-1.5 py-0.5 rounded ${
                nodeData.config.caseSensitive
                  ? 'bg-[#dcfce7] text-[#16a34a]'
                  : 'bg-[#f3f4f6] text-[#4b5563]'
              }`}>
                区分大小写
              </span>
            )}
            {nodeData.config.trimWhitespace !== undefined && (
              <span className={`px-1.5 py-0.5 rounded ${
                nodeData.config.trimWhitespace
                  ? 'bg-[#dcfce7] text-[#16a34a]'
                  : 'bg-[#f3f4f6] text-[#4b5563]'
              }`}>
                去除空格
              </span>
            )}
          </div>
        )}

        {!nodeData.inputVariable && !nodeData.outputVariable && !nodeData.config && (
          <div className="text-xs text-muted-foreground">未配置参数</div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#ec4899] !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#ec4899] !border-2 !border-white"
      />
    </div>
  );
};
