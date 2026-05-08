export const NodeType = {
  START: 'start',
  END: 'end',
  LLM: 'llm',
  PLUGIN: 'plugin',
  WORKFLOW: 'workflow',
  CONDITION: 'condition',
  LOOP: 'loop',
  BATCH: 'batch',
  CODE: 'code',
  TEXT_PROCESS: 'textProcess',
} as const;

export type NodeTypeValue = typeof NodeType[keyof typeof NodeType];

export interface NodeTypeConfig {
  label: string;
  color: string;
  description: string;
  icon: string;
  category: 'basic' | 'ai' | 'control' | 'integration' | 'advanced';
}

export const NODE_CONFIG: Record<NodeTypeValue, NodeTypeConfig> = {
  [NodeType.START]: {
    label: '开始',
    color: 'hsl(142 76% 36%)',
    description: '工作流入口，定义输入变量',
    icon: 'Play',
    category: 'basic',
  },
  [NodeType.END]: {
    label: '结束',
    color: 'hsl(0 84% 60%)',
    description: '工作流出口，定义输出变量',
    icon: 'Square',
    category: 'basic',
  },
  [NodeType.LLM]: {
    label: '大模型',
    color: 'hsl(215 85% 38%)',
    description: '调用AI大模型进行推理',
    icon: 'Brain',
    category: 'ai',
  },
  [NodeType.PLUGIN]: {
    label: '插件',
    color: 'hsl(280 65% 60%)',
    description: '调用外部插件能力',
    icon: 'Plug',
    category: 'integration',
  },
  [NodeType.WORKFLOW]: {
    label: '工作流',
    color: 'hsl(38 92% 50%)',
    description: '调用其他工作流',
    icon: 'GitBranch',
    category: 'integration',
  },
  [NodeType.CONDITION]: {
    label: '选择器',
    color: 'hsl(200 80% 50%)',
    description: '条件分支判断',
    icon: 'Split',
    category: 'control',
  },
  [NodeType.LOOP]: {
    label: '循环',
    color: 'hsl(260 70% 55%)',
    description: '循环处理数据',
    icon: 'Repeat',
    category: 'control',
  },
  [NodeType.BATCH]: {
    label: '批处理',
    color: 'hsl(180 70% 45%)',
    description: '批量处理数据',
    icon: 'Layers',
    category: 'control',
  },
  [NodeType.CODE]: {
    label: '代码',
    color: 'hsl(220 70% 50%)',
    description: '执行自定义代码',
    icon: 'Code',
    category: 'advanced',
  },
  [NodeType.TEXT_PROCESS]: {
    label: '文本处理',
    color: 'hsl(340 70% 55%)',
    description: '文本处理和转换',
    icon: 'Type',
    category: 'advanced',
  },
};

export const NODE_CATEGORIES = [
  { key: 'basic', label: '基础节点' },
  { key: 'ai', label: 'AI节点' },
  { key: 'control', label: '控制流' },
  { key: 'integration', label: '集成节点' },
  { key: 'advanced', label: '高级节点' },
] as const;

export const VARIABLE_TYPES: Array<{ value: string; label: string }> = [
  { value: 'string', label: '字符串' },
  { value: 'number', label: '数字' },
  { value: 'boolean', label: '布尔值' },
  { value: 'object', label: '对象' },
  { value: 'array', label: '数组' },
];
