import { useState, useEffect, useCallback } from 'react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface MentionResource {
  id: string;
  name: string;
  description?: string;
  type: 'knowledge' | 'tool' | 'datasource';
}

export interface UseMentionResourcesReturn {
  knowledgeBases: MentionResource[];
  tools: MentionResource[];
  dataSources: MentionResource[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMentionResources(): UseMentionResourcesReturn {
  const [knowledgeBases, setKnowledgeBases] = useState<MentionResource[]>([]);
  const [tools, setTools] = useState<MentionResource[]>([]);
  const [dataSources, setDataSources] = useState<MentionResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [kbRes, toolRes, dsRes] = await Promise.all([
        axiosForBackend.get('/api/knowledge').catch(() => ({ data: { items: [] } })),
        axiosForBackend.get('/api/tools').catch(() => ({ data: { items: [] } })),
        axiosForBackend.get('/api/data-sources/active').catch(() => ({ data: [] })),
      ]);

      setKnowledgeBases(
        (kbRes.data.items || []).map((kb: any) => ({
          id: kb.id,
          name: kb.name,
          description: kb.description,
          type: 'knowledge' as const,
        }))
      );

      setTools(
        (toolRes.data || []).map((tool: any) => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          type: 'tool' as const,
        }))
      );

      setDataSources(
        (dsRes.data || []).map((ds: any) => ({
          id: ds.id,
          name: ds.name,
          description: ds.description,
          type: 'datasource' as const,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load resources');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  return {
    knowledgeBases,
    tools,
    dataSources,
    isLoading,
    error,
    refresh: fetchResources,
  };
}
