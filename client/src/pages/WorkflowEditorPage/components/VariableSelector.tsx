import React from 'react';
import { ChevronRight } from 'lucide-react';

interface VariableSelectorProps {
  variables: Array<{ name: string; source: string; type?: string }>;
  onSelect: (variable: string) => void;
}

export const VariableSelector: React.FC<VariableSelectorProps> = ({
  variables,
  onSelect,
}) => {
  if (variables.length === 0) {
    return (
      <span className="text-sm text-muted-foreground italic">无可用变量</span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground mb-1">选择变量:</div>
      <div className="flex flex-wrap gap-1">
        {variables.map((variable, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(`{{${variable.source}}}`)}
            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md font-mono hover:bg-primary/20 transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
            <span>{variable.name}</span>
            {variable.type && (
              <span className="text-primary/60">:{variable.type}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
