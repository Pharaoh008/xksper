import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Layers } from 'lucide-react';

interface BatchNodeData extends Record<string, unknown> {
  label: string;
  batchSize?: number;
  concurrency?: number;
  inputVariable?: string;
  outputVariable?: string;
}

export function BatchNode(props: NodeProps<Node<BatchNodeData>>) {
  const { data, selected } = props;
  const nodeData = data as BatchNodeData;

  return (
    <div
      className={`min-w-[180px] bg-card border-2 rounded-lg shadow-sm overflow-hidden transition-shadow ${
        selected ? 'border-primary shadow-lg' : 'border-[#e8efff]'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[#ecfeff] border-b border-[#e8efff]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#06b6d4]">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              {nodeData.label || '批处理'}
            </div>
            {nodeData.batchSize && (
              <div className="text-xs text-muted-foreground truncate">
                每批 {nodeData.batchSize} 个
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Batch Config */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">批次大小</span>
            <span className="font-mono font-medium">
              {nodeData.batchSize ?? 10}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">并发数</span>
            <span className="font-mono font-medium">
              {nodeData.concurrency ?? 5}
            </span>
          </div>
        </div>

        {/* Input Variable */}
        {nodeData.inputVariable && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">输入</div>
            <div className="px-1.5 py-0.5 bg-[#fef3c7] text-[#d97706] text-xs rounded font-mono">
              {nodeData.inputVariable}
            </div>
          </div>
        )}

        {/* Output Variable */}
        {nodeData.outputVariable && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">输出</div>
            <div className="px-1.5 py-0.5 bg-[#dcfce7] text-[#16a34a] text-xs rounded font-mono">
              {nodeData.outputVariable}
            </div>
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#06b6d4] !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#06b6d4] !border-2 !border-white"
      />
    </div>
  );
};
