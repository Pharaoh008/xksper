import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus, Trash2 } from 'lucide-react';
import { NodeType, NODE_CONFIG } from '../constants/nodeTypes';
import { VARIABLE_TYPES } from '../constants/nodeTypes';
import type {
  NodeData,
  StartNodeData,
  EndNodeData,
  LLMNodeData,
  PluginNodeData,
  WorkflowNodeData,
  ConditionNodeData,
  LoopNodeData,
  BatchNodeData,
  WorkflowVariable,
} from '../types/workflow';

interface NodeConfigPanelProps {
  nodeId: string | null;
  nodeType: string | null;
  data: NodeData | null;
  onUpdate: (data: Partial<NodeData>) => void;
  onClose: () => void;
  onDelete: () => void;
}

const availableModels = [
  { id: 'gpt-4', name: 'GPT-4' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
  { id: 'gemini-pro', name: 'Gemini Pro' },
];

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  nodeId,
  nodeType,
  data,
  onUpdate,
  onClose,
  onDelete,
}) => {
  if (!nodeId || !nodeType) {
    return (
      <div className="w-80 h-full border-l border-border bg-card flex flex-col items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">选择节点以编辑配置</p>
        </div>
      </div>
    );
  }

  const config = NODE_CONFIG[nodeType as keyof typeof NODE_CONFIG];
  const isDeletable = nodeType !== NodeType.START && nodeType !== NodeType.END;

  const renderStartConfig = (nodeData: StartNodeData) => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">输入变量</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          定义工作流的输入参数
        </p>
      </div>
      <div className="space-y-2">
        {nodeData.variables.map((variable, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-2 border border-border rounded-md"
          >
            <Input
              placeholder="变量名"
              value={variable.name}
              onChange={(e) => {
                const newVars = [...nodeData.variables];
                newVars[index] = { ...newVars[index], name: e.target.value };
                onUpdate({ variables: newVars });
              }}
              className="flex-1 h-8"
            />
            <Select
              value={variable.type}
              onValueChange={(val) => {
                const newVars = [...nodeData.variables];
                newVars[index] = {
                  ...newVars[index],
                  type: val as WorkflowVariable['type'],
                };
                onUpdate({ variables: newVars });
              }}
            >
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIABLE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                const newVars = nodeData.variables.filter(
                  (_, i) => i !== index
                );
                onUpdate({ variables: newVars });
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            const newVars = [
              ...nodeData.variables,
              { name: '', type: 'string' as const },
            ];
            onUpdate({ variables: newVars });
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          添加变量
        </Button>
      </div>
    </div>
  );

  const renderEndConfig = (nodeData: EndNodeData) => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">输出变量</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          定义工作流的输出参数
        </p>
      </div>
      <div className="space-y-2">
        {nodeData.outputs.map((output, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-2 border border-border rounded-md"
          >
            <Input
              placeholder="变量名"
              value={output.name}
              onChange={(e) => {
                const newOutputs = [...nodeData.outputs];
                newOutputs[index] = { ...newOutputs[index], name: e.target.value };
                onUpdate({ outputs: newOutputs });
              }}
              className="flex-1 h-8"
            />
            <Input
              placeholder="引用节点变量"
              value={output.ref}
              onChange={(e) => {
                const newOutputs = [...nodeData.outputs];
                newOutputs[index] = { ...newOutputs[index], ref: e.target.value };
                onUpdate({ outputs: newOutputs });
              }}
              className="flex-1 h-8"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                const newOutputs = nodeData.outputs.filter(
                  (_, i) => i !== index
                );
                onUpdate({ outputs: newOutputs });
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            const newOutputs = [
              ...nodeData.outputs,
              { name: '', ref: '' },
            ];
            onUpdate({ outputs: newOutputs });
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          添加输出
        </Button>
      </div>
    </div>
  );

  const renderLLMConfig = (nodeData: LLMNodeData) => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">模型选择</Label>
        <Select
          value={nodeData.model || ''}
          onValueChange={(val) => onUpdate({ model: val })}
        >
          <SelectTrigger className="mt-2">
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
      <Separator />
      <div>
        <Label className="text-sm font-medium">系统提示词</Label>
        <Textarea
          placeholder="输入系统提示词..."
          value={nodeData.systemPrompt || ''}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          className="mt-2 min-h-[100px]"
        />
      </div>
      <Separator />
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">温度</Label>
          <span className="text-sm text-muted-foreground">
            {nodeData.temperature ?? 0.7}
          </span>
        </div>
        <Slider
          value={[nodeData.temperature ?? 0.7]}
          min={0}
          max={2}
          step={0.1}
          onValueChange={([val]) => onUpdate({ temperature: val })}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>精确</span>
          <span>创意</span>
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">最大Token数</Label>
        <Input
          type="number"
          value={nodeData.maxTokens || 2048}
          onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) || 2048 })}
          className="mt-2"
        />
      </div>
    </div>
  );

  const renderPluginConfig = (nodeData: PluginNodeData) => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">插件选择</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          选择要调用的外部插件
        </p>
        <Button variant="outline" className="w-full">
          选择插件
        </Button>
      </div>
      {nodeData.pluginName && (
        <>
          <Separator />
          <div>
            <Label className="text-sm font-medium">已选插件</Label>
            <Badge variant="secondary" className="mt-2">
              {nodeData.pluginName}
            </Badge>
          </div>
        </>
      )}
    </div>
  );

  const renderWorkflowConfig = (nodeData: WorkflowNodeData) => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">工作流选择</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          选择要调用的子工作流
        </p>
        <Button variant="outline" className="w-full">
          选择工作流
        </Button>
      </div>
      {nodeData.workflowName && (
        <>
          <Separator />
          <div>
            <Label className="text-sm font-medium">已选工作流</Label>
            <Badge variant="secondary" className="mt-2">
              {nodeData.workflowName}
            </Badge>
          </div>
        </>
      )}
    </div>
  );

  const renderConditionConfig = (nodeData: ConditionNodeData) => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">条件表达式</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          使用变量和运算符构建条件
        </p>
        <Textarea
          placeholder="例如: {{input.age}} > 18"
          value={nodeData.condition || ''}
          onChange={(e) => onUpdate({ condition: e.target.value })}
          className="min-h-[80px]"
        />
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">输出分支</Label>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2 p-2 border border-border rounded-md">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm">条件为真 (true)</span>
          </div>
          <div className="flex items-center gap-2 p-2 border border-border rounded-md">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-sm">条件为假 (false)</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLoopConfig = (nodeData: LoopNodeData) => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">循环集合</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          要遍历的数组或集合
        </p>
        <Input
          placeholder="例如: {{input.items}}"
          value={nodeData.loopCollection || ''}
          onChange={(e) => onUpdate({ loopCollection: e.target.value })}
        />
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">迭代变量名</Label>
        <Input
          placeholder="例如: item"
          value={nodeData.loopVariable || ''}
          onChange={(e) => onUpdate({ loopVariable: e.target.value })}
          className="mt-2"
        />
      </div>
    </div>
  );

  const renderBatchConfig = (nodeData: BatchNodeData) => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">批次大小</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          每批处理的数据条数
        </p>
        <Input
          type="number"
          value={nodeData.batchSize || 10}
          onChange={(e) =>
            onUpdate({ batchSize: parseInt(e.target.value) || 10 })
          }
        />
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">并行处理</Label>
          <p className="text-xs text-muted-foreground">
            同时处理多个批次
          </p>
        </div>
        <Switch
          checked={nodeData.parallel || false}
          onCheckedChange={(checked) => onUpdate({ parallel: checked })}
        />
      </div>
    </div>
  );

  const renderConfigContent = () => {
    switch (nodeType) {
      case NodeType.START:
        return renderStartConfig(data as StartNodeData);
      case NodeType.END:
        return renderEndConfig(data as EndNodeData);
      case NodeType.LLM:
        return renderLLMConfig(data as LLMNodeData);
      case NodeType.PLUGIN:
        return renderPluginConfig(data as PluginNodeData);
      case NodeType.WORKFLOW:
        return renderWorkflowConfig(data as WorkflowNodeData);
      case NodeType.CONDITION:
        return renderConditionConfig(data as ConditionNodeData);
      case NodeType.LOOP:
        return renderLoopConfig(data as LoopNodeData);
      case NodeType.BATCH:
        return renderBatchConfig(data as BatchNodeData);
      default:
        return (
          <p className="text-sm text-muted-foreground">
            暂不支持此节点类型的配置
          </p>
        );
    }
  };

  return (
    <div className="w-80 h-full border-l border-border bg-card flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">
            {config?.label || '节点配置'}
          </h2>
          <p className="text-xs text-muted-foreground">ID: {nodeId}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-4">
        {renderConfigContent()}
      </ScrollArea>
      {isDeletable && (
        <div className="p-4 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            删除节点
          </Button>
        </div>
      )}
    </div>
  );
};

export default NodeConfigPanel;
