import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Settings } from 'lucide-react';

interface NodeData extends Record<string, unknown> {
  label: string;
  model?: string;
  modelName?: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  inputVariables?: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
  outputVariable?: string;
  skills?: string[];
}

export function LLMNode(props: NodeProps<Node<NodeData>>) {
  const { data, selected } = props;
  const nodeData = data as NodeData;
  const hasSkills = nodeData.skills && nodeData.skills.length > 0;

  return (
    <div
      className={`min-w-[200px] bg-card border-2 rounded-lg shadow-sm overflow-hidden transition-shadow ${
        selected
          ? 'border-primary shadow-lg'
          : 'border-[#e8efff]'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[#f9fafb] border-b border-[#e8efff]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#1f2937]">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              {nodeData.label || '大模型'}
            </div>
            {nodeData.modelName && (
              <div className="text-xs text-muted-foreground truncate">
                {nodeData.modelName}
              </div>
            )}
          </div>
          {hasSkills && (
            <div className="flex items-center justify-center h-5 w-5 rounded bg-[#f59e0b]/10">
              <Settings className="h-3 w-3 text-[#f59e0b]" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Input Variables */}
        {nodeData.inputVariables && nodeData.inputVariables.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">输入</div>
            <div className="flex flex-wrap gap-1">
              {nodeData.inputVariables.map((variable, index) => (
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

        {/* Prompts Preview */}
        {(nodeData.systemPrompt || nodeData.userPrompt) && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">提示词</div>
            <div className="text-xs text-muted-foreground/70 line-clamp-2 bg-[#f9fafb] rounded px-2 py-1">
              {nodeData.systemPrompt?.slice(0, 50)}
              {nodeData.systemPrompt && nodeData.systemPrompt.length > 50 && '...'}
            </div>
          </div>
        )}

        {/* Output Variable */}
        {nodeData.outputVariable && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">输出</div>
            <div className="flex items-center gap-1">
              <div className="px-1.5 py-0.5 bg-[#dcfce7] text-[#16a34a] text-xs rounded font-mono">
                {nodeData.outputVariable}
              </div>
            </div>
          </div>
        )}

        {/* Temperature */}
        {nodeData.temperature !== undefined && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>温度:</span>
            <span className="font-mono">{nodeData.temperature}</span>
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#1f2937] !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#1f2937] !border-2 !border-white"
      />
    </div>
  );
};
