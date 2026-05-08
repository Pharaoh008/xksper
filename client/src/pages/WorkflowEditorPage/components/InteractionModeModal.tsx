import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mouse, Hand } from 'lucide-react';

interface InteractionModeModalProps {
  open: boolean;
  currentMode: 'mouse' | 'trackpad';
  onSelect: (mode: 'mouse' | 'trackpad') => void;
  onClose: () => void;
}

export const InteractionModeModal: React.FC<InteractionModeModalProps> = ({
  open,
  currentMode,
  onSelect,
  onClose,
}) => {
  const modes = [
    {
      value: 'mouse' as const,
      icon: Mouse,
      title: '鼠标友好模式',
      description: '鼠标左键拖动画布，滚轮缩放',
    },
    {
      value: 'trackpad' as const,
      icon: Hand,
      title: '触控板友好模式',
      description: '双指同向移动拖动，双指张开捏合缩放',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>选择交互模式</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isSelected = currentMode === mode.value;

            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => {
                  onSelect(mode.value);
                  onClose();
                }}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-accent'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-medium mb-1 ${
                        isSelected ? 'text-primary' : ''
                      }`}
                    >
                      {mode.title}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {mode.description}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                      <svg
                        className="h-4 w-4 text-primary-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          您可以在画布工具栏中随时切换交互模式
        </p>
      </DialogContent>
    </Dialog>
  );
};
