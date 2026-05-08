import React, { useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { InteractionMode } from '../hooks/useWorkflowCanvas';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  interactionMode: InteractionMode;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  onNodeClick: (_: any, node: Node) => void;
  onPaneClick: () => void;
  onInit: (instance: any) => void;
  onMoveEnd?: () => void;
  onZoomChange?: (zoom: number) => void;
  showMiniMap: boolean;
  reactFlowInstance?: any;
  onDrop?: (event: React.DragEvent, position: { x: number; y: number }) => void;
}

const dotBackgroundStyle: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  nodeTypes,
  interactionMode,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onInit,
  onMoveEnd,
  onZoomChange,
  showMiniMap,
  reactFlowInstance,
  onDrop,
}) => {
  const isTrackpad = interactionMode === 'trackpad';

  // 仅在初始加载时调整视图，不随节点变化而触发
  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0) {
      // 轻微延迟确保节点已渲染
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
      }, 100);
    }
  }, [reactFlowInstance]); // 只在 reactFlowInstance 初始化时触发

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      // 将屏幕坐标转换为画布坐标
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      onDrop?.(event, position);
    },
    [reactFlowInstance, onDrop]
  );

  return (
    <div className="flex-1 relative overflow-hidden" style={dotBackgroundStyle}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={onInit}
        onMoveEnd={onMoveEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        panOnScroll={isTrackpad}
        zoomOnScroll={!isTrackpad}
        zoomOnPinch={isTrackpad}
        panOnDrag={true}
        minZoom={0.2}
        maxZoom={3}
        preventScrolling={!isTrackpad}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#8392f0', strokeWidth: 2 },
        }}
      >
        <Controls className="!bottom-24 !left-4" />
        {showMiniMap && (
          <MiniMap
            className="!bottom-24 !right-4 !bg-card !border !border-border !rounded-lg !shadow-md"
            nodeStrokeWidth={3}
            zoomable
            pannable
          />
        )}
      </ReactFlow>
    </div>
  );
};
