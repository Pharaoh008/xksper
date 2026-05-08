export type VariableType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  description?: string;
  source?: string;
  value?: string;
}

export interface WorkflowVariable {
  name: string;
  type: VariableType;
  description?: string;
}

export interface StartNodeData {
  [key: string]: unknown;
  variables: WorkflowVariable[];
}

export interface EndNodeData {
  [key: string]: unknown;
  outputs: Array<{
    name: string;
    ref: string;
  }>;
}

export interface LLMNodeData {
  [key: string]: unknown;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  prompt?: string;
}

export interface PluginNodeData {
  [key: string]: unknown;
  pluginId?: string;
  pluginName?: string;
  config?: Record<string, unknown>;
}

export interface WorkflowNodeData {
  [key: string]: unknown;
  workflowId?: string;
  workflowName?: string;
}

export interface ConditionNodeData {
  [key: string]: unknown;
  condition?: string;
}

export interface LoopNodeData {
  [key: string]: unknown;
  loopVariable?: string;
  loopCollection?: string;
}

export interface BatchNodeData {
  [key: string]: unknown;
  batchSize?: number;
  parallel?: boolean;
}

export interface CodeNodeData {
  [key: string]: unknown;
  language?: 'javascript' | 'python' | 'typescript';
  code?: string;
}

export interface TextProcessNodeData {
  [key: string]: unknown;
  operation?: 'uppercase' | 'lowercase' | 'trim' | 'replace' | 'split' | 'join';
  config?: Record<string, unknown>;
}

export type NodeData = Record<string, unknown> &
  (StartNodeData
  | EndNodeData
  | LLMNodeData
  | PluginNodeData
  | WorkflowNodeData
  | ConditionNodeData
  | LoopNodeData
  | BatchNodeData
  | CodeNodeData
  | TextProcessNodeData);

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: NodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
