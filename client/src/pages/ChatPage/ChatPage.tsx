import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTypewriter } from '@/hooks/useTypewriter';
import { Send, Loader2, Bot, User, BookOpen, Wrench, FileText, ChevronDown, ChevronRight, Database, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Streamdown } from '@/components/ui/streamdown';
import { ChatInput, type AttachedFile } from '@/components/ChatInput/ChatInput';
import { sendChat, sendAgentChat, getConfigStatus, generateFile, getMessages } from '@/api/index';
import { useMentionResources } from '@/hooks/useMentionResources';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { Message, MessageContentItem } from '@shared/api.interface';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
const ChatPage: React.FC = () => {
  const location = useLocation();
  const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string}>>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // @ 提及功能
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionInsertIndex, setMentionInsertIndex] = useState(-1);
  // 折叠状态 - 默认折叠
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [dataSourcesExpanded, setDataSourcesExpanded] = useState(false);
  const { knowledgeBases, tools, dataSources } = useMentionResources();
  const [currentMentions, setCurrentMentions] = useState<Array<{ type: 'knowledge' | 'tool' | 'datasource'; id: string; name: string }>>([]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleFileUpload = (newFiles: AttachedFile[]) => {
    setAttachedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 获取启用的模型列表
  useEffect(() => {
    const fetchEnabledModels = async () => {
      try {
        const status = await getConfigStatus();
        if (status.enabledModels && status.availableModels) {
          const enabled = status.availableModels
            .filter((m) => status.enabledModels.includes(m.id))
            .map((m) => ({ id: m.id, name: m.name }));
          setAvailableModels(enabled);
          if (enabled.length > 0 && !selectedModel) {
            setSelectedModel(status.defaultModel && enabled.some(e => e.id === status.defaultModel) 
              ? status.defaultModel 
              : enabled[0].id);
          }
        }
      } catch (err) {
        logger.error('获取启用的模型列表失败', err);
      }
    };
    fetchEnabledModels();
  }, []);

  // 从历史记录加载会话
  useEffect(() => {
    const state = location.state as { conversationId?: string } | null;
    const conversationId = state?.conversationId;

      if (conversationId) {
      const loadConversation = async () => {
        try {
          setIsLoading(true);
          const response = await getMessages(conversationId, 1, 100);
          if (response.items && response.items.length > 0) {
            // 转换消息格式
            const loadedMessages: Message[] = response.items.map((msg) => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              tokenUsage: msg.tokenUsage || 0,
              createdAt: msg.createdAt,
            }));
            setMessages(loadedMessages);
            setCurrentConversationId(conversationId);

            // 从最后一条用户消息加载 mentions
            const lastUserMsg = response.items
              .filter((msg) => msg.role === 'user')
              .pop();
            if (lastUserMsg?.mentions && lastUserMsg.mentions.length > 0) {
              setCurrentMentions(lastUserMsg.mentions);
            }
          }
        } catch (err) {
          logger.error('加载历史会话失败', err);
          toast.error('加载历史会话失败');
        } finally {
          setIsLoading(false);
        }
      };
      loadConversation();
      // 清除location state，避免刷新时重复加载
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);



  // 过滤资源列表
  const filteredKnowledge = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    kb.description?.toLowerCase().includes(mentionSearch.toLowerCase())
  );
  const filteredTools = tools.filter(t =>
    t.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    t.description?.toLowerCase().includes(mentionSearch.toLowerCase())
  );
  const filteredDataSources = dataSources.filter(ds =>
    ds.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    ds.description?.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // 从消息内容中提取 mentions
  const extractMentions = (content: string) => {
    const mentionRegex = /\[@(knowledge|tool|datasource):([^:]+):([^\]]+)\]/g;
    const mentions: Array<{ type: 'knowledge' | 'tool' | 'datasource'; id: string; name: string }> = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push({
        type: match[1] as 'knowledge' | 'tool' | 'datasource',
        id: match[2],
        name: match[3],
      });
    }
    return mentions;
  };

  const handleRemoveMention = (index: number) => {
    setCurrentMentions(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddMention = (mention: { type: 'knowledge' | 'tool' | 'datasource'; id: string; name: string }) => {
    // 检查是否已存在
    if (!currentMentions.some(m => m.type === mention.type && m.id === mention.id)) {
      setCurrentMentions(prev => [...prev, mention]);
    }
    // 清除 @ 符号及后面的文本
    const beforeAt = inputValue.slice(0, mentionInsertIndex);
    const afterMention = inputValue.slice(mentionInsertIndex + mentionSearch.length + 1);
    setInputValue(beforeAt + afterMention);
    setShowMentionPopover(false);
    setMentionSearch('');
  };

  const handleSend = async () => {
    const rawContent = inputValue;
    if ((!rawContent.trim() && attachedFiles.length === 0) || isLoading) return;

    // 构造文件附件信息
    const attachments = attachedFiles.map(f => ({
      fileName: f.name,
      mimeType: f.mimeType || 'application/octet-stream',
      base64Data: f.base64 || '',
    }));

    // 分离图片和其他文件
    const imageFiles = attachedFiles.filter(f => f.type === 'image');
    const otherFiles = attachedFiles.filter(f => f.type !== 'image');

    // 构造消息内容时，添加文件解析内容
    let fileContentText = '';
    const parsedFiles = attachedFiles.filter(f => f.parsedContent);
    if (parsedFiles.length > 0) {
      fileContentText = '\n\n[文件内容]\n' + parsedFiles.map(f => 
        `--- ${f.name} ---\n${f.parsedContent?.slice(0, 5000)}`
      ).join('\n\n');
    }

    let currentContent: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
    if (imageFiles.length > 0) {
      currentContent = [
        { type: 'text' as const, text: (rawContent.trim() || '请分析这些文件') + fileContentText },
        ...imageFiles.map(img => ({ 
          type: 'image_url' as const, 
          image_url: { url: img.base64 || img.url } 
        }))
      ];
    } else {
      currentContent = rawContent.trim() + fileContentText;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: rawContent.trim(),
      imageUrls: imageFiles.map(img => img.url),
      attachments: otherFiles.map(f => ({
        id: f.id,
        name: f.name,
        url: f.url,
        mimeType: f.mimeType,
        parsedContent: f.parsedContent,
      })),
      tokenUsage: 0,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setAttachedFiles([]);
    setIsLoading(true);

    // 创建 AbortController 用于取消请求
    abortControllerRef.current = new AbortController();

    try {
      // 从用户消息中提取纯文本内容
      const userContentText = typeof userMessage.content === 'string' ? userMessage.content : '';

      // 处理历史消息内容（过滤掉file类型，只保留text和image_url）
      const historyMessages: Array<{
        role: 'user' | 'assistant';
        content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
      }> = messages.map((m) => {
        if (typeof m.content === 'string') {
          return { role: m.role, content: m.content };
        }
        const filteredContent = m.content.filter(
          (item) => item.type === 'text' || item.type === 'image_url'
        ) as Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
        return { role: m.role, content: filteredContent };
      });

      // 使用 base64 发送图片给 LLM，避免服务端下载认证问题
      const currentContentWithParsed = imageFiles.length > 0
        ? [
            { type: 'text' as const, text: (userContentText || '请分析这些文件') + fileContentText },
            ...imageFiles.map(img => ({ 
              type: 'image_url' as const, 
              image_url: { url: img.base64 || img.url } 
            }))
          ]
        : userContentText + fileContentText;

      // 提取当前消息中的 mentions
      const mentions = currentMentions;

      const response = await (agentMode ? sendAgentChat : sendChat)({
        model: selectedModel,
        messages: [...historyMessages, { role: 'user', content: currentContentWithParsed, attachments: otherFiles.length > 0 ? attachments : undefined }],
        mentions: mentions.length > 0 ? mentions : undefined,
      }, abortControllerRef.current.signal);

      // 处理文件生成标记
      const handleFileGeneration = async (content: string): Promise<string> => {
        const pattern = /\[FILE:(\w+)(?::([^\]]+))?\]([\s\S]*?)\[\/FILE\]/g;
        let result = content;
        let match;
        let hasFileGeneration = false;

        while ((match = pattern.exec(content)) !== null) {
          const [, type, fileName, fileContent] = match;
          hasFileGeneration = true;

          try {
            const generatedFile = await generateFile({
              type: type.toLowerCase() as 'excel' | 'word' | 'pdf' | 'ppt',
              content: fileContent.trim(),
              options: { fileName: fileName || undefined },
            });

            // 触发下载
            const link = document.createElement('a');
            link.href = `data:${generatedFile.data.mimeType};base64,${generatedFile.data.base64Data}`;
            link.download = generatedFile.data.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success(`文件已生成: ${generatedFile.data.fileName}`);
          } catch (err) {
            logger.error('生成文件失败:', err);
            toast.error('生成文件失败');
          }
        }

        // 移除文件生成标记
        if (hasFileGeneration) {
          result = result.replace(/\[FILE:\w+(?::[^\]]+)?\]([\s\S]*?)\[\/FILE\]/g, '');
        }

        return result;
      };

      // 检查是否为多模态响应（包含图片）
      const isMultimodal = Array.isArray(response.content);

      if (isMultimodal) {
        // 多模态响应（如图片生成）直接显示，不使用打字机效果
        const assistantMessage: Message = {
          id: response.id,
          role: 'assistant',
          content: response.content as MessageContentItem[],
          tokenUsage: response.tokenUsage.totalTokens,
          createdAt: new Date().toISOString(),
          isStreaming: false,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // 纯文本响应使用打字机效果
        const assistantMessage: Message = {
          id: response.id,
          role: 'assistant',
          content: '',
          fullContent: response.content as string,
          tokenUsage: response.tokenUsage.totalTokens,
          createdAt: new Date().toISOString(),
          isStreaming: true,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // 使用打字机效果逐字显示
        const messageId = response.id;
        const fullContent = response.content as string;
        let currentIndex = 0;
        const chunkSize = 3;
        const speed = 12;

        const streamContent = () => {
          if (currentIndex < fullContent.length) {
            const nextIndex = Math.min(currentIndex + chunkSize, fullContent.length);
            const newContent = fullContent.slice(0, nextIndex);
            currentIndex = nextIndex;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? { ...m, content: newContent }
                  : m
              )
            );

            if (currentIndex < fullContent.length) {
              setTimeout(streamContent, speed);
            } else {
              // 内容展示完成后，处理文件生成
              handleFileGeneration(fullContent).then((cleanedContent) => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId
                      ? { ...m, content: cleanedContent, fullContent: cleanedContent, isStreaming: false }
                      : m
                  )
                );
              });
            }
          } else {
            // 内容为空时直接显示
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? { ...m, content: fullContent, isStreaming: false }
                  : m
              )
            );
          }
        };

        // 开始流式显示
        streamContent();
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // 请求被取消，不显示错误
        return;
      }
      logger.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '抱歉，发生了错误，请稍后重试。',
        tokenUsage: 0,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      editorRef.current?.focus();
    }
  };

  // 停止生成
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 获取编辑器原始内容（包括mention的完整格式）
  const getEditorRawContent = () => {
    if (!editorRef.current) return '';
    const spans = editorRef.current.querySelectorAll('[data-mention]');
    let content = editorRef.current.innerText;
    spans.forEach(span => {
      const raw = span.getAttribute('data-raw');
      if (raw) {
        content = content.replace(span.textContent || '', raw);
      }
    });
    return content;
  };

  // 渲染带标签的编辑器内容
  const renderEditorContent = (text: string) => {
    // 解析mention并替换为标签
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    
    // 替换mention为标签
    html = html.replace(/\[@(knowledge|tool|datasource):([^:]+):([^\]]+)\]/g, (match, type, id, name) => {
      const icon = type === 'knowledge' ? '📚' : type === 'tool' ? '🔧' : '🗄️';
      return `<span data-mention="true" data-raw="[@${type}:${id}:${name}]" contenteditable="false" class="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 text-xs font-medium rounded bg-primary/10 text-primary border border-primary/20 cursor-default select-none">${icon} ${name}</span>&nbsp;`;
    });
    
    return html;
  };

  // 处理编辑器输入
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const text = getEditorRawContent();
    setInputValue(text);
    
    // 检测@触发
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
        setMentionSearch(textAfterAt);
        setMentionInsertIndex(lastAtIndex);
        setShowMentionPopover(true);
        return;
      }
    }
    setShowMentionPopover(false);
  };

  // 插入mention
  const insertMentionToEditor = (type: 'knowledge' | 'tool' | 'datasource', id: string, name: string) => {
    const rawText = `[@${type}:${id}:${name}]`;
    const beforeAt = inputValue.slice(0, mentionInsertIndex);
    const afterMention = inputValue.slice(mentionInsertIndex + mentionSearch.length + 1);
    const newText = beforeAt + rawText + afterMention;
    
    setInputValue(newText);
    setShowMentionPopover(false);
    setMentionSearch('');

    // 更新编辑器内容
    if (editorRef.current) {
      editorRef.current.innerHTML = renderEditorContent(newText);
      
      // 将光标移到mention后面
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && editorRef.current) {
          const range = document.createRange();
          const textNodes: Node[] = [];
          const walk = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walk.nextNode())) {
            textNodes.push(node);
          }
          
          let offset = beforeAt.length + rawText.length + 1;
          for (const textNode of textNodes) {
            const textLength = textNode.textContent?.length || 0;
            if (offset <= textLength) {
              range.setStart(textNode, offset);
              range.setEnd(textNode, offset);
              selection.removeAllRanges();
              selection.addRange(range);
              break;
            }
            offset -= textLength;
          }
        }
      }, 0);
    }
  };


  const renderMultimodalContent = (
    content: string | MessageContentItem[],
    role: 'user' | 'assistant',
    isStreaming?: boolean
  ) => {
    // 用户消息直接显示文本
    if (role === 'user') {
      return <p className="whitespace-pre-wrap">{typeof content === 'string' ? content : content.map(item => item.type === 'text' ? item.text : '').join('')}</p>;
    }

    // AI 消息支持多模态
    if (typeof content === 'string') {
      return (
        <div className="relative">
          <Streamdown>{content}</Streamdown>
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {content.map((item, idx) => {
          if (item.type === 'text') {
            return (
              <div key={idx} className="relative">
                <Streamdown>{item.text}</Streamdown>
                {isStreaming && idx === content.length - 1 && (
                  <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
                )}
              </div>
            );
          }
          if (item.type === 'image_url') {
            return (
              <img
                key={idx}
                src={item.image_url.url}
                alt="AI生成的图片"
                className="max-w-full h-auto rounded-md"
                loading="lazy"
              />
            );
          }
          return null;
        })}
      </div>
    );
  };

  const renderMessageContent = (message: Message) => {
    return renderMultimodalContent(message.content, message.role, message.isStreaming);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* 对话展示区 */}
      <ScrollArea className="flex-1 h-full overflow-hidden mb-4 pr-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 text-primary/50" />
              <p className="text-lg font-medium">开始对话</p>
              <p className="text-sm mt-1">输入消息或上传图片开始对话</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  {message.imageUrls && message.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {message.imageUrls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`附件 ${idx + 1}`}
                          className="max-w-[200px] max-h-[200px] rounded-md object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {message.attachments.map((att, idx) => (
                        <UniversalLink
                          key={idx}
                          to={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-background/50 rounded-md text-sm hover:bg-background/70 transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                          <span className="max-w-[150px] truncate">{att.name}</span>
                        </UniversalLink>
                      ))}
                    </div>
                  )}
                  {renderMessageContent(message)}
                  {message.tokenUsage > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/20 text-xs opacity-60 font-mono">
                      Token: {message.tokenUsage}
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div className="max-w-[85%] rounded-lg px-4 py-3 bg-card border border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{agentMode ? 'LangGraph Agent 正在 ReAct 推理...' : 'AI 正在思考...'}</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 输入区 */}
      <div className="shrink-0 pt-4 border-t border-border bg-background">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onStop={handleStop}
          onFileUpload={handleFileUpload}
          attachedFiles={attachedFiles}
          onRemoveFile={removeFile}
          isLoading={isLoading}
          models={availableModels}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          placeholder="输入消息... (使用 @ 引用知识库或工具)"
          onMentionTrigger={(search, cursorPos) => {
            setMentionSearch(search);
            setMentionInsertIndex(cursorPos);
            setShowMentionPopover(true);
          }}
          onMentionClose={() => setShowMentionPopover(false)}
          mentionSearch={mentionSearch}
          mentionInsertIndex={mentionInsertIndex}
          mentions={currentMentions}
          onRemoveMention={(index) => {
            setCurrentMentions(prev => prev.filter((_, i) => i !== index));
          }}
          onAddMention={handleAddMention}
          extraActions={
            <Button
              type="button"
              variant={agentMode ? 'default' : 'outline'}
              size="icon"
              onClick={() => setAgentMode((enabled) => !enabled)}
              title={agentMode ? '已开启 LangGraph ReAct Agent' : '开启 LangGraph ReAct Agent'}
              className="h-8 w-8"
            >
              <ListTodo className="h-4 w-4" />
            </Button>
          }
        >
          {/* @ 提及选择器 */}
          {showMentionPopover && (
            <div className="absolute bottom-full left-0 mb-3 w-[360px] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              {/* 搜索框 */}
              <div className="p-3 border-b border-border bg-muted/30">
                <div className="relative">
                  <Input
                    placeholder="搜索知识库或工具..."
                    value={mentionSearch}
                    onChange={(e) => setMentionSearch(e.target.value)}
                    autoFocus
                    className="h-9 text-sm pl-9 bg-background"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              {/* 列表内容 */}
              <div className="max-h-[320px] overflow-y-auto">
                <div className="p-2">
                  {filteredKnowledge.length === 0 && filteredTools.length === 0 && filteredDataSources.length === 0 ? (
                    <div className="py-8 text-center">
                      <svg className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-muted-foreground">未找到匹配的资源</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* 知识库列表 */}
                      {filteredKnowledge.length > 0 && (
                        <div className="border border-border/50 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setKnowledgeExpanded(!knowledgeExpanded)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-semibold text-foreground">知识库</span>
                              <span className="text-[10px] font-medium text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full">{filteredKnowledge.length}</span>
                            </div>
                            {knowledgeExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          {knowledgeExpanded && (
                            <div className="p-1.5 space-y-0.5">
                              {filteredKnowledge.map((kb) => (
                                <button
                                  key={kb.id}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddMention({ type: 'knowledge', id: kb.id, name: kb.name });
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/80 rounded-md transition-colors text-left group"
                                >
                                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate text-xs">{kb.name}</p>
                                    {kb.description && (
                                      <p className="text-[10px] text-muted-foreground truncate">{kb.description}</p>
                                    )}
                                  </div>
                                  <svg className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* 工具列表 */}
                      {filteredTools.length > 0 && (
                        <div className="border border-border/50 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setToolsExpanded(!toolsExpanded)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Wrench className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-semibold text-foreground">工具</span>
                              <span className="text-[10px] font-medium text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full">{filteredTools.length}</span>
                            </div>
                            {toolsExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          {toolsExpanded && (
                            <div className="p-1.5 space-y-0.5">
                              {filteredTools.map((tool) => (
                                <button
                                  key={tool.id}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddMention({ type: 'tool', id: tool.id, name: tool.name });
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/80 rounded-md transition-colors text-left group"
                                >
                                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Wrench className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate text-xs">{tool.name}</p>
                                    {tool.description && (
                                      <p className="text-[10px] text-muted-foreground truncate">{tool.description}</p>
                                    )}
                                  </div>
                                  <svg className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* 数据源列表 */}
                      {filteredDataSources.length > 0 && (
                        <div className="border border-border/50 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setDataSourcesExpanded(!dataSourcesExpanded)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Database className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-semibold text-foreground">数据源</span>
                              <span className="text-[10px] font-medium text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full">{filteredDataSources.length}</span>
                            </div>
                            {dataSourcesExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          {dataSourcesExpanded && (
                            <div className="p-1.5 space-y-0.5">
                              {filteredDataSources.map((ds) => (
                                <button
                                  key={ds.id}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddMention({ type: 'datasource', id: ds.id, name: ds.name });
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/80 rounded-md transition-colors text-left group"
                                >
                                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Database className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate text-xs">{ds.name}</p>
                                    {ds.description && (
                                      <p className="text-[10px] text-muted-foreground truncate">{ds.description}</p>
                                    )}
                                  </div>
                                  <svg className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ChatInput>
      </div>
    </div>
  );
};

export default ChatPage;
