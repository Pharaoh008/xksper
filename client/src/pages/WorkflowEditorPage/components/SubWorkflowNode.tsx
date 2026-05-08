import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Workflow as WorkflowIcon } from 'lucide-react';

interface NodeData extends Record<string, unknown> {
  label: string;
  workflowName?: string;
  workflowId?: string;
  inputVariables?: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
  outputVariables?: Array<{
    name: string;
    type: string;
  }>;
}

export function SubWorkflowNode(props: NodeProps<Node<NodeData>>) {
  const { data, selected } = props;
  const nodeData = data as NodeData;
  const inputVariables = nodeData.inputVariables || [];
  const outputVariables = nodeData.outputVariables || [];

  return (
    <div
      className={`min-w-[180px] bg-card border-2 rounded-lg shadow-sm overflow-hidden transition-shadow ${
        selected ? 'border-primary shadow-lg' : 'border-[#e8efff]'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[#f0fdf4] border-b border-[#e8efff]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#22c55e]">
            <WorkflowIcon className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              {nodeData.label || '子工作流'}
            </div>
            {nodeData.workflowName && (
              <div className="text-xs text-muted-foreground truncate">
                {nodeData.workflowName}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Input Variables */}
        {inputVariables.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">输入</div>
            <div className="flex flex-wrap gap-1">
              {inputVariables.map((variable, index) => (
                <div
                  key={index}
                  className={`px-1.5 py-0.5 text-xs rounded font-mono ${
                    variable.required
                      ? 'bg-[#fef3c7] text-[#d97706]'
                      : 'bg-[#f3f4f6] text-[#4b5563]'
                  }`}
                >
                  {variable.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Output Variables */}
        {outputVariables.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">输出</div>
            <div className="flex flex-wrap gap-1">
              {outputVariables.map((variable, index) => (
                <div
                  key={index}
                  className="px-1.5 py-0.5 bg-[#dcfce7] text-[#16a34a] text-xs rounded font-mono"
                >
                  {variable.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {inputVariables.length === 0 && outputVariables.length === 0 && (
          <div className="text-xs text-muted-foreground">未配置参数</div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#22c55e] !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#22c55e] !border-2 !border-white"
      />
    </div>
  );
};
