import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { NodeType, VariableReference } from '@shared/api.interface';

interface CustomNodeData extends Record<string, unknown> {
  label: string;
  nodeType: NodeType;
  config: Record<string, unknown>;
}

/**
 * Collects all available upstream variables for a given node.
 * An upstream variable is a variable produced by a node that connects to the target node.
 */
export function useVariableContext(
  nodes: Node[],
  edges: Edge[],
  currentNodeId?: string
) {
  const availableVariables = useMemo(() => {
    if (!currentNodeId) return [];

    const variables: Array<{
      name: string;
      source: string;
      type?: string;
      nodeId: string;
      outputName?: string;
    }> = [];

    const visitedNodes = new Set<string>();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const collectVariables = (nodeId: string) => {
      if (visitedNodes.has(nodeId)) return;
      visitedNodes.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) return;

      const nodeData = node.data as CustomNodeData;
      const nodeType = nodeData?.nodeType;

      if (nodeType === 'start') {
        const variables_config = nodeData.config?.variables as Array<{
          name: string;
          type: string;
          description?: string;
          required?: boolean;
        }>;
        if (variables_config) {
          variables_config.forEach((v) => {
            variables.push({
              name: `${nodeData.label}.${v.name}`,
              source: `${nodeId}.${v.name}`,
              type: v.type,
              nodeId,
              outputName: v.name,
            });
          });
        }
      }

      if (nodeType === 'llm') {
        const outputVar = nodeData.config?.outputVariable as string;
        if (outputVar) {
          variables.push({
            name: `${nodeData.label}.${outputVar}`,
            source: `${nodeId}.${outputVar}`,
            type: 'string',
            nodeId,
            outputName: outputVar,
          });
        }
      }

      if (nodeType === 'code') {
        const outputVar = nodeData.config?.outputVariable as string;
        if (outputVar) {
          variables.push({
            name: `${nodeData.label}.${outputVar}`,
            source: `${nodeId}.${outputVar}`,
            type: 'any',
            nodeId,
            outputName: outputVar,
          });
        }
      }

      if (nodeType === 'condition') {
        const branches = nodeData.config?.conditions as Array<{
          id: string;
          label: string;
          condition: string;
        }>;
        if (branches) {
          branches.forEach((branch) => {
            variables.push({
              name: `${nodeData.label}.${branch.label}`,
              source: `${nodeId}.${branch.label}`,
              type: 'boolean',
              nodeId,
              outputName: branch.label,
            });
          });
        }
      }

      if (nodeType === 'loop') {
        const outputVar = nodeData.config?.outputVariable as string;
        if (outputVar) {
          variables.push({
            name: `${nodeData.label}.${outputVar}`,
            source: `${nodeId}.${outputVar}`,
            type: 'any',
            nodeId,
            outputName: outputVar,
          });
        }
      }

      if (nodeType === 'batch') {
        const outputVar = nodeData.config?.outputVariable as string;
        if (outputVar) {
          variables.push({
            name: `${nodeData.label}.${outputVar}`,
            source: `${nodeId}.${outputVar}`,
            type: 'array',
            nodeId,
            outputName: outputVar,
          });
        }
      }

      if (nodeType === 'text') {
        const operations = nodeData.config?.operations as Array<{
          type: string;
          value?: string;
          resultVar?: string;
        }>;
        if (operations) {
          operations.forEach((op) => {
            if (op.resultVar) {
              variables.push({
                name: `${nodeData.label}.${op.resultVar}`,
                source: `${nodeId}.${op.resultVar}`,
                type: 'string',
                nodeId,
                outputName: op.resultVar,
              });
            }
          });
        }
      }

      if (nodeType === 'end') {
        const outputs = nodeData.config?.outputs as Array<{
          name: string;
          source: string;
        }>;
        if (outputs) {
          outputs.forEach((output) => {
            variables.push({
              name: `${nodeData.label}.${output.name}`,
              source: output.source,
              type: 'any',
              nodeId,
              outputName: output.name,
            });
          });
        }
      }
    };

    const findUpstreamNodes = (targetId: string): string[] => {
      const upstream: string[] = [];

      edges.forEach((edge) => {
        if (edge.target === targetId && edge.source) {
          upstream.push(edge.source);
          upstream.push(...findUpstreamNodes(edge.source));
        }
      });

      return upstream;
    };

    const upstreamNodeIds = findUpstreamNodes(currentNodeId);
    upstreamNodeIds.forEach((nodeId) => collectVariables(nodeId));

    return variables;
  }, [nodes, edges, currentNodeId]);

  const getVariableByReference = (
    reference: string
  ): {
    name: string;
    source: string;
    type?: string;
    nodeId: string;
    outputName?: string;
  } | undefined => {
    const cleanRef = reference.replace(/^\{\{|\}\}$/g, '');
    return availableVariables.find((v) => v.source === cleanRef);
  };

  const formatVariableReference = (name: string, source: string): string => {
    return `{{${source}}}`;
  };

  return {
    availableVariables,
    getVariableByReference,
    formatVariableReference,
  };
}
