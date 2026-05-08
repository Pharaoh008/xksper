import { Injectable, Logger } from '@nestjs/common';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE } from '@lark-apaas/fullstack-nestjs-core';
import { Inject } from '@nestjs/common';
import { workflow } from '../../database/schema';
import type {
  WorkflowConfig,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  NodeConfig,
  ExecuteWorkflowResp,
  WorkflowExecutionStep,
  LLMNodeConfig,
  CodeNodeConfig,
  ConditionNodeConfig,
  LoopNodeConfig,
  BatchNodeConfig,
} from '@shared/api.interface';

interface ExecutionContext {
  variables: Map<string, unknown>;
  nodeOutputs: Map<string, Record<string, unknown>>;
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async executeWorkflow(
    workflowId: string,
    inputs: Record<string, unknown>,
  ): Promise<ExecuteWorkflowResp> {
    const executionId = `exec-${Date.now()}`;
    const startTime = Date.now();

    try {
      // Fetch workflow
      const workflows = await this.db
        .select()
        .from(workflow)
        .where(eq(workflow.id, workflowId))
        .limit(1);

      if (workflows.length === 0) {
        return {
          workflowId,
          executionId,
          status: 'failed',
          error: 'Workflow not found',
        };
      }

      const wf = workflows[0];
      const nodes: WorkflowNode[] = (wf.nodes as WorkflowNode[]) || [];
      const edges: WorkflowEdge[] = (wf.edges as WorkflowEdge[]) || [];

      if (nodes.length === 0) {
        return {
          workflowId,
          executionId,
          status: 'failed',
          error: 'Workflow has no nodes',
        };
      }

      // Initialize execution context
      const context: ExecutionContext = {
        variables: new Map(Object.entries(inputs)),
        nodeOutputs: new Map(),
      };

      // Build execution graph
      const executionOrder = this.topologicalSort(nodes, edges);

      // Execute nodes in order
      const steps: WorkflowExecutionStep[] = [];
      for (const node of executionOrder) {
        const step = await this.executeNode(node, context, edges);
        steps.push(step);

        if (step.status === 'failed') {
          return {
            workflowId,
            executionId,
            status: 'failed',
            error: step.error,
          };
        }
      }

      // Collect outputs from end node
      const endNode = nodes.find((n) => n.type === 'end');
      const outputs: Record<string, unknown> = {};
      if (endNode?.config) {
        const config = endNode.config as { outputs?: Array<{ name: string; source: string }> };
        for (const output of config.outputs || []) {
          const value = this.resolveVariable(output.source, context);
          outputs[output.name] = value;
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Workflow ${workflowId} executed in ${duration}ms`);

      return {
        workflowId,
        executionId,
        status: 'completed',
        outputs,
      };
    } catch (error) {
      this.logger.error('Workflow execution failed', error);
      return {
        workflowId,
        executionId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    // Build adjacency list
    for (const edge of edges) {
      const neighbors = adjacency.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacency.set(edge.source, neighbors);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const result: WorkflowNode[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = nodeMap.get(id);
      if (node) result.push(node);

      for (const neighbor of adjacency.get(id) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return result;
  }

  private async executeNode(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: WorkflowEdge[],
  ): Promise<WorkflowExecutionStep> {
    const step: WorkflowExecutionStep = {
      nodeId: node.id,
      nodeType: node.type,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    try {
      const config = node.config || {};
      let outputs: Record<string, unknown> = {};

      switch (node.type) {
        case 'start':
          outputs = this.executeStartNode(config, context);
          break;
        case 'end':
          outputs = this.executeEndNode(config, context);
          break;
        case 'llm':
          outputs = await this.executeLLMNode(config as unknown as LLMNodeConfig, context);
          break;
        case 'code':
          outputs = this.executeCodeNode(config as unknown as CodeNodeConfig, context);
          break;
        case 'condition':
          outputs = this.executeConditionNode(config as unknown as ConditionNodeConfig, context, edges, node.id);
          break;
        case 'loop':
          outputs = this.executeLoopNode(config as unknown as LoopNodeConfig, context);
          break;
        case 'batch':
          outputs = this.executeBatchNode(config as unknown as BatchNodeConfig, context);
          break;
        default:
          outputs = { output: null };
      }

      context.nodeOutputs.set(node.id, outputs);
      step.outputs = outputs;
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return step;
  }

  private executeStartNode(config: NodeConfig, context: ExecutionContext): Record<string, unknown> {
    // Start node passes inputs through
    const outputs: Record<string, unknown> = {};
    for (const [key, value] of context.variables) {
      outputs[key] = value;
    }
    return outputs;
  }

  private executeEndNode(config: NodeConfig, context: ExecutionContext): Record<string, unknown> {
    // End node collects final outputs
    return { completed: true };
  }

  private async executeLLMNode(
    config: LLMNodeConfig,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    // Replace variables in prompts
    const systemPrompt = config.systemPrompt
      ? this.replaceVariables(config.systemPrompt, context)
      : '';
    const userPrompt = config.userPrompt
      ? this.replaceVariables(config.userPrompt, context)
      : '';

    // Mock LLM call - in real implementation, call LLM service
    const response = `[Mock LLM Response] System: ${systemPrompt.slice(0, 50)}... User: ${userPrompt.slice(0, 50)}...`;

    const outputVar = config.outputVariable || 'output';
    return { [outputVar]: response };
  }

  private executeCodeNode(config: CodeNodeConfig, context: ExecutionContext): Record<string, unknown> {
    const code = config.code || '';
    const inputVar = config.inputVariable || 'input';
    const outputVar = config.outputVariable || 'output';
    const inputValue = context.variables.get(inputVar);

    // Simple sandbox execution - only supports basic operations
    try {
      // Create a safe function
      const func = new Function('input', code.includes('return') ? code : `return ${code}`);
      const result = func(inputValue);
      return { [outputVar]: result };
    } catch (error) {
      this.logger.error('Code execution failed', error);
      return { [outputVar]: null, error: 'Code execution failed' };
    }
  }

  private executeConditionNode(
    config: ConditionNodeConfig,
    context: ExecutionContext,
    edges: WorkflowEdge[],
    nodeId: string,
  ): Record<string, unknown> {
    const branches = config.branches || [];
    const logic = config.logic || 'and';

    // Find outgoing edges and their conditions
    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    const results: Record<string, boolean> = {};

    for (const branch of branches) {
      const condition = branch.condition || '';
      if (!condition) {
        results[branch.id] = true;
        continue;
      }

      // Simple condition evaluation - supports basic comparisons
      const resolvedCondition = this.replaceVariables(condition, context);
      try {
        // Use Function constructor for simple boolean evaluation
        const func = new Function(`return ${resolvedCondition}`);
        results[branch.id] = Boolean(func());
      } catch {
        results[branch.id] = false;
      }
    }

    // Determine which branch to take
    let selectedBranch: string | null = null;
    if (logic === 'and') {
      selectedBranch = Object.entries(results).find(([_, v]) => !v)?.[0] || 'true';
    } else {
      selectedBranch = Object.entries(results).find(([_, v]) => v)?.[0] || 'false';
    }

    return { selectedBranch, results };
  }

  private executeLoopNode(
    config: LoopNodeConfig,
    context: ExecutionContext,
  ): Record<string, unknown> {
    const loopType = config.loopType || 'forEach';
    const maxIterations = config.maxIterations || 100;
    const outputVar = config.outputVariable || 'output';
    const inputVar = config.inputVariable || 'input';

    const inputValue = context.variables.get(inputVar);
    const results: unknown[] = [];

    if (loopType === 'forEach' && Array.isArray(inputValue)) {
      for (let i = 0; i < Math.min(inputValue.length, maxIterations); i++) {
        results.push(inputValue[i]);
      }
    } else if (loopType === 'while') {
      // While loop would need condition evaluation
      for (let i = 0; i < maxIterations; i++) {
        results.push(i);
      }
    }

    return { [outputVar]: results, iterations: results.length };
  }

  private executeBatchNode(
    config: BatchNodeConfig,
    context: ExecutionContext,
  ): Record<string, unknown> {
    const batchSize = config.batchSize || 10;
    const outputVar = config.outputVariable || 'output';
    const inputVar = config.inputVariable || 'input';

    const inputValue = context.variables.get(inputVar);
    const batches: unknown[][] = [];

    if (Array.isArray(inputValue)) {
      for (let i = 0; i < inputValue.length; i += batchSize) {
        batches.push(inputValue.slice(i, i + batchSize));
      }
    }

    return { [outputVar]: batches, batchCount: batches.length };
  }

  private replaceVariables(text: string, context: ExecutionContext): string {
    // Replace {{variableName}} patterns
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = context.variables.get(varName);
      return value !== undefined ? String(value) : match;
    });
  }

  private resolveVariable(source: string, context: ExecutionContext): unknown {
    // Resolve {{nodeId.outputName}} or simple variable references
    const match = source.match(/\{\{(\w+)(?:\.(\w+))?\}\}/);
    if (match) {
      const [, nodeId, outputName] = match;
      const nodeOutput = context.nodeOutputs.get(nodeId);
      if (nodeOutput && outputName) {
        return nodeOutput[outputName];
      }
      return context.variables.get(nodeId);
    }
    return source;
  }
}
