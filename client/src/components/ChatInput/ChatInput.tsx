import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Send, Square, Upload, Mic, MicOff, X, FileText, Image as ImageIcon, Sparkles, Loader2, AlertCircle, BookOpen, Wrench, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import { getDefaultBucketId } from '@lark-apaas/client-toolkit/tools/storage';
import { parseFile } from '@/api/index';

export interface AttachedFile {
  id: string;
  type: 'image' | 'file';
  name: string;
  url: string;
  base64?: string;
  file?: File;
  mimeType?: string;
  parsedContent?: string;
  isParsing?: boolean;
  parseError?: string;
}

export interface MentionItem {
  type: 'knowledge' | 'tool' | 'datasource';
  id: string;
  name: string;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFileUpload: (files: AttachedFile[]) => void;
  attachedFiles: AttachedFile[];
  onRemoveFile: (index: number) => void;
  isLoading?: boolean;
  models?: Array<{ id: string; name: string }>;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  placeholder?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  extraActions?: React.ReactNode;
  onMentionTrigger?: (search: string, cursorPos: number) => void;
  onMentionClose?: () => void;
  mentionSearch?: string;
  mentionInsertIndex?: number;
  mentions?: MentionItem[];
  onAddMention?: (mention: MentionItem) => void;
  onRemoveMention?: (index: number) => void;
  onStop?: () => void;
}

// 文件转为 base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 获取文件图标
const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return <FileText className="h-4 w-4" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="h-4 w-4 text-blue-500" />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText className="h-4 w-4 text-green-500" />;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <FileText className="h-4 w-4 text-orange-500" />;
  return <FileText className="h-4 w-4" />;
};

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onFileUpload,
  attachedFiles,
  onRemoveFile,
  isLoading = false,
  models,
  selectedModel,
  onModelChange,
  placeholder = '输入消息...',
  disabled = false,
  children,
  extraActions,
  onMentionTrigger,
  onMentionClose,
  mentionSearch = '',
  mentionInsertIndex = -1,
  mentions = [],
  onAddMention,
  onRemoveMention,
  onStop,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isComposing, setIsComposing] = useState(false);

  // 处理编辑器输入
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    
    const text = editorRef.current.innerText;
    onChange(text);

    if (onMentionTrigger) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editorRef.current);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      const caretOffset = preCaretRange.toString().length;
      
      const textBeforeCursor = text.slice(0, caretOffset);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtIndex !== -1 && lastAtIndex < caretOffset) {
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n') && textAfterAt.length < 20) {
          onMentionTrigger(textAfterAt, lastAtIndex);
          return;
        }
      }
      onMentionClose?.();
    }
  };

  // 插入mention到编辑器
  const insertMention = (type: 'knowledge' | 'tool' | 'datasource', id: string, name: string) => {
    // 不再往输入框插入文本，而是调用 onAddMention
    if (onAddMention) {
      onAddMention({ type, id, name });
    }
    onMentionClose?.();
    
    // 清除 @ 符号及后面的文本
    const beforeAt = value.slice(0, mentionInsertIndex);
    const afterMention = value.slice(mentionInsertIndex + (mentionSearch?.length || 0) + 1);
    const newText = beforeAt + afterMention;
    onChange(newText);
  };

  // 同步外部value变化到编辑器
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerText !== value) {
        editorRef.current.innerText = value;
      }
    }
  }, [value]);

  // 语音输入
  const startVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('您的浏览器不支持语音输入');
      return;
    }

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition: any = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = (event as any).resultIndex; i < (event as any).results.length; i++) {
        if ((event as any).results[i].isFinal) {
          finalTranscript += (event as any).results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        onChange(value + (value ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      logger.error('语音识别错误:', event.error);
      toast.error('语音识别出错');
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }, [value, onChange]);

  const stopVoiceInput = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  // 文件上传处理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const uploadedFiles: AttachedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');
      const isSupported = isImage || 
        file.type.includes('pdf') ||
        file.type.includes('word') ||
        file.type.includes('excel') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('presentation') ||
        file.type.includes('text') ||
        file.type.includes('csv');

      if (!isSupported) {
        toast.error(`不支持的文件类型: ${file.name}`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const dataloom = await getDataloom();
        const { data, error } = await dataloom.storage.from(getDefaultBucketId()).uploadFile(file);
        if (error || !data) {
          toast.error(`文件 ${file.name} 上传失败`);
          continue;
        }

        const newFile: AttachedFile = {
          id: Math.random().toString(36).substring(7),
          type: isImage ? 'image' : 'file',
          name: file.name,
          url: data.download_url + '?preview=true',
          base64,
          file,
          mimeType: file.type,
          isParsing: !isImage,
        };

        // 对于图片文件，直接添加到上传列表
        // 对于非图片文件，先添加但标记为解析中，解析完成后再更新
        uploadedFiles.push(newFile);

        // 解析非图片文件内容
        if (!isImage) {
          const base64Content = base64.split(',')[1] || base64;
          
          parseFile({
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64Content,
          })
            .then((parsedResult) => {
              // 更新文件的解析内容
              const updatedFile = {
                ...newFile,
                parsedContent: parsedResult.data.content,
                isParsing: false,
              };
              // 更新父组件中对应文件的解析状态
              const updatedFiles = attachedFiles.map(f => 
                f.id === newFile.id ? updatedFile : f
              );
              // 如果文件还不存在（解析很快完成的情况），则添加
              if (!attachedFiles.some(f => f.id === newFile.id)) {
                updatedFiles.push(updatedFile);
              }
              onFileUpload(updatedFiles);
            })
            .catch((err) => {
              logger.error('文件解析失败:', err);
              // 文件仍然可用，只是没有解析内容
              const updatedFile = {
                ...newFile,
                isParsing: false,
                parseError: '解析失败',
              };
              const updatedFiles = attachedFiles.map(f => 
                f.id === newFile.id ? updatedFile : f
              );
              if (!attachedFiles.some(f => f.id === newFile.id)) {
                updatedFiles.push(updatedFile);
              }
              onFileUpload(updatedFiles);
            });
        }
      } catch (err) {
        logger.error('文件上传失败:', err);
        toast.error('文件上传失败');
      }
    }

    // 只上传图片文件立即通知父组件，非图片文件等解析完成后再通知
    const immediateFiles = uploadedFiles.filter(f => f.type === 'image');
    if (immediateFiles.length > 0) {
      onFileUpload([...attachedFiles, ...immediateFiles]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      onSend();
    }
  };

  // 处理粘贴事件（粘贴为纯文本）
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className="w-full">
      {/* 已选择的mention标签 */}
      {mentions.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap px-1">
          {mentions.map((mention, idx) => (
            <div
              key={`${mention.type}-${mention.id}`}
              className="relative group flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-full border border-primary/20 text-primary text-xs"
            >
              {mention.type === 'knowledge' ? (
                <BookOpen className="h-3.5 w-3.5" />
              ) : mention.type === 'tool' ? (
                <Wrench className="h-3.5 w-3.5" />
              ) : (
                <Database className="h-3.5 w-3.5" />
              )}
              <span className="max-w-[120px] truncate">{mention.name}</span>
              {onRemoveMention && (
                <button
                  onClick={() => onRemoveMention(idx)}
                  className="ml-0.5 w-4 h-4 rounded-full hover:bg-primary/20 flex items-center justify-center transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 已上传文件预览 */}
      {attachedFiles.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap px-1">
          {attachedFiles.map((file, idx) => (
            <div
              key={file.id}
              className="relative group flex items-center gap-2 px-3 py-1.5 bg-accent/50 rounded-full border border-border/50 hover:border-primary/30 transition-colors"
            >
              {file.type === 'image' ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-5 h-5 rounded object-cover"
                />
              ) : (
                getFileIcon(file.mimeType)
              )}
              <span className="text-xs text-foreground max-w-[100px] truncate">
                {file.name}
              </span>
              {file.isParsing && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
              {file.parseError && (
                <span title={file.parseError}>
                  <AlertCircle className="h-3 w-3 text-destructive" />
                </span>
              )}
              <button
                onClick={() => onRemoveFile(idx)}
                className="w-4 h-4 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 主输入容器 */}
      <div className="relative bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow">
        {/* 文本输入区 */}
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable={!disabled && !isLoading}
            onInput={handleEditorInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            className="w-full min-h-[90px] max-h-[300px] px-4 py-3.5 bg-transparent border-0 text-sm leading-relaxed placeholder:text-muted-foreground/70 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 outline-none overflow-y-auto"
            data-placeholder={placeholder}
            style={{ wordWrap: 'break-word' }}
          />
          {children}
        </div>

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-border/50 bg-muted/20">
          {/* 左侧功能按钮 */}
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isLoading}
              className="h-8 w-8 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground"
              title="上传文件"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              variant={isRecording ? 'destructive' : 'ghost'}
              size="icon"
              onClick={isRecording ? stopVoiceInput : startVoiceInput}
              disabled={disabled || isLoading}
              className={`h-8 w-8 rounded-full ${
                isRecording 
                  ? 'animate-pulse' 
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`}
              title={isRecording ? '停止录音' : '语音输入'}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>

          {/* 右侧模型选择和发送 */}
          <div className="flex items-center gap-2">
            {/* 模型选择器 */}
            {models && models.length > 0 && (
              <Select value={selectedModel} onValueChange={onModelChange} disabled={disabled || isLoading}>
                <SelectTrigger className="h-8 w-[140px] text-xs border-0 bg-transparent hover:bg-accent/50 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent align="end" className="min-w-[160px]">
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="text-xs">
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* 额外操作按钮（如任务规划） */}
            {extraActions}

            {/* 分隔线 */}
            <div className="w-px h-5 bg-border mx-1" />

            {/* 发送/停止按钮 */}
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isLoading && onStop) {
                  onStop();
                } else {
                  onSend();
                }
              }}
              disabled={(!value.trim() && attachedFiles.length === 0 && !isLoading) || disabled}
              className="h-8 w-8 rounded-full p-0 bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? (
                <Square className="h-4 w-4 fill-current" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
