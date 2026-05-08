import { useState, useCallback } from 'react';
import type { WorkflowConfig, ExecuteWorkflowResp } from '@shared/api.interface';
import { executeWorkflow } from '@/api';
import { logger } from '@lark-apaas/client-toolkit/logger';

export function useWorkflowExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecuteWorkflowResp | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const runWorkflow = useCallback(async (
    workflowId: string,
    inputs: Record<string, unknown>
  ): Promise<ExecuteWorkflowResp | null> => {
    setIsExecuting(true);
    setExecutionError(null);
    
    try {
      const result = await executeWorkflow(workflowId, inputs);
      setExecutionResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '执行失败';
      setExecutionError(errorMessage);
      logger.error('工作流执行失败', error);
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const resetExecution = useCallback(() => {
    setExecutionResult(null);
    setExecutionError(null);
  }, []);

  return {
    isExecuting,
    executionResult,
    executionError,
    runWorkflow,
    resetExecution,
  };
}
