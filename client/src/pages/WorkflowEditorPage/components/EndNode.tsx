import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircle } from 'lucide-react';

interface NodeData extends Record<string, unknown> {
  label: string;
  returnVariables?: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
}

export function EndNode(props: NodeProps<Node<NodeData>>) {
  const { data } = props;
  const nodeData = data as NodeData;
  const returnVariables = nodeData.returnVariables || [];

  return (
    <div className="min-w-[160px] bg-card border-2 border-[#e8efff] rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-[#fef2f2] border-b border-[#e8efff]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#ef4444]">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
          <span className="font-medium text-sm text-foreground">结束</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-foreground mb-1.5">
          {nodeData.label || '结束节点'}
        </div>
        {returnVariables.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">返回变量</div>
            <div className="space-y-0.5">
              {returnVariables.map((variable, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 px-1.5 py-0.5 bg-[#fef2f2] text-[#dc2626] text-xs rounded font-mono"
                >
                  <span>{variable.name}</span>
                  {variable.description && (
                    <span className="text-[#dc2626]/60 truncate max-w-[80px]">
                      {variable.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">无返回变量</div>
        )}
      </div>

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#ef4444] !border-2 !border-white"
      />
    </div>
  );
};
