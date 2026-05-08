import React from 'react';
import {
  MousePointer2,
  MousePointerClick,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  MessageSquare,
  Play,
  Search,
  Save,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export interface CanvasToolbarProps {
  interactionMode: 'mouse' | 'trackpad';
  zoom: number;
  onInteractionModeChange: (mode: 'mouse' | 'trackpad') => void;
  onZoomChange: (zoom: 'fit' | 0.5 | 1 | 2) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onAddNode: () => void;
  onToggleMiniMap: () => void;
  onRunWorkflow: () => void;
  onSave: () => void;
  showMiniMap: boolean;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  interactionMode,
  zoom,
  onInteractionModeChange,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onAddNode,
  onToggleMiniMap,
  onRunWorkflow,
  onSave,
  showMiniMap,
}) => {
  const zoomPercentage = Math.round(zoom * 100);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-2 flex items-center gap-4">
        {/* Left: Interaction mode & Zoom */}
        <div className="flex items-center gap-2">
          <Select
            value={interactionMode}
            onValueChange={(v) => onInteractionModeChange(v as 'mouse' | 'trackpad')}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mouse">
                <div className="flex items-center gap-2">
                  <MousePointer2 className="h-3.5 w-3.5" />
                  <span>鼠标友好</span>
                </div>
              </SelectItem>
              <SelectItem value="trackpad">
                <div className="flex items-center gap-2">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  <span>触控板友好</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Select value={zoom > 0 ? String(Math.round(zoom * 100)) : 'fit'} onValueChange={(v) => {
              if (v === 'fit') {
                onZoomChange('fit');
              } else {
                onZoomChange(Number(v) / 100 as 0.5 | 1 | 2);
              }
            }}>
              <SelectTrigger className="w-[70px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fit">自适应</SelectItem>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
                <SelectItem value="200">200%</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Center: Action buttons */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" title="注释">
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2" title="布局">
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={showMiniMap ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2"
            onClick={onToggleMiniMap}
            title="缩略图"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Right: Add node & Run */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-muted-foreground"
            onClick={() => {}}
          >
            <Search className="h-4 w-4 mr-1.5" />
            搜索
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 bg-[#e0e7ff] hover:bg-[#c7d2fe] text-[#4338ca]"
            onClick={onAddNode}
          >
            + 添加节点
          </Button>
          <Button
            size="sm"
            className="h-8 px-3 bg-[#52c41a] hover:bg-[#52c41a]/90 text-white border-0"
            onClick={onRunWorkflow}
          >
            <Play className="h-4 w-4 mr-1.5" />
            试运行
          </Button>
          <Button
            size="sm"
            className="h-8 px-3 bg-primary hover:bg-primary/90 text-white border-0"
            onClick={onSave}
          >
            <Save className="h-4 w-4 mr-1.5" />
            保存
          </Button>
        </div>
      </div>
    </div>
  );
};
