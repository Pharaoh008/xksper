import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { type Node, type Edge, type NodeTypes } from '@xyflow/react';
import { Bot, Plug, Code, GitBranch, Repeat, Layers, Workflow as WorkflowIcon, CheckCircle, Type, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getWorkflow, updateWorkflow, getConfigStatus, getToolList } from '@/api';
import type { WorkflowConfig, NodeType, Tool } from '@shared/api.interface';
import {
  WorkflowCanvas,
  CanvasToolbar,
  NodePalette,
  NodeConfigDrawer,
  RunWorkflowModal,
  InteractionModeModal,
  StartNode,
  EndNode,
  LLMNode,
  PluginNode,
  SubWorkflowNode,
  CodeNode,
  ConditionNode,
  LoopNode,
  BatchNode,
  TextProcessNode,
  AnnotationNode,
} from './components';
import { useWorkflowCanvas, useWorkflowExecution, type InteractionMode } from './hooks';

interface NodeTypeInfo {
  type: NodeType;
  label: string;
  color: string;
}

const NODE_TYPE_LIST: NodeTypeInfo[] = [
  { type: 'start', label: '开始', color: '#3b82f6' },
  { type: 'end', label: '结束', color: '#3b82f6' },
  { type: 'llm', label: '大模型', color: '#1f2937' },
  { type: 'plugin', label: '插件', color: '#8b5cf6' },
  { type: 'code', label: '代码', color: '#10b981' },
  { type: 'condition', label: '选择器', color: '#f59e0b' },
  { type: 'loop', label: '循环', color: '#ef4444' },
  { type: 'batch', label: '批处理', color: '#06b6d4' },
  { type: 'workflow', label: '工作流', color: '#22c55e' },
  { type: 'text', label: '文本处理', color: '#ec4899' },
  { type: 'annotation', label: '注释', color: '#fbbf24' },
];

const nodeTypes: NodeTypes = {
  start: StartNode as any,
  end: EndNode as any,
  llm: LLMNode as any,
  plugin: PluginNode as any,
  workflow: SubWorkflowNode as any,
  code: CodeNode as any,
  condition: ConditionNode as any,
  loop: LoopNode as any,
  batch: BatchNode as any,
  text: TextProcessNode as any,
  annotation: AnnotationNode as any,
};

const WorkflowEditorPage: React.FC = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [workflow, setWorkflow] = useState<WorkflowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [toolsLoading, setToolsLoading] = useState(true);

  // UI State
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);

  const {
    nodes,
    edges,
    selectedNode,
    interactionMode,
    zoom,
    reactFlowInstance,
    setInteractionMode,
    setReactFlowInstance,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onPaneClick,
    addNode,
    updateNode,
    updateNodeData,
    deleteNode,
    setCanvasNodes,
    setCanvasEdges,
    handleZoom,
    handleZoomIn,
    handleZoomOut,
    onZoomChange,
  } = useWorkflowCanvas();

  const { isExecuting, executionResult, runWorkflow, resetExecution } = useWorkflowExecution();

  // Fetch workflow data
  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) return;
    try {
      const data = await getWorkflow(workflowId);
      setWorkflow(data);

      let loadedNodes: Node[] = data.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          label: n.label,
          nodeType: n.type,
          config: n.config || {},
        },
      }));

      let loadedEdges: Edge[] = data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        animated: true,
        style: { stroke: '#8392f0', strokeWidth: 2 },
      }));

      // 如果没有节点，自动添加开始和结束节点
      if (loadedNodes.length === 0) {
        const startNode: Node = {
          id: 'start-1',
          type: 'start',
          position: { x: 150, y: 200 },
          data: {
            label: '开始',
            nodeType: 'start',
            config: {},
          },
        };

        const endNode: Node = {
          id: 'end-1',
          type: 'end',
          position: { x: 550, y: 200 },
          data: {
            label: '结束',
            nodeType: 'end',
            config: {},
          },
        };

        const defaultEdge: Edge = {
          id: 'edge-start-end',
          source: 'start-1',
          target: 'end-1',
          animated: true,
          style: { stroke: '#8392f0', strokeWidth: 2 },
        };

        loadedNodes = [startNode, endNode];
        loadedEdges = [defaultEdge];
      }

      setCanvasNodes(loadedNodes);
      setCanvasEdges(loadedEdges);
    } catch (error) {
      logger.error('获取Workflow失败', error);
      toast.error('获取Workflow失败');
    } finally {
      setLoading(false);
    }
  }, [workflowId, setCanvasNodes, setCanvasEdges]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  // Fetch available models
  const fetchAvailableModels = useCallback(async () => {
    try {
      const status = await getConfigStatus();
      setAvailableModels(status.availableModels.map((m) => ({ id: m.id, name: m.name })));
    } catch (error) {
      logger.error('获取可用模型失败', error);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  // Fetch available tools
  const fetchAvailableTools = useCallback(async () => {
    try {
      const tools = await getToolList();
      setAvailableTools(tools);
    } catch (error) {
      logger.error('获取工具列表失败', error);
    } finally {
      setToolsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableTools();
  }, [fetchAvailableTools]);

  // Save workflow
  const handleSave = async () => {
    if (!workflow || !workflowId) return;
    try {
      const workflowNodes = nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType as NodeType,
        label: n.data.label as string,
        position: n.position,
        config: n.data.config as Record<string, unknown>,
        data: n.data.config as Record<string, unknown>,
      }));

      const workflowEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label ? String(e.label) : undefined,
      }));

      await updateWorkflow(workflowId, {
        name: workflow.name,
        description: workflow.description,
        inputSchema: workflow.inputSchema,
        outputSchema: workflow.outputSchema,
        nodes: workflowNodes,
        edges: workflowEdges,
      });
      toast.success('保存成功');
    } catch (error) {
      logger.error('保存失败', error);
      toast.error('保存失败');
    }
  };

  // Add node
  const handleAddNode = (type: NodeType, position?: { x: number; y: number }) => {
    const nodeTypeInfo = NODE_TYPE_LIST.find((n) => n.type === type);
    const defaultModelId = availableModels.length > 0 ? availableModels[0].id : '';

    let defaultConfig: Record<string, unknown> = {};
    switch (type) {
      case 'start':
        defaultConfig = { variables: [] };
        break;
      case 'end':
        defaultConfig = { outputs: [] };
        break;
      case 'llm':
        defaultConfig = {
          model: defaultModelId,
          systemPrompt: '',
          userPrompt: '',
          temperature: 0.7,
          knowledgeBases: [],
          tools: [],
          outputVariable: 'output',
        };
        break;
      case 'code':
        defaultConfig = {
          language: 'javascript',
          code: '// 输入: input\n// 输出: output\nconst output = input;',
          outputVariable: 'output',
        };
        break;
      case 'condition':
        defaultConfig = {
          logic: 'and',
          branches: [
            { id: 'true', label: '是', condition: '' },
            { id: 'false', label: '否', condition: '' },
          ],
        };
        break;
      case 'loop':
        defaultConfig = { loopType: 'forEach', maxIterations: 100, outputVariable: 'output' };
        break;
      case 'batch':
        defaultConfig = { batchSize: 10, concurrency: 5, outputVariable: 'output' };
        break;
      case 'text':
        defaultConfig = { operations: [], outputVariable: 'output' };
        break;
      case 'annotation':
        defaultConfig = { content: '添加注释...', color: '#fbbf24' };
        break;
      default:
        defaultConfig = {};
    }

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: position || { x: 250 + Math.random() * 100, y: 150 + nodes.length * 80 + Math.random() * 50 },
      data: {
        label: `${nodeTypeInfo?.label}-${nodes.length + 1}`,
        nodeType: type,
        config: defaultConfig,
      },
    };

    addNode(newNode);
    setShowNodePalette(false);
  };

  // Handle drop from palette
  const handleDrop = (_event: React.DragEvent, position: { x: number; y: number }) => {
    const type = _event.dataTransfer.getData('application/reactflow') as NodeType;
    if (type) {
      handleAddNode(type, position);
    }
  };

  // Run workflow
  const handleRunWorkflow = async (inputs: Record<string, unknown>) => {
    if (!workflowId) return;
    await runWorkflow(workflowId, inputs);
  };

  // Update workflow input/output schema when start/end node changes
  const handleUpdateNodeData = (nodeId: string, data: Record<string, unknown>) => {
    updateNodeData(nodeId, data);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Update workflow inputSchema when start node variables change
    if (node.type === 'start' && data.config) {
      const config = data.config as Record<string, unknown>;
      if (config.variables) {
        setWorkflow((prev) =>
          prev ? { ...prev, inputSchema: config.variables as any[] } : prev
        );
      }
    }

    // Update workflow outputSchema when end node outputs change
    if (node.type === 'end' && data.config) {
      const config = data.config as Record<string, unknown>;
      if (config.outputs) {
        const outputs = config.outputs as Array<{ name: string }>;
        setWorkflow((prev) =>
          prev
            ? {
                ...prev,
                outputSchema: outputs.map((o) => ({
                  name: o.name,
                  type: 'string',
                  required: true,
                })),
              }
            : prev
        );
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Workflow 不存在</p>
      </div>
    );
  }

  return (
    <div className="h-screen relative overflow-hidden">
      {/* Canvas */}
      <div className="h-full relative">
        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          interactionMode={interactionMode}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={setReactFlowInstance}
          onZoomChange={onZoomChange}
          showMiniMap={showMiniMap}
          reactFlowInstance={reactFlowInstance.current}
          onDrop={handleDrop}
        />

        {/* Toolbar */}
        <CanvasToolbar
          interactionMode={interactionMode}
          zoom={zoom}
          onInteractionModeChange={(mode) => {
            if (mode === 'trackpad') {
              setShowInteractionModal(true);
            } else {
              setInteractionMode(mode);
            }
          }}
          onZoomChange={handleZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onAddNode={() => setShowNodePalette(true)}
          onToggleMiniMap={() => setShowMiniMap(!showMiniMap)}
          onRunWorkflow={() => {
            resetExecution();
            setShowRunModal(true);
          }}
          onSave={handleSave}
          showMiniMap={showMiniMap}
        />
      </div>

      {/* Node Palette Modal */}
      <NodePalette
        open={showNodePalette}
        onClose={() => setShowNodePalette(false)}
        onSelectNode={handleAddNode}
      />

      {/* Node Config Drawer */}
      <NodeConfigDrawer
        open={!!selectedNode}
        node={selectedNode}
        workflow={workflow}
        availableModels={availableModels}
        availableTools={availableTools.map(t => ({ id: t.id, name: t.name }))}
        onClose={() => onPaneClick()}
        onUpdateNodeData={handleUpdateNodeData}
        onUpdateNodeLabel={(nodeId, label) => {
          updateNode(nodeId, { data: { ...selectedNode?.data, label } });
        }}
        onDeleteNode={(nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          if (node?.type === 'start' || node?.type === 'end') {
            toast.error('开始和结束节点不可删除');
            return;
          }
          deleteNode(nodeId);
        }}
      />

      {/* Interaction Mode Modal */}
      <InteractionModeModal
        open={showInteractionModal}
        currentMode={interactionMode}
        onSelect={(mode) => {
          setInteractionMode(mode);
          setShowInteractionModal(false);
        }}
        onClose={() => setShowInteractionModal(false)}
      />

      {/* Run Workflow Modal */}
      <RunWorkflowModal
        open={showRunModal}
        workflow={workflow}
        executionResult={executionResult}
        isExecuting={isExecuting}
        onClose={() => setShowRunModal(false)}
        onExecute={handleRunWorkflow}
      />
    </div>
  );
};

export default WorkflowEditorPage;
