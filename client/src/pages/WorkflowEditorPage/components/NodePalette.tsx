import React, { useState, useMemo } from 'react';
import {
  Search,
  Play,
  Bot,
  Plug,
  Code,
  GitBranch,
  Repeat,
  Layers,
  Workflow as WorkflowIcon,
  CheckCircle,
  StickyNote,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { NodeType } from '@shared/api.interface';

export interface NodePaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectNode: (type: NodeType) => void;
}

interface NodeCategory {
  title: string;
  nodes: Array<{
    type: NodeType;
    label: string;
    icon: React.ReactNode;
    color: string;
    description?: string;
  }>;
}

const NODE_CATEGORIES: NodeCategory[] = [
  {
    title: '基础',
    nodes: [
      { type: 'llm', label: '大模型', icon: <Bot className="h-5 w-5" />, color: '#1f2937', description: '调用大语言模型' },
      { type: 'plugin', label: '插件', icon: <Plug className="h-5 w-5" />, color: '#8b5cf6', description: '调用第三方插件' },
      { type: 'workflow', label: '工作流', icon: <WorkflowIcon className="h-5 w-5" />, color: '#22c55e', description: '调用子工作流' },
    ],
  },
  {
    title: '业务逻辑',
    nodes: [
      { type: 'code', label: '代码', icon: <Code className="h-5 w-5" />, color: '#10b981', description: '执行自定义代码' },
      { type: 'condition', label: '选择器', icon: <GitBranch className="h-5 w-5" />, color: '#f59e0b', description: '条件分支判断' },
      { type: 'loop', label: '循环', icon: <Repeat className="h-5 w-5" />, color: '#ef4444', description: '循环执行任务' },
      { type: 'batch', label: '批处理', icon: <Layers className="h-5 w-5" />, color: '#06b6d4', description: '批量处理数据' },
    ],
  },
  {
    title: '输入输出',
    nodes: [
      { type: 'start', label: '开始', icon: <Play className="h-5 w-5" />, color: '#3b82f6', description: '工作流入口' },
      { type: 'end', label: '结束', icon: <CheckCircle className="h-5 w-5" />, color: '#3b82f6', description: '工作流出口' },
    ],
  },
  {
    title: '数据处理',
    nodes: [
      { type: 'text', label: '文本处理', icon: <FileText className="h-5 w-5" />, color: '#ec4899', description: '文本转换处理' },
      { type: 'annotation', label: '注释', icon: <StickyNote className="h-5 w-5" />, color: '#fbbf24', description: '添加说明注释' },
    ],
  },
];

export const NodePalette: React.FC<NodePaletteProps> = ({
  open,
  onClose,
  onSelectNode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return NODE_CATEGORIES;
    }

    const query = searchQuery.toLowerCase();
    return NODE_CATEGORIES
      .map((category) => ({
        ...category,
        nodes: category.nodes.filter(
          (node) =>
            node.label.toLowerCase().includes(query) ||
            node.description?.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.nodes.length > 0);
  }, [searchQuery]);

  const handleSelectNode = (type: NodeType) => {
    onSelectNode(type);
    onClose();
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索节点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto p-4">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              未找到匹配的节点
            </div>
          ) : (
            <div className="space-y-6">
              {filteredCategories.map((category) => (
                <div key={category.title}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {category.title}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {category.nodes.map((node) => (
                      <div
                        key={node.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/reactflow', node.type);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => handleSelectNode(node.type)}
                        className="flex items-start gap-3 p-3 rounded-lg border border-[#e8efff] hover:border-primary/50 hover:bg-accent/50 transition-colors text-left cursor-pointer"
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                          style={{ backgroundColor: `${node.color}15` }}
                        >
                          <span style={{ color: node.color }}>{node.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{node.label}</div>
                          {node.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {node.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
