import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

interface NodeData extends Record<string, unknown> {
  label: string;
  outputVariables?: Array<{
    name: string;
    type: string;
  }>;
}

export function StartNode(props: NodeProps<Node<NodeData>>) {
  const { data } = props;
  const nodeData = data as NodeData;
  const outputVariables = nodeData.outputVariables || [];

  return (
    <div className="min-w-[160px] bg-card border-2 border-[#e8efff] rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-[#f0f4ff] border-b border-[#e8efff]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#3b82f6]">
            <Play className="h-4 w-4 text-white" />
          </div>
          <span className="font-medium text-sm text-foreground">开始</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-foreground mb-1.5">
          {nodeData.label || '开始节点'}
        </div>
        {outputVariables.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">输出变量</div>
            <div className="flex flex-wrap gap-1">
              {outputVariables.map((variable, index) => (
                <div
                  key={index}
                  className="px-1.5 py-0.5 bg-[#e0e7ff] text-[#4338ca] text-xs rounded font-mono"
                >
                  {variable.name}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">无输出变量</div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#3b82f6] !border-2 !border-white"
      />
    </div>
  );
};
