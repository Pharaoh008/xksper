import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  Circle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import type {
  WorkflowConfig,
  ExecuteWorkflowResp,
  VariableSchema,
} from '@shared/api.interface';

interface RunWorkflowModalProps {
  open: boolean;
  workflow: WorkflowConfig | null;
  executionResult: ExecuteWorkflowResp | null;
  isExecuting: boolean;
  onClose: () => void;
  onExecute: (inputs: Record<string, unknown>) => void;
}

type Step = 'input' | 'executing' | 'result';

export const RunWorkflowModal: React.FC<RunWorkflowModalProps> = ({
  open,
  workflow,
  executionResult,
  isExecuting,
  onClose,
  onExecute,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('input');
  const [inputs, setInputs] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setCurrentStep('input');
      setInputs({});
    }
  }, [open]);

  React.useEffect(() => {
    if (isExecuting) {
      setCurrentStep('executing');
    }
  }, [isExecuting]);

  React.useEffect(() => {
    if (executionResult) {
      setCurrentStep('result');
    }
  }, [executionResult]);

  const handleInputChange = (name: string, value: string) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleExecute = () => {
    const parsedInputs: Record<string, unknown> = {};
    workflow?.inputSchema.forEach((schema) => {
      const value = inputs[schema.name];
      if (value !== undefined) {
        switch (schema.type) {
          case 'number':
            parsedInputs[schema.name] = parseFloat(value) || 0;
            break;
          case 'boolean':
            parsedInputs[schema.name] = value === 'true';
            break;
          case 'array':
          case 'object':
            try {
              parsedInputs[schema.name] = JSON.parse(value);
            } catch {
              parsedInputs[schema.name] = value;
            }
            break;
          default:
            parsedInputs[schema.name] = value;
        }
      }
    });
    onExecute(parsedInputs);
  };

  const renderInputForm = () => {
    if (!workflow?.inputSchema || workflow.inputSchema.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">该工作流无需输入参数</p>
          <Button onClick={handleExecute}>
            <Play className="h-4 w-4 mr-2" />
            直接运行
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          请输入工作流执行所需的参数
        </div>
        {workflow.inputSchema.map((schema) => (
          <div key={schema.name} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor={schema.name} className="text-sm font-medium">
                {schema.name}
              </Label>
              <span className="text-xs text-muted-foreground">({schema.type})</span>
              {schema.required && (
                <span className="text-xs text-destructive">*</span>
              )}
            </div>
            {schema.type === 'string' || !schema.type ? (
              <Input
                id={schema.name}
                value={inputs[schema.name] || ''}
                onChange={(e) => handleInputChange(schema.name, e.target.value)}
                placeholder={schema.description || `输入 ${schema.name}`}
                required={schema.required}
              />
            ) : schema.type === 'number' ? (
              <Input
                id={schema.name}
                type="number"
                value={inputs[schema.name] || ''}
                onChange={(e) => handleInputChange(schema.name, e.target.value)}
                placeholder={schema.description || `输入 ${schema.name}`}
                required={schema.required}
              />
            ) : schema.type === 'boolean' ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={inputs[schema.name] === 'true' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange(schema.name, 'true')}
                >
                  True
                </Button>
                <Button
                  type="button"
                  variant={inputs[schema.name] === 'false' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange(schema.name, 'false')}
                >
                  False
                </Button>
              </div>
            ) : schema.type === 'array' || schema.type === 'object' ? (
              <Textarea
                id={schema.name}
                value={inputs[schema.name] || ''}
                onChange={(e) => handleInputChange(schema.name, e.target.value)}
                placeholder={'JSON格式，如: [1, 2, 3] 或 {"key": "value"}'}
                className="min-h-[80px] font-mono text-sm"
              />
            ) : (
              <Input
                id={schema.name}
                value={inputs[schema.name] || ''}
                onChange={(e) => handleInputChange(schema.name, e.target.value)}
                placeholder={schema.description || `输入 ${schema.name}`}
                required={schema.required}
              />
            )}
            {schema.description && (
              <p className="text-xs text-muted-foreground">{schema.description}</p>
            )}
          </div>
        ))}
        <div className="pt-4">
          <Button
            className="w-full"
            onClick={handleExecute}
            disabled={workflow.inputSchema.some(
              (s) => s.required && !inputs[s.name]
            )}
          >
            <Play className="h-4 w-4 mr-2" />
            执行工作流
          </Button>
        </div>
      </div>
    );
  };

  const renderExecuting = () => (
    <div className="text-center py-12">
      <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
      <p className="text-lg font-medium mb-2">正在执行工作流...</p>
      <p className="text-sm text-muted-foreground">
        请耐心等待，执行结果将自动显示
      </p>
    </div>
  );

  const renderResult = () => {
    if (!executionResult) return null;

    const statusIcon =
      executionResult.status === 'completed' ? (
        <CheckCircle2 className="h-5 w-5 text-[#22c55e]" />
      ) : executionResult.status === 'failed' ? (
        <XCircle className="h-5 w-5 text-destructive" />
      ) : (
        <Circle className="h-5 w-5 text-[#f59e0b]" />
      );

    const statusText =
      executionResult.status === 'completed'
        ? '执行成功'
        : executionResult.status === 'failed'
        ? '执行失败'
        : '执行中';

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
          {statusIcon}
          <div>
            <div className="font-medium">{statusText}</div>
            {executionResult.executionId && (
              <div className="text-xs text-muted-foreground font-mono">
                ID: {executionResult.executionId}
              </div>
            )}
          </div>
        </div>

        {executionResult.error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="text-sm font-medium text-destructive mb-1">错误信息</div>
            <pre className="text-xs text-destructive/80 font-mono whitespace-pre-wrap">
              {executionResult.error}
            </pre>
          </div>
        )}

        {executionResult.outputs && Object.keys(executionResult.outputs).length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">输出结果</div>
            <ScrollArea className="h-[300px] rounded-lg border bg-card p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {JSON.stringify(executionResult.outputs, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setCurrentStep('input');
            }}
          >
            重新执行
          </Button>
          <Button className="flex-1" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    );
  };

  const stepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      <div
        className={`flex items-center gap-1.5 ${
          currentStep === 'input' ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        <div
          className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
            currentStep === 'input'
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent'
          }`}
        >
          1
        </div>
        <span className="text-sm">输入参数</span>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <div
        className={`flex items-center gap-1.5 ${
          currentStep === 'executing' ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        <div
          className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
            currentStep === 'executing'
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent'
          }`}
        >
          2
        </div>
        <span className="text-sm">执行中</span>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <div
        className={`flex items-center gap-1.5 ${
          currentStep === 'result' ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        <div
          className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
            currentStep === 'result'
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent'
          }`}
        >
          3
        </div>
        <span className="text-sm">结果</span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            试运行工作流
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {stepIndicator()}

          {currentStep === 'input' && renderInputForm()}
          {currentStep === 'executing' && renderExecuting()}
          {currentStep === 'result' && renderResult()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
