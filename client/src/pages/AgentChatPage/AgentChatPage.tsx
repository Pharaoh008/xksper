import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Loader2, Bot, User, ArrowLeft, BookOpen, Wrench, CheckCircle, Circle, AlertCircle, Play, ListTodo, FileText, ChevronDown, ChevronRight, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Streamdown } from '@/components/ui/streamdown';
import { ChatInput, type AttachedFile } from '@/components/ChatInput/ChatInput';
import { getAgent, chatWithAgent, executeAgent, getExecutionDetail, getExecutionSubTasks, generateFile } from '@/api';
import { getConfigStatus } from '@/api/index';
import { useMentionResources } from '@/hooks/useMentionResources';
import type { AgentConfig, ModelPricing, TaskPlan, SubTask, MessageContentItem } from '@shared/api.interface';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string | MessageContentItem[];
  imageUrls?: string[];
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    mimeType?: string;
    parsedContent?: string;
  }>;
  createdAt: string;
  isStreaming?: boolean;
  fullContent?: string;
}

interface Mention {
  type: 'knowledge' | 'tool' | 'datasource';
  id: string;
  name: string;
}

const AgentChatPage: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [models, setModels] = useState<ModelPricing[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // @ 提及功能
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionInsertIndex, setMentionInsertIndex] = useState(-1);
  // 折叠状态 - 默认折叠
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [dataSourcesExpanded, setDataSourcesExpanded] = useState(false);
  const { knowledgeBases, tools, dataSources } = useMentionResources();
  const [currentMentions, setCurrentMentions] = useState<Mention[]>([]);

  // 任务拆解功能（默认关闭，用户手动开启）
  const [enablePlanning, setEnablePlanning] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<TaskPlan | null>(null);
  const [executingTasks, setExecutingTasks] = useState<SubTask[]>([]);
  const [isExecutingPlan, setIsExecutingPlan] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    // 获取启用的模型列表
    getConfigStatus()
      .then((configStatus) => {
        // 从 availableModels 中过滤出 enabledModels 包含的模型
        const enabledModelIds = new Set(configStatus.enabledModels);
        const enabledModelsList = configStatus.availableModels.filter((model) =>
          enabledModelIds.has(model.id)
        );
        setModels(enabledModelsList);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (agentId) {
      getAgent(agentId).then((data) => {
        if (data) {
          setAgent(data);
          const savedModel = localStorage.getItem(`agent-model-${agentId}`);
          setSelectedModel(savedModel || data.model || '');
          if (data.greeting) {
            setMessages([
              {
                id: 'greeting',
                role: 'assistant',
                content: data.greeting,
                createdAt: new Date().toISOString(),
              },
            ]);
          }
        } else {
          toast.error('Agent不存在');
          navigate('/agent');
        }
      }).catch((err) => {
        logger.error('获取Agent失败', err);
        navigate('/agent');
      });
    }
  }, [agentId, navigate]);

  const handleFileUpload = (newFiles: AttachedFile[]) => {
    setAttachedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!inputValue.trim() && attachedFiles.length === 0) return;
    if (!selectedModel) {
      toast.error('请选择模型');
      return;
    }

    // 分离图片和其他文件
    const imageFiles = attachedFiles.filter(f => f.type === 'image');
    const otherFiles = attachedFiles.filter(f => f.type === 'file');

    // 构造消息内容时，添加文件解析内容
    let fileContentText = '';
    const parsedFiles = attachedFiles.filter(f => f.parsedContent);
    if (parsedFiles.length > 0) {
      fileContentText = '\n\n[文件内容]\n' + parsedFiles.map(f => 
        `--- ${f.name} ---\n${f.parsedContent?.slice(0, 5000)}`
      ).join('\n\n');
    }

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim() + fileContentText,
      imageUrls: imageFiles.map((img) => img.url),
      attachments: otherFiles.map(f => ({
        id: f.id,
        name: f.name,
        url: f.url,
        mimeType: f.mimeType,
        parsedContent: f.parsedContent,
      })),
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

      // 处理历史消息内容
      const getHistoryContent = (msg: DisplayMessage) => {
        if (typeof msg.content === 'string') {
          return msg.content;
        }
        return msg.content;
      };

      const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = messages
        .filter((m) => m.id !== 'greeting' && typeof m.content === 'string')
        .slice(-20)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: typeof m.content === 'string' ? m.content : '',
        }));

      // 使用 base64 发送图片给 LLM，避免服务端下载认证问题
      const currentContent = imageFiles.length > 0
        ? [
            { type: 'text' as const, text: userContentText || '请分析这些文件' },
            ...imageFiles.map(img => ({ 
              type: 'image_url' as const, 
              image_url: { url: img.base64 || img.url } 
            }))
          ]
        : userContentText;

      // 根据是否启用任务拆解选择处理方式
      if (enablePlanning) {
        await handleExecuteWithPlanning(userContentText);
      } else {
        // 使用 LangGraph 驱动的 Agent 对话
        const chatMessages = [
          ...historyMessages,
          { role: 'user' as const, content: userContentText },
        ];

        const mentions = currentMentions;
        const response = await chatWithAgent(agentId!, chatMessages, mentions, abortControllerRef.current?.signal);

        // 处理工具调用显示
        const toolCallInfo = response.toolCalls && response.toolCalls.length > 0
          ? `\n\n*使用了工具: ${response.toolCalls.join(', ')}*`
          : '';
        const fullContent = response.content || '暂无回复内容';
        const displayContent = fullContent + toolCallInfo;

        // 创建流式消息
        const assistantMessage: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: '',
          fullContent: displayContent,
          createdAt: new Date().toISOString(),
          isStreaming: true,
        };

        setMessages((prev) => [...prev, assistantMessage]);

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

        // 使用打字机效果逐字显示
        const messageId = assistantMessage.id;
        let currentIndex = 0;
        const chunkSize = 3;
        const speed = 12;

        const streamContent = () => {
          if (currentIndex < displayContent.length) {
            const nextIndex = Math.min(currentIndex + chunkSize, displayContent.length);
            const newContent = displayContent.slice(0, nextIndex);
            currentIndex = nextIndex;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? { ...m, content: newContent }
                  : m
              )
            );

            if (currentIndex < displayContent.length) {
              setTimeout(streamContent, speed);
            } else {
              // 内容展示完成后，处理文件生成
              handleFileGeneration(displayContent).then((cleanedContent) => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId
                      ? { ...m, content: cleanedContent, isStreaming: false }
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
                  ? { ...m, content: displayContent, isStreaming: false }
                  : m
              )
            );
          }
        };

        streamContent();
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 请求被取消，不显示错误
        return;
      }
      logger.error('发送消息失败', err);
      const errorMessage = (err as Error)?.message || '';
      if (errorMessage.includes('API配置无效') || errorMessage.includes('API Key')) {
        toast.error('API 配置无效，请前往配置管理页面检查 API Key');
      } else if (errorMessage.includes('超时')) {
        toast.error('请求超时，请稍后重试');
      } else if (errorMessage.includes('Agent 已禁用')) {
        toast.error('该 Agent 已禁用，请联系管理员');
      } else {
        toast.error('发送消息失败，请重试');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 停止生成
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  // 执行带任务拆解的 Agent 对话（异步轮询模式）
  const handleExecuteWithPlanning = async (userContentText: string) => {
    if (!agentId || !selectedModel) return;

    setIsExecutingPlan(true);
    setCurrentPlan(null);
    setExecutingTasks([]);

    // 创建任务计划消息
    const planMessage: DisplayMessage = {
      id: `plan-${Date.now()}`,
      role: 'assistant',
      content: '正在分析任务并制定执行计划...',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, planMessage]);

    try {
      // 调用 executeAgent，获取 executionId 后立即返回
      const response = await executeAgent(agentId, {
        query: userContentText,
        enablePlanning: true,
      });

      const executionId = response.executionId;

      // 如果后端直接返回了完整结果（同步模式），使用旧逻辑
      if (response.status === 'completed' && response.finalResponse) {
        // 更新任务计划
        if (response.plan) {
          setCurrentPlan(response.plan);
          setExecutingTasks(response.plan.tasks.map(task => ({ ...task })));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === planMessage.id
                ? { ...m, content: '任务计划已制定，正在执行...' }
                : m
            )
          );
        }

        // 创建结果消息
        const resultMessage: DisplayMessage = {
          id: `result-${Date.now()}`,
          role: 'assistant',
          content: '',
          fullContent: response.finalResponse,
          createdAt: new Date().toISOString(),
          isStreaming: true,
        };
        setMessages((prev) => [...prev, resultMessage]);

        // 更新计划消息状态为完成
        if (response.plan) {
          setExecutingTasks((prev) =>
            prev.map((task) => ({ ...task, status: 'completed' as const }))
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === planMessage.id
                ? { ...m, content: '所有任务已完成，正在整合结果...' }
                : m
            )
          );
        }

        // 打字机效果
        const messageId = resultMessage.id;
        const fullContent = response.finalResponse || '';
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
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId
                    ? { ...m, content: fullContent, isStreaming: false }
                    : m
                )
              );
              setIsExecutingPlan(false);
              setCurrentPlan(null);
              setExecutingTasks([]);
            }
          }
        };

        streamContent();
        return;
      }

      // 异步轮询模式：任务正在运行中
      // 创建结果消息占位
      const resultMessage: DisplayMessage = {
        id: `result-${Date.now()}`,
        role: 'assistant',
        content: '',
        fullContent: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, resultMessage]);

      // 更新计划消息状态
      setMessages((prev) =>
        prev.map((m) =>
          m.id === planMessage.id
            ? { ...m, content: '任务计划已制定，正在执行...' }
            : m
        )
      );

      // 设置轮询定时器
      let accumulatedContent = '';
      const pollInterval = setInterval(async () => {
        try {
          // 获取任务状态
          const executionDetail = await getExecutionDetail(executionId);

          if (!executionDetail) {
            clearInterval(pollInterval);
            toast.error('获取任务状态失败');
            setIsExecutingPlan(false);
            setExecutingTasks((prev) =>
              prev.map((task) =>
                task.status === 'running' ? { ...task, status: 'failed' as const, error: '获取任务状态失败' } : task
              )
            );
            return;
          }

          // 更新任务计划（如果后端已生成）
          if (executionDetail.plan && !currentPlan) {
            setCurrentPlan(executionDetail.plan);
            setExecutingTasks(executionDetail.plan.tasks.map(task => ({
              id: task.id,
              description: task.description,
              status: task.status,
              dependsOn: task.dependsOn,
              result: task.result,
              error: task.error,
            })));
          }

          // 获取子任务列表并更新状态
          const subTasks = await getExecutionSubTasks(executionId);
          if (subTasks && subTasks.length > 0) {
            setExecutingTasks((prev) => {
              const updatedTasks = prev.map(task => {
                const subTask = subTasks.find(st => st.taskId === task.id);
                if (subTask) {
                  return {
                    ...task,
                    status: subTask.status,
                    result: subTask.result,
                    error: subTask.result?.startsWith('ERROR:') ? subTask.result : undefined,
                  };
                }
                return task;
              });
              return updatedTasks;
            });
          }

          // 如果有中间结果，追加到消息中
          if (executionDetail.result && executionDetail.result !== accumulatedContent) {
            const newContent = executionDetail.result;
            accumulatedContent = newContent;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === resultMessage.id
                  ? { ...m, content: newContent, fullContent: newContent }
                  : m
              )
            );
          }

          // 检查任务是否完成或失败
          if (executionDetail.status === 'completed' || executionDetail.status === 'failed') {
            clearInterval(pollInterval);

            // 更新计划消息状态
            const taskStatus = executionDetail.status === 'completed' ? 'completed' : 'failed';
            setExecutingTasks((prev) =>
              prev.map((task) =>
                task.status === 'running' ? { ...task, status: taskStatus } : task
              )
            );

            const finalMessage = executionDetail.status === 'completed'
              ? '所有任务已完成，正在整合结果...'
              : '任务执行失败';

            setMessages((prev) =>
              prev.map((m) =>
                m.id === planMessage.id
                  ? { ...m, content: finalMessage }
                  : m
              )
            );

            // 最终结果
            const finalContent = executionDetail.result || '';

            // 如果之前没有完整内容，使用最终结果
            if (!accumulatedContent && finalContent) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === resultMessage.id
                    ? { ...m, content: finalContent, fullContent: finalContent }
                    : m
                )
              );
            }

            // 打字机效果展示最终结果
            const messageId = resultMessage.id;
            let currentIndex = 0;
            const chunkSize = 3;
            const speed = 12;

            const streamContent = () => {
              if (currentIndex < finalContent.length) {
                const nextIndex = Math.min(currentIndex + chunkSize, finalContent.length);
                const newContent = finalContent.slice(0, nextIndex);
                currentIndex = nextIndex;

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId
                      ? { ...m, content: newContent }
                      : m
                  )
                );

                if (currentIndex < finalContent.length) {
                  setTimeout(streamContent, speed);
                } else {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === messageId
                        ? { ...m, content: finalContent, isStreaming: false }
                        : m
                    )
                  );
                }
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId
                      ? { ...m, isStreaming: false }
                      : m
                  )
                );
              }
            };

            // 只有内容长度超过0时才启动打字机
            if (finalContent.length > 0) {
              // 清空当前内容，准备打字机
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId
                    ? { ...m, content: '', isStreaming: true }
                    : m
                )
              );
              streamContent();
            }

            setIsExecutingPlan(false);
            setCurrentPlan(null);
            setExecutingTasks([]);
          }
        } catch (err) {
          logger.error('轮询任务状态失败', err);
          clearInterval(pollInterval);
          toast.error('获取任务状态失败');
          setIsExecutingPlan(false);
          setExecutingTasks((prev) =>
            prev.map((task) =>
              task.status === 'running' ? { ...task, status: 'failed' as const, error: '轮询失败' } : task
            )
          );
        }
      }, 2000); // 每 2 秒轮询一次
    } catch (err) {
      logger.error('执行任务计划失败', err);
      toast.error('执行失败，请重试');
      setIsExecutingPlan(false);
      setExecutingTasks((prev) =>
        prev.map((task) =>
          task.status === 'running' ? { ...task, status: 'failed' as const, error: '执行失败' } : task
        )
      );
    }
  };

  // 插入提及内容
  const handleAddMention = (mention: Mention) => {
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
  const extractMentions = (content: string): Mention[] => {
    const mentionRegex = /\[@(knowledge|tool|datasource):([^:]+):([^\]]+)\]/g;
    const mentions: Mention[] = [];
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

  // 渲染多模态内容
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

  const renderMessageContent = (message: DisplayMessage) => {
    return renderMultimodalContent(message.content, message.role, message.isStreaming);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      <ScrollArea className="flex-1 h-full overflow-hidden px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent text-accent-foreground'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border'
                }`}
              >
                {message.imageUrls && message.imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {message.imageUrls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt="Attached"
                        className="max-w-[200px] max-h-[200px] rounded object-cover"
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
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-card border border-border rounded-lg px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t bg-card p-4">
        <div className="max-w-4xl mx-auto">
          {/* 任务计划面板 */}
          {isExecutingPlan && executingTasks.length > 0 && (
            <TaskPlanPanel tasks={executingTasks} />
          )}

          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onStop={handleStop}
            onFileUpload={handleFileUpload}
            attachedFiles={attachedFiles}
            onRemoveFile={removeFile}
            isLoading={isLoading}
            models={models}
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
                variant={enablePlanning ? 'default' : 'outline'}
                size="icon"
                onClick={() => setEnablePlanning(!enablePlanning)}
                title={enablePlanning ? '已开启任务规划' : '点击开启任务规划'}
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
    </div>
  );
};

export default AgentChatPage;

// 任务计划展示组件
interface TaskPlanPanelProps {
  tasks: SubTask[];
}

const TaskPlanPanel: React.FC<TaskPlanPanelProps> = ({ tasks }) => {
  const getStatusIcon = (status: SubTask['status']) => {
    switch (status) {
      case 'pending':
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="mb-3 p-4 bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Play className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">执行计划</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {completedCount}/{tasks.length} 已完成
        </span>
      </div>

      {/* 进度条 */}
      <div className="h-1.5 bg-accent rounded-full mb-3 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 任务列表 */}
      <div className="space-y-2">
        {tasks.map((task, index) => (
          <div
            key={task.id}
            className={`flex items-start gap-2 p-2 rounded ${
              task.status === 'running' ? 'bg-accent/50' : ''
            }`}
          >
            <span className="text-xs text-muted-foreground mt-0.5 w-4">
              {index + 1}.
            </span>
            {getStatusIcon(task.status)}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{task.description}</p>
              {task.error && (
                <p className="text-xs text-destructive mt-1">{task.error}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
