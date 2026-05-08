import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Code } from 'lucide-react';

interface CodeNodeData extends Record<string, unknown> {
  label: string;
  language?: string;
  code?: string;
  inputVariables?: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
  outputVariable?: string;
}

const CODE_COLOR = '#10b981';

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
  sql: 'SQL',
};

export function CodeNode(props: NodeProps<Node<CodeNodeData>>) {
  const { data, selected } = props;
  const nodeData = data as CodeNodeData;
  const inputVariables = nodeData.inputVariables || [];

  return (
    <div
      className={`min-w-[180px] bg-card border-2 rounded-lg shadow-sm overflow-hidden transition-shadow ${
        selected ? 'border-primary shadow-lg' : 'border-[#e8efff]'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[#ecfdf5] border-b border-[#e8efff]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#10b981]">
            <Code className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              {nodeData.label || '代码'}
            </div>
            {nodeData.language && (
              <div className="text-xs text-muted-foreground truncate">
                {LANGUAGE_LABELS[nodeData.language] || nodeData.language}
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

        {/* Code Preview */}
        {nodeData.code && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">代码预览</div>
            <div className="text-xs text-muted-foreground/70 bg-[#f9fafb] rounded px-2 py-1 font-mono line-clamp-2">
              {nodeData.code.slice(0, 60)}
              {nodeData.code.length > 60 && '...'}
            </div>
          </div>
        )}

        {inputVariables.length === 0 && !nodeData.outputVariable && !nodeData.code && (
          <div className="text-xs text-muted-foreground">未配置代码</div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#10b981] !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#10b981] !border-2 !border-white"
      />
    </div>
  );
};
