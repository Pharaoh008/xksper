import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Repeat } from 'lucide-react';

interface LoopNodeData extends Record<string, unknown> {
  label: string;
  loopType?: 'forEach' | 'while' | 'times';
  maxIterations?: number;
  condition?: string;
  inputVariable?: string;
  outputVariable?: string;
}

const LOOP_COLOR = '#ef4444';

const LOOP_TYPE_LABELS: Record<string, string> = {
  forEach: '遍历',
  while: '条件循环',
  times: '固定次数',
};

export function LoopNode(props: NodeProps<Node<LoopNodeData>>) {
  const { data, selected } = props;
  const nodeData = data as LoopNodeData;

  const getLoopInfo = () => {
    switch (nodeData.loopType) {
      case 'forEach':
        return nodeData.inputVariable
          ? `遍历: ${nodeData.inputVariable}`
          : '遍历项目';
      case 'while':
        return nodeData.condition || '满足条件时循环';
      case 'times':
        return `循环 ${nodeData.maxIterations || 10} 次`;
      default:
        return '循环';
    }
  };

  return (
    <div
      className={`min-w-[180px] bg-card border-2 rounded-lg shadow-sm overflow-hidden transition-shadow ${
        selected ? 'border-primary shadow-lg' : 'border-[#e8efff]'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[#fef2f2] border-b border-[#e8efff]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#ef4444]">
            <Repeat className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              {nodeData.label || '循环'}
            </div>
            {nodeData.loopType && (
              <div className="text-xs text-muted-foreground truncate">
                {LOOP_TYPE_LABELS[nodeData.loopType]}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Loop Info */}
        <div className="text-xs text-muted-foreground/70 bg-[#fef2f2] rounded px-2 py-1">
          {getLoopInfo()}
        </div>

        {/* Max Iterations */}
        {nodeData.maxIterations !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">最大迭代</span>
            <span className="font-mono font-medium">{nodeData.maxIterations}</span>
          </div>
        )}

        {/* Output Variable */}
        {nodeData.outputVariable && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">迭代输出</div>
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
        className="!w-3 !h-3 !bg-[#ef4444] !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#ef4444] !border-2 !border-white"
      />
    </div>
  );
};
