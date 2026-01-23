import React, { useEffect, useCallback } from 'react';
import { Annotation } from '../types';

export interface SpeckitFileMapping {
  filePath: string;
  startOffset: number;
  endOffset: number;
}

interface SpeckitFileTreeProps {
  files: SpeckitFileMapping[];
  activeFileIndex: number;
  onSelectFile: (index: number) => void;
  annotations: Annotation[];
  enableKeyboardNav?: boolean;
  featureName?: string;
}

/**
 * Get a display label for a spec file path
 */
function getFileLabel(filePath: string): string {
  // Extract filename from path
  const fileName = filePath.split('/').pop() || filePath;

  // Map common spec files to readable labels
  const labelMap: Record<string, string> = {
    'constitution.md': 'Constitution',
    'spec.md': 'Specification',
    'plan.md': 'Technical Plan',
    'tasks.md': 'Tasks',
    'research.md': 'Research',
    'data-model.md': 'Data Model',
    'quickstart.md': 'Quick Start',
  };

  if (labelMap[fileName]) {
    return labelMap[fileName];
  }

  // For contract files, show the contract name
  if (filePath.includes('contracts/')) {
    return fileName.replace('.md', '');
  }

  return fileName;
}

/**
 * Get an icon for a spec file type
 */
function getFileIcon(filePath: string): React.ReactNode {
  const fileName = filePath.split('/').pop() || '';

  if (fileName === 'constitution.md' || filePath.includes('memory/')) {
    // Book/scroll icon for constitution
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    );
  }

  if (fileName === 'spec.md') {
    // Document icon for spec
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }

  if (fileName === 'plan.md') {
    // Map/route icon for plan
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    );
  }

  if (fileName === 'tasks.md') {
    // Checklist icon for tasks
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  if (fileName === 'research.md') {
    // Magnifying glass icon for research
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    );
  }

  if (fileName === 'data-model.md') {
    // Database icon for data model
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    );
  }

  if (filePath.includes('contracts/')) {
    // Code bracket icon for contracts
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    );
  }

  // Default document icon
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

export const SpeckitFileTree: React.FC<SpeckitFileTreeProps> = ({
  files,
  activeFileIndex,
  onSelectFile,
  annotations,
  enableKeyboardNav = true,
  featureName,
}) => {
  // Keyboard navigation: j/k or arrow keys
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enableKeyboardNav) return;

    // Don't interfere with input fields
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(activeFileIndex + 1, files.length - 1);
      onSelectFile(nextIndex);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(activeFileIndex - 1, 0);
      onSelectFile(prevIndex);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSelectFile(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSelectFile(files.length - 1);
    }
  }, [enableKeyboardNav, activeFileIndex, files.length, onSelectFile]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Get annotation count for content in a file's range
  const getAnnotationCount = (file: SpeckitFileMapping) => {
    // Count annotations that don't have a specific file association
    // In speckit mode, annotations are on the combined document
    // For now, just show total annotations for the active file
    return 0; // TODO: could track annotations per section if needed
  };

  // Group files by category
  const constitutionFiles = files.filter(f => f.filePath.includes('memory/') || f.filePath.includes('constitution'));
  const mainSpecFiles = files.filter(f =>
    !f.filePath.includes('memory/') &&
    !f.filePath.includes('constitution') &&
    !f.filePath.includes('contracts/')
  );
  const contractFiles = files.filter(f => f.filePath.includes('contracts/'));

  const renderFileItem = (file: SpeckitFileMapping, globalIndex: number) => {
    const isActive = globalIndex === activeFileIndex;
    const label = getFileLabel(file.filePath);
    const icon = getFileIcon(file.filePath);
    const annotationCount = getAnnotationCount(file);

    return (
      <button
        key={file.filePath}
        onClick={() => onSelectFile(globalIndex)}
        className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-all flex items-center gap-2 group ${
          isActive
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <span className={`flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
          {icon}
        </span>
        <span className="truncate flex-1">{label}</span>
        {annotationCount > 0 && (
          <span className="text-primary font-medium text-[10px] bg-primary/10 px-1.5 py-0.5 rounded">
            {annotationCount}
          </span>
        )}
      </button>
    );
  };

  // Calculate global indices for each file
  let globalIndex = 0;
  const constitutionIndices = constitutionFiles.map(() => globalIndex++);
  const mainSpecIndices = mainSpecFiles.map(() => globalIndex++);
  const contractIndices = contractFiles.map(() => globalIndex++);

  return (
    <aside className="w-56 border-r border-border bg-card/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Spec Files
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {files.length}
          </span>
        </div>
        {featureName && (
          <div className="mt-1.5 text-[10px] text-muted-foreground/70 truncate" title={featureName}>
            {featureName}
          </div>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Constitution section */}
        {constitutionFiles.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">
              Project
            </div>
            <div className="space-y-0.5">
              {constitutionFiles.map((file, idx) => renderFileItem(file, constitutionIndices[idx]))}
            </div>
          </div>
        )}

        {/* Main spec files section */}
        {mainSpecFiles.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">
              Specification
            </div>
            <div className="space-y-0.5">
              {mainSpecFiles.map((file, idx) => renderFileItem(file, mainSpecIndices[idx]))}
            </div>
          </div>
        )}

        {/* Contract files section */}
        {contractFiles.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">
              Contracts
            </div>
            <div className="space-y-0.5">
              {contractFiles.map((file, idx) => renderFileItem(file, contractIndices[idx]))}
            </div>
          </div>
        )}
      </div>

      {/* Footer with keyboard nav hint */}
      {enableKeyboardNav && (
        <div className="p-3 border-t border-border/50">
          <div className="text-[10px] text-muted-foreground/50 text-center">
            j/k or arrows to navigate
          </div>
        </div>
      )}
    </aside>
  );
};
