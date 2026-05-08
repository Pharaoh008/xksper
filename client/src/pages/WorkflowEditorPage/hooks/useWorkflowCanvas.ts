import { useState, useCallback, useRef } from 'react';
import { type Node, type Edge, type Connection, applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react';

export type InteractionMode = 'mouse' | 'trackpad';
export type ZoomLevel = 'fit' | 0.5 | 1 | 2;

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  interactionMode: InteractionMode;
  zoom: number;
}

export function useWorkflowCanvas() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('mouse');
  const [zoom, setZoom] = useState<number>(1);
  const reactFlowInstance = useRef<any>(null);

  const setReactFlowInstance = useCallback((instance: any) => {
    reactFlowInstance.current = instance;
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        animated: true,
        style: { stroke: '#8392f0', strokeWidth: 2 },
      };
      setEdges((eds) => [...eds, newEdge]);
    },
    []
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const addNode = useCallback((node: Node) => {
    setNodes((nds) => [...nds, node]);
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<Node>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, ...updates } : n))
    );
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      )
    );
  }, []);

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
    },
    [selectedNode]
  );

  const setCanvasNodes = useCallback((newNodes: Node[]) => {
    setNodes(newNodes);
  }, []);

  const setCanvasEdges = useCallback((newEdges: Edge[]) => {
    setEdges(newEdges);
  }, []);

  const handleZoom = useCallback((level: ZoomLevel) => {
    if (!reactFlowInstance.current) return;
    
    if (level === 'fit') {
      reactFlowInstance.current.fitView({ padding: 0.2 });
      setZoom(reactFlowInstance.current.getZoom());
    } else {
      reactFlowInstance.current.zoomTo(level);
      setZoom(level);
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!reactFlowInstance.current) return;
    reactFlowInstance.current.zoomIn();
    setZoom(reactFlowInstance.current.getZoom());
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!reactFlowInstance.current) return;
    reactFlowInstance.current.zoomOut();
    setZoom(reactFlowInstance.current.getZoom());
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  return {
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
    setSelectedNode,
    handleZoom,
    handleZoomIn,
    handleZoomOut,
    onZoomChange,
  };
}
