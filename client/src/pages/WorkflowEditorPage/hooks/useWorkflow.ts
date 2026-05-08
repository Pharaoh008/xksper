import { useCallback, useState } from 'react';
import type { Node, Edge, Connection } from '@xyflow/react';
import { NodeType } from '../constants/nodeTypes';
import type { Workflow, NodeData } from '../types/workflow';
import { logger } from '@lark-apaas/client-toolkit/logger';

// Type assertion helper for NodeData to ensure compatibility with Record<string, unknown>
const toNodeData = (data: NodeData): Record<string, unknown> => data as Record<string, unknown>;

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const createInitialNodes = (): Node[] => [
  {
    id: 'start',
    type: NodeType.START,
    position: { x: 100, y: 300 },
    data: { variables: [] },
  },
  {
    id: 'end',
    type: NodeType.END,
    position: { x: 700, y: 300 },
    data: { outputs: [] },
  },
];

const createInitialEdges = (): Edge[] => [];

interface UseWorkflowReturn {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  workflowName: string;
  workflowDescription: string;
  addNode: (type: string, position: { x: number; y: number }) => void;
  updateNode: (id: string, data: Partial<NodeData>) => void;
  removeNode: (id: string) => void;
  onNodesChange: (changes: unknown[]) => void;
  onEdgesChange: (changes: unknown[]) => void;
  onConnect: (connection: Connection) => void;
  setSelectedNode: (node: Node | null) => void;
  setWorkflowName: (name: string) => void;
  setWorkflowDescription: (desc: string) => void;
  saveWorkflow: () => Promise<void>;
  loadWorkflow: (workflow: Workflow) => void;
  resetWorkflow: () => void;
}

export const useWorkflow = (): UseWorkflowReturn => {
  const [nodes, setNodes] = useState<Node[]>(createInitialNodes());
  const [edges, setEdges] = useState<Edge[]>(createInitialEdges());
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState<string>('未命名工作流');
  const [workflowDescription, setWorkflowDescription] = useState<string>('');

  const addNode = useCallback((type: string, position: { x: number; y: number }) => {
    const newNode: Node = {
      id: generateId(),
      type,
      position,
      data: toNodeData(getInitialNodeData(type)),
    };
    setNodes((prev) => [...prev, newNode]);
  }, []);

  const updateNode = useCallback((id: string, data: Partial<NodeData>) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
    if (selectedNode?.id === id) {
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, ...data } } : null
      );
    }
  }, [selectedNode]);

  const removeNode = useCallback((id: string) => {
    if (id === 'start' || id === 'end') return;
    setNodes((prev) => prev.filter((node) => node.id !== id));
    setEdges((prev) =>
      prev.filter((edge) => edge.source !== id && edge.target !== id)
    );
    if (selectedNode?.id === id) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  const onNodesChange = useCallback((changes: unknown[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onEdgesChange = useCallback((changes: unknown[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((prev) => addEdge(connection, prev));
  }, []);

  const saveWorkflow = useCallback(async () => {
    const workflow: Workflow = {
      id: '',
      name: workflowName,
      description: workflowDescription,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type || 'default',
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    };
    logger.info('Saving workflow:', workflow);
  }, [nodes, edges, workflowName, workflowDescription]);

  const loadWorkflow = useCallback((workflow: Workflow) => {
    setWorkflowName(workflow.name);
    setWorkflowDescription(workflow.description || '');
    setNodes(
      workflow.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: toNodeData(n.data),
      }))
    );
    setEdges(
      workflow.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }))
    );
  }, []);

  const resetWorkflow = useCallback(() => {
    setNodes(createInitialNodes());
    setEdges(createInitialEdges());
    setSelectedNode(null);
    setWorkflowName('未命名工作流');
    setWorkflowDescription('');
  }, []);

  return {
    nodes,
    edges,
    selectedNode,
    workflowName,
    workflowDescription,
    addNode,
    updateNode,
    removeNode,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNode,
    setWorkflowName,
    setWorkflowDescription,
    saveWorkflow,
    loadWorkflow,
    resetWorkflow,
  };
};

function getInitialNodeData(type: string): NodeData {
  switch (type) {
    case NodeType.START:
      return { variables: [] };
    case NodeType.END:
      return { outputs: [] };
    case NodeType.LLM:
      return { model: '', systemPrompt: '', temperature: 0.7, maxTokens: 2048 };
    case NodeType.PLUGIN:
      return { pluginId: '', pluginName: '', config: {} };
    case NodeType.WORKFLOW:
      return { workflowId: '', workflowName: '' };
    case NodeType.CONDITION:
      return { condition: '' };
    case NodeType.LOOP:
      return { loopVariable: '', loopCollection: '' };
    case NodeType.BATCH:
      return { batchSize: 10, parallel: false };
    default:
      return {};
  }
}

function applyNodeChanges(changes: unknown[], nodes: Node[]): Node[] {
  let updatedNodes = [...nodes];
  for (const change of changes) {
    const c = change as { id: string; type: string; [key: string]: unknown };
    if (c.type === 'remove') {
      updatedNodes = updatedNodes.filter((n) => n.id !== c.id);
    } else if (c.type === 'position') {
      updatedNodes = updatedNodes.map((n) =>
        n.id === c.id ? { ...n, position: c.position as { x: number; y: number } } : n
      );
    }
  }
  return updatedNodes;
}

function applyEdgeChanges(changes: unknown[], edges: Edge[]): Edge[] {
  let updatedEdges = [...edges];
  for (const change of changes) {
    const c = change as { id: string; type: string };
    if (c.type === 'remove') {
      updatedEdges = updatedEdges.filter((e) => e.id !== c.id);
    }
  }
  return updatedEdges;
}

function addEdge(connection: Connection, edges: Edge[]): Edge[] {
  const newEdge: Edge = {
    id: `edge_${Date.now()}`,
    source: connection.source!,
    target: connection.target!,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
  };
  return [...edges, newEdge];
}
