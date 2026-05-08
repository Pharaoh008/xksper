import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Trash2,
  Plus,
  GripVertical,
  Play,
  CheckCircle,
  Bot,
  Code,
  GitBranch,
  Repeat,
  Layers,
  Settings,
  Type,
  X,
  Plug,
} from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import type {
  WorkflowConfig,
  NodeType,
  VariableSchema,
  LLMNodeConfig,
  CodeNodeConfig,
  ConditionBranch,
  BatchNodeConfig,
  TextOperationType,
} from '@shared/api.interface';
import { VariableBadge } from './VariableBadge';
import { VariableSelector } from './VariableSelector';

interface NodeConfigDrawerProps {
  open: boolean;
  node: Node | null;
  workflow: WorkflowConfig | null;
  availableModels: Array<{ id: string; name: string }>;
  availableTools?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onUpdateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  onUpdateNodeLabel: (nodeId: string, label: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

interface CustomNodeData extends Record<string, unknown> {
  label: string;
  nodeType: NodeType;
  config: Record<string, unknown>;
}

const NODE_TYPE_CONFIG: Record<NodeType, { label: string; icon: React.ReactNode; color: string }> = {
  start: { label: '开始', icon: <Play className="h-4 w-4" />, color: '#22c55e' },
  end: { label: '结束', icon: <CheckCircle className="h-4 w-4" />, color: '#ef4444' },
  llm: { label: '大模型', icon: <Bot className="h-4 w-4" />, color: '#3b82f6' },
  plugin: { label: '插件', icon: <Plug className="h-4 w-4" />, color: '#8b5cf6' },
  code: { label: '代码', icon: <Code className="h-4 w-4" />, color: '#10b981' },
  condition: { label: '选择器', icon: <GitBranch className="h-4 w-4" />, color: '#f59e0b' },
  loop: { label: '循环', icon: <Repeat className="h-4 w-4" />, color: '#ef4444' },
  batch: { label: '批处理', icon: <Layers className="h-4 w-4" />, color: '#06b6d4' },
  workflow: { label: '工作流', icon: <Layers className="h-4 w-4" />, color: '#ec4899' },
  text: { label: '文本处理', icon: <Type className="h-4 w-4" />, color: '#64748b' },
  annotation: { label: '注释', icon: <Settings className="h-4 w-4" />, color: '#94a3b8' },
};

export const NodeConfigDrawer: React.FC<NodeConfigDrawerProps> = ({
  open,
  node,
  workflow,
  availableModels,
  availableTools,
  onClose,
  onUpdateNodeData,
  onUpdateNodeLabel,
  onDeleteNode,
}) => {
  const nodeData = node?.data as CustomNodeData | undefined;
  const nodeType = nodeData?.nodeType || 'start';
  const config = nodeData?.config || {};

  const handleUpdateConfig = (key: string, value: unknown) => {
    if (!node) return;
    onUpdateNodeData(node.id, { [key]: value });
  };

  const handleUpdateLabel = (label: string) => {
    if (!node) return;
    onUpdateNodeLabel(node.id, label);
  };

  const handleDelete = () => {
    if (!node) return;
    onDeleteNode(node.id);
    onClose();
  };

  const upstreamVariables = React.useMemo(() => {
    if (!workflow) return [];
    const nodeId = node?.id;
    if (!nodeId) return [];

    const variables: Array<{ name: string; source: string; type?: string }> = [];

    workflow.edges.forEach((edge) => {
      if (edge.target === nodeId && edge.source) {
        const sourceNode = workflow.nodes.find((n) => n.id === edge.source);
        if (sourceNode) {
          variables.push({
            name: `${sourceNode.label}.output`,
            source: `${sourceNode.id}.output`,
            type: 'string',
          });
        }
      }
    });

    return variables;
  }, [workflow, node?.id]);

  const renderStartConfig = () => {
    const variables = (config.variables as VariableSchema[]) || [];

    const handleAddVariable = () => {
      handleUpdateConfig('variables', [
        ...variables,
        { name: '', type: 'string', description: '', required: false },
      ]);
    };

    const handleUpdateVariable = (index: number, field: keyof VariableSchema, value: unknown) => {
      const updated = [...variables];
      updated[index] = { ...updated[index], [field]: value };
      handleUpdateConfig('variables', updated);
    };

    const handleDeleteVariable = (index: number) => {
      handleUpdateConfig('variables', variables.filter((_, i) => i !== index));
    };

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">节点名称</Label>
          <Input
            className="mt-1.5"
            value={nodeData?.label || ''}
            onChange={(e) => handleUpdateLabel(e.target.value)}
            placeholder="输入节点名称"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">输入变量</Label>
            <Button variant="outline" size="sm" onClick={handleAddVariable}>
              <Plus className="h-3 w-3 mr-1" />
              添加变量
            </Button>
          </div>

          {variables.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无输入变量，点击添加</p>
          ) : (
            <div className="space-y-2">
              {variables.map((variable, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                  <GripVertical className="h-4 w-4 mt-2 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        placeholder="变量名"
                        value={variable.name}
                        onChange={(e) => handleUpdateVariable(index, 'name', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Select
                      value={variable.type}
                      onValueChange={(value) => handleUpdateVariable(index, 'type', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">string</SelectItem>
                        <SelectItem value="number">number</SelectItem>
                        <SelectItem value="boolean">boolean</SelectItem>
                        <SelectItem value="array">array</SelectItem>
                        <SelectItem value="object">object</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="col-span-2">
                      <Input
                        placeholder="描述（可选）"
                        value={variable.description || ''}
                        onChange={(e) => handleUpdateVariable(index, 'description', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Switch
                        id={`required-${index}`}
                        checked={variable.required || false}
                        onCheckedChange={(checked) => handleUpdateVariable(index, 'required', checked)}
                      />
                      <Label htmlFor={`required-${index}`} className="text-sm cursor-pointer">
                        必填
                      </Label>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteVariable(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEndConfig = () => {
    const outputs = (config.outputs as Array<{ name: string; source: string }>) || [];

    const handleAddOutput = () => {
      handleUpdateConfig('outputs', [...outputs, { name: '', source: '' }]);
    };

    const handleUpdateOutput = (index: number, field: 'name' | 'source', value: string) => {
      const updated = [...outputs];
      updated[index] = { ...updated[index], [field]: value };
      handleUpdateConfig('outputs', updated);
    };

    const handleDeleteOutput = (index: number) => {
      handleUpdateConfig('outputs', outputs.filter((_, i) => i !== index));
    };

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">节点名称</Label>
          <Input
            className="mt-1.5"
            value={nodeData?.label || ''}
            onChange={(e) => handleUpdateLabel(e.target.value)}
            placeholder="输入节点名称"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">输出变量映射</Label>
            <Button variant="outline" size="sm" onClick={handleAddOutput}>
              <Plus className="h-3 w-3 mr-1" />
              添加输出
            </Button>
          </div>

          {outputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无输出映射，点击添加</p>
          ) : (
            <div className="space-y-2">
              {outputs.map((output, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        placeholder="输出名称"
                        value={output.name}
                        onChange={(e) => handleUpdateOutput(index, 'name', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <VariableSelector
                      variables={upstreamVariables}
                      onSelect={(variable) => handleUpdateOutput(index, 'source', variable)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOutput(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {upstreamVariables.length > 0 && (
          <div>
            <Label className="text-sm font-medium mb-2 block">可用上游变量</Label>
            <div className="flex flex-wrap gap-1">
              {upstreamVariables.map((v, i) => (
                <VariableBadge
                  key={i}
                  name={v.name}
                  type={v.type}
                  onClick={() => {}}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLLMConfig = () => {
    const llmConfig = config as Partial<LLMNodeConfig>;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">节点名称</Label>
          <Input
            className="mt-1.5"
            value={nodeData?.label || ''}
            onChange={(e) => handleUpdateLabel(e.target.value)}
            placeholder="输入节点名称"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">模型</Label>
          <Select
            value={llmConfig.model || ''}
            onValueChange={(value) => handleUpdateConfig('model', value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">系统提示词</Label>
          <Textarea
            className="mt-1.5 min-h-[100px] font-mono text-sm"
            value={llmConfig.systemPrompt || ''}
            onChange={(e) => handleUpdateConfig('systemPrompt', e.target.value)}
            placeholder="输入系统提示词..."
          />
          {upstreamVariables.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {upstreamVariables.map((v, i) => (
                <VariableBadge
                  key={i}
                  name={v.name}
                  type={v.type}
                  onClick={() => {
                    handleUpdateConfig(
                      'systemPrompt',
                      (llmConfig.systemPrompt || '') + `{{${v.source}}}`
                    );
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium">用户提示词</Label>
          <Textarea
            className="mt-1.5 min-h-[100px] font-mono text-sm"
            value={llmConfig.userPrompt || ''}
            onChange={(e) => handleUpdateConfig('userPrompt', e.target.value)}
            placeholder="输入用户提示词..."
          />
          {upstreamVariables.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {upstreamVariables.map((v, i) => (
                <VariableBadge
                  key={i}
                  name={v.name}
                  type={v.type}
                  onClick={() => {
                    handleUpdateConfig(
                      'userPrompt',
                      (llmConfig.userPrompt || '') + `{{${v.source}}}`
                    );
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium">温度 (Temperature)</Label>
          <div className="flex items-center gap-4 mt-1.5">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={llmConfig.temperature ?? 0.7}
              onChange={(e) => handleUpdateConfig('temperature', parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="font-mono text-sm w-12 text-right">{llmConfig.temperature ?? 0.7}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            较低的值使输出更确定，较高的值使输出更随机
          </p>
        </div>

        <div>
          <Label className="text-sm font-medium">输出变量</Label>
          <Input
            className="mt-1.5"
            value={llmConfig.outputVariable || ''}
            onChange={(e) => handleUpdateConfig('outputVariable', e.target.value)}
            placeholder="输出变量名称"
          />
        </div>
      </div>
    );
  };

  const renderCodeConfig = () => {
    const codeConfig = config as Partial<CodeNodeConfig>;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">节点名称</Label>
          <Input
            className="mt-1.5"
            value={nodeData?.label || ''}
            onChange={(e) => handleUpdateLabel(e.target.value)}
            placeholder="输入节点名称"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">语言</Label>
          <Select
            value={codeConfig.language || 'javascript'}
            onValueChange={(value) => handleUpdateConfig('language', value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="选择语言" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="typescript">TypeScript</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">代码</Label>
          <Textarea
            className="mt-1.5 min-h-[200px] font-mono text-sm"
            value={codeConfig.code || ''}
            onChange={(e) => handleUpdateConfig('code', e.target.value)}
            placeholder="// 输入: input&#10;// 输出: output&#10;&#10;const output = input;"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">输入变量</Label>
          <Input
            className="mt-1.5"
            value={codeConfig.inputVariable || ''}
            onChange={(e) => handleUpdateConfig('inputVariable', e.target.value)}
            placeholder="输入变量名称"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">输出变量</Label>
          <Input
            className="mt-1.5"
            value={codeConfig.outputVariable || ''}
            onChange={(e) => handleUpdateConfig('outputVariable', e.target.value)}
            placeholder="输出变量名称"
          />
        </div>
      </div>
    );
  };

  const renderConditionConfig = () => {
    const conditions = (config.conditions as ConditionBranch[]) || [];
    const logic = config.logic as 'and' | 'or' || 'and';

    const handleAddCondition = () => {
      handleUpdateConfig('conditions', [
        ...conditions,
        { id: `cond-${Date.now()}`, label: '', condition: '' },
      ]);
    };

    const handleUpdateCondition = (index: number, field: keyof ConditionBranch, value: string) => {
      const updated = [...conditions];
      updated[index] = { ...updated[index], [field]: value };
      handleUpdateConfig('conditions', updated);
    };

    const handleDeleteCondition = (index: number) => {
      handleUpdateConfig('conditions', conditions.filter((_, i) => i !== index));
    };

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">节点名称</Label>
          <Input
            className="mt-1.5"
            value={nodeData?.label || ''}
            onChange={(e) => handleUpdateLabel(e.target.value)}
            placeholder="输入节点名称"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">逻辑</Label>
          <Select
            value={logic}
            onValueChange={(value: 'and' | 'or') => handleUpdateConfig('logic', value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">AND (所有条件都满足)</SelectItem>
              <SelectItem value="or">OR (任一条件满足)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">条件分支</Label>
            <Button variant="outline" size="sm" onClick={handleAddCondition}>
              <Plus className="h-3 w-3 mr-1" />
              添加条件
            </Button>
          </div>

          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无条件，点击添加</p>
          ) : (
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="p-3 bg-accent/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="分支标签"
                      value={condition.label}
                      onChange={(e) => handleUpdateCondition(index, 'label', e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCondition(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="条件表达式，如: input.age > 18"
                    value={condition.condition}
                    onChange={(e) => handleUpdateCondition(index, 'condition', e.target.value)}
                    className="min-h-[60px] text-sm font-mono"
                  />
                  {upstreamVariables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {upstreamVariables.map((v, i) => (
                        <VariableBadge
                          key={i}
                          name={v.name}
                          type={v.type}
                          onClick={() => {
                            handleUpdateCondition(
                              index,
                              'condition',
                              condition.condition + `{{${v.source}}}`
                            );
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLoopConfig = () => {
    const loopConfig = config as Partial<{ loopType: 'forEach' | 'while'; maxIterations: number }>;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">节点名称</Label>
          <Input
            className="mt-1.5"
            value={nodeData?.label || ''}
            onChange={(e) => handleUpdateLabel(e.target.value)}
            placeholder="输入节点名称"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">循环类型</Label>
          <Select
            value={loopConfig.loopType || 'forEach'}
            onValueChange={(value: 'forEach' | 'while') => handleUpdateConfig('loopType', value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forEach">遍历 (forEach)</SelectItem>
              <SelectItem value="while">条件循环 (while)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">最大迭代次数</Label>
          <Input
            className="mt-1.5"
            type="number"
            value={loopConfig.maxIterations || 100}
            onChange={(e) => handleUpdateConfig('maxIterations', parseInt(e.target.value, 10))}
            min={1}
            max={1000}
          />
        </div>
      </div>
    );
  };

  const renderBatchConfig = () => {
    const batchConfig = config as Partial<BatchNodeConfig>;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">节点名称</Label>
          <Input
            className="mt-1.5"
            value={nodeData?.label || ''}
            onChange={(e) => handleUpdateLabel(e.target.value)}
            placeholder="输入节点名称"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">批次大小</Label>
          <Input
            className="mt-1.5"
            type="number"
            value={batchConfig.batchSize || 10}
            onChange={(e) => handleUpdateConfig('batchSize', parseInt(e.target.value, 10))}
            min={1}
            max={100}
          />
          <p className="text-xs text-muted-foreground mt-1">每次处理的批次数量</p>
        </div>

        <div>
          <Label className="text-sm font-medium">并发数</Label>
          <Input
            className="mt-1.5"
            type="number"
            value={batchConfig.concurrency || 5}
            onChange={(e) => handleUpdateConfig('concurrency', parseInt(e.target.value, 10))}
            min={1}
            max={20}
          />
          <p className="text-xs text-muted-foreground mt-1">同时处理的任务数</p>
        </div>
      </div>
    );
  };

  const renderTextConfig = () => {
    const operations = (config.operations as Array<{ type: TextOperationType; value?: string; resultVar?: string }>) || [];

    const handleAddOperation = () => {
      handleUpdateConfig('operations', [
        ...operations,
        { type: 'concat' as TextOperationType, value: '', resultVar: '' },
      ]);
    };

    const handleUpdateOperation = (index: number, field: 'type' | 'value' | 'resultVar', value: string | TextOperationType) => {
      const updated = [...operations];
      updated[index] = { ...updated[index], [field]: value };
      handleUpdateConfig('operations', updated);
    };

    const handleDeleteOperation = (index: number) => {
      handleUpdateConfig('operations', operations.filter((_, i) => i !== index));
    };

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">节点名称</Label>
          <Input
            className="mt-1.5"
            value={nodeData?.label || ''}
            onChange={(e) => handleUpdateLabel(e.target.value)}
            placeholder="输入节点名称"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">文本操作</Label>
            <Button variant="outline" size="sm" onClick={handleAddOperation}>
              <Plus className="h-3 w-3 mr-1" />
              添加操作
            </Button>
          </div>

          {operations.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无操作，点击添加</p>
          ) : (
            <div className="space-y-2">
              {operations.map((operation, index) => (
                <div key={index} className="p-3 bg-accent/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={operation.type}
                      onValueChange={(value: TextOperationType) =>
                        handleUpdateOperation(index, 'type', value)
                      }
                    >
                      <SelectTrigger className="w-[120px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="concat">拼接</SelectItem>
                        <SelectItem value="split">分割</SelectItem>
                        <SelectItem value="replace">替换</SelectItem>
                        <SelectItem value="extract">提取</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="操作值"
                      value={operation.value || ''}
                      onChange={(e) => handleUpdateOperation(index, 'value', e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteOperation(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">结果变量:</Label>
                    <Input
                      placeholder="保存到变量"
                      value={operation.resultVar || ''}
                      onChange={(e) => handleUpdateOperation(index, 'resultVar', e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConfigForm = () => {
    switch (nodeType) {
      case 'start':
        return renderStartConfig();
      case 'end':
        return renderEndConfig();
      case 'llm':
        return renderLLMConfig();
      case 'code':
        return renderCodeConfig();
      case 'condition':
        return renderConditionConfig();
      case 'loop':
        return renderLoopConfig();
      case 'batch':
        return renderBatchConfig();
      case 'text':
        return renderTextConfig();
      default:
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground">该节点类型暂不支持配置</p>
          </div>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${NODE_TYPE_CONFIG[nodeType]?.color}20` }}
            >
              <span style={{ color: NODE_TYPE_CONFIG[nodeType]?.color }}>
                {NODE_TYPE_CONFIG[nodeType]?.icon}
              </span>
            </div>
            <div>
              <SheetTitle className="text-base">
                {NODE_TYPE_CONFIG[nodeType]?.label}节点配置
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {nodeData?.label || '未命名节点'}
              </p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">{renderConfigForm()}</ScrollArea>

        {nodeType !== 'start' && nodeType !== 'end' && (
          <div className="px-6 py-4 border-t">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除节点
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
