import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

interface NodeData extends Record<string, unknown> {
  label: string;
  logic?: 'and' | 'or';
  conditions?: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
}

const CONDITION_COLOR = '#f59e0b';

const LOGIC_LABELS: Record<string, string> = {
  and: 'AND (全部满足)',
  or: 'OR (任一满足)',
};

export function ConditionNode(props: NodeProps<Node<NodeData>>) {
  const { data, selected } = props;
  const nodeData = data as NodeData;
  const conditions = nodeData.conditions || [];
  const branches = conditions.length > 0 ? conditions.length + 1 : 2;

  return (
    <div
      className={`min-w-[200px] bg-card border-2 rounded-lg shadow-sm overflow-hidden transition-shadow ${
        selected ? 'border-primary shadow-lg' : 'border-[#e8efff]'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[#fffbeb] border-b border-[#e8efff]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#f59e0b]">
            <GitBranch className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              {nodeData.label || '条件选择'}
            </div>
            {nodeData.logic && (
              <div className="text-xs text-muted-foreground truncate">
                {LOGIC_LABELS[nodeData.logic] || nodeData.logic}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Conditions Preview */}
        {conditions.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">条件</div>
            <div className="space-y-1">
              {conditions.slice(0, 3).map((condition, index) => (
                <div
                  key={index}
                  className="text-xs text-muted-foreground/70 bg-[#f9fafb] rounded px-2 py-1 font-mono truncate"
                >
                  {condition.field} {condition.operator} {condition.value}
                </div>
              ))}
              {conditions.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{conditions.length - 3} 更多条件
                </div>
              )}
            </div>
          </div>
        )}

        {/* Branches */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">分支</span>
          <span className="font-medium">{branches}</span>
        </div>

        {conditions.length === 0 && (
          <div className="text-xs text-muted-foreground">未配置条件</div>
        )}
      </div>

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#f59e0b] !border-2 !border-white"
      />

      {/* Output Handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '40%' }}
        className="!w-3 !h-3 !bg-[#22c55e] !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '60%' }}
        className="!w-3 !h-3 !bg-[#ef4444] !border-2 !border-white"
      />
    </div>
  );
};
