import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type {
  ModelListResp,
  ChatRequest,
  ChatResp,
  LlmModel,
  ConfigStatusResp,
  SaveConfigRequest,
  SaveConfigResp,
  ValidateConfigResp,
  AgentListResp,
  CreateAgentRequest,
  UpdateAgentRequest,
  WorkflowListResp,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  KnowledgeBase,
  KnowledgeBaseListResp,
  KnowledgeDocumentListResp,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
  UploadDocumentRequest,
  ConversationListResp,
  BatchDeleteResp,
  MessageListResp,
  TokenOverviewResp,
  GlobalTokenOverviewResp,
  UsageRecordListResp,
  AgentConfig,
  WorkflowConfig,
  ExecuteAgentRequest,
  ExecuteAgentResponse,
  TaskExecutionRecord,
  TaskExecutionListResp,
  SubTaskRecord,
  KnowledgeFolderListResp,
  CreateFolderRequest,
  UpdateFolderRequest,
  Tool,
  ToolListResp,
  SkillParseResult,
  ExecuteWorkflowResp,
} from '@shared/api.interface';

// 重新导出 Tool、ToolListResp 和 SkillParseResult 类型
export type { Tool, ToolListResp, SkillParseResult };

// 获取模型列表
export async function getModelList(): Promise<LlmModel[]> {
  try {
    const response = await axiosForBackend<ModelListResp>({
      url: '/api/models',
      method: 'GET',
    });
    return response.data.models;
  } catch (error) {
    logger.error('获取模型列表失败', error);
    throw error;
  }
}

// 发送对话请求
export async function sendChat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResp> {
  try {
    const response = await axiosForBackend<ChatResp>({
      url: '/api/chat/completions',
      method: 'POST',
      data: request,
      signal,
    });
    return response.data;
  } catch (error) {
    logger.error('发送对话请求失败', error);
    throw error;
  }
}

// 获取会话列表
export async function getConversationList(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}): Promise<ConversationListResp> {
  try {
    const response = await axiosForBackend<ConversationListResp>({
      url: '/api/conversations',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取会话列表失败', error);
    throw error;
  }
}

// 删除单条会话
export async function deleteConversation(id: string): Promise<boolean> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/conversations/${id}`,
      method: 'DELETE',
    });
    return response.data.success;
  } catch (error) {
    logger.error('删除会话失败', error);
    throw error;
  }
}

// 批量删除会话
export async function batchDeleteConversations(
  ids: string[]
): Promise<BatchDeleteResp> {
  try {
    const response = await axiosForBackend<BatchDeleteResp>({
      url: '/api/conversations/batch-delete',
      method: 'POST',
      data: { ids },
    });
    return response.data;
  } catch (error) {
    logger.error('批量删除会话失败', error);
    throw error;
  }
}

// 获取会话消息列表
export async function getMessages(
  conversationId: string,
  page?: number,
  pageSize?: number
): Promise<MessageListResp> {
  try {
    const response = await axiosForBackend<MessageListResp>({
      url: `/api/conversations/${conversationId}/messages`,
      method: 'GET',
      params: { page, pageSize },
    });
    return response.data;
  } catch (error) {
    logger.error('获取会话消息失败', error);
    throw error;
  }
}

/** Token使用概览请求参数 */
interface TokenOverviewParams {
  startDate?: Dayjs | string | Date;
  endDate?: Dayjs | string | Date;
}

/** 消费记录列表请求参数 */
interface UsageRecordsParams {
  page?: number;
  pageSize?: number;
  startDate?: Dayjs | string | Date;
  endDate?: Dayjs | string | Date;
  model?: string;
}

// 获取Token使用概览
export async function getTokenOverview(params?: TokenOverviewParams): Promise<TokenOverviewResp> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.set('startDate', dayjs(params.startDate).format('YYYY-MM-DD'));
    }
    if (params?.endDate) {
      queryParams.set('endDate', dayjs(params.endDate).format('YYYY-MM-DD'));
    }
    const queryString = queryParams.toString();
    const url = queryString ? `/api/token-usage/overview?${queryString}` : '/api/token-usage/overview';
    const response = await axiosForBackend<TokenOverviewResp>({
      url,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取Token使用概览失败', error);
    throw error;
  }
}

// 获取全局Token使用概览（管理员用）
export async function getGlobalTokenOverview(params?: TokenOverviewParams): Promise<GlobalTokenOverviewResp> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.set('startDate', dayjs(params.startDate).format('YYYY-MM-DD'));
    }
    if (params?.endDate) {
      queryParams.set('endDate', dayjs(params.endDate).format('YYYY-MM-DD'));
    }
    const queryString = queryParams.toString();
    const url = queryString ? `/api/token-usage/global?${queryString}` : '/api/token-usage/global';
    const response = await axiosForBackend<GlobalTokenOverviewResp>({
      url,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取全局Token概览失败', error);
    throw error;
  }
}

// 获取消费记录列表
export async function getUsageRecords(params?: UsageRecordsParams): Promise<UsageRecordListResp> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) {
      queryParams.set('page', String(params.page));
    }
    if (params?.pageSize) {
      queryParams.set('pageSize', String(params.pageSize));
    }
    if (params?.startDate) {
      queryParams.set('startDate', dayjs(params.startDate).format('YYYY-MM-DD'));
    }
    if (params?.endDate) {
      queryParams.set('endDate', dayjs(params.endDate).format('YYYY-MM-DD'));
    }
    if (params?.model) {
      queryParams.set('model', params.model);
    }
    const queryString = queryParams.toString();
    const url = queryString ? `/api/token-usage/list?${queryString}` : '/api/token-usage/list';
    const response = await axiosForBackend<UsageRecordListResp>({
      url,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取消费记录列表失败', error);
    throw error;
  }
}

// 获取API配置状态
export async function getConfigStatus(): Promise<ConfigStatusResp> {
  try {
    const response = await axiosForBackend<ConfigStatusResp>({
      url: '/api/config',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取配置状态失败', error);
    throw error;
  }
}

// 保存API配置
export async function saveConfig(request: SaveConfigRequest): Promise<SaveConfigResp> {
  try {
    const response = await axiosForBackend<SaveConfigResp>({
      url: '/api/config',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('保存配置失败', error);
    throw error;
  }
}

// 验证API配置
export async function validateConfig(request: SaveConfigRequest): Promise<ValidateConfigResp> {
  try {
    const response = await axiosForBackend<ValidateConfigResp>({
      url: '/api/config/validate',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('验证配置失败', error);
    throw error;
  }
}

// ========== 自定义模型 API ==========

/** 创建自定义模型请求 */
export interface CreateCustomModelRequest {
  modelId: string;
  name: string;
  type: 'gpt' | 'claude' | 'gemini' | 'deepseek';
  inputPrice?: number;
  outputPrice?: number;
  cacheReadPrice?: number;
  pricePerRequest?: number;
}

/** 自定义模型 */
export interface CustomModel {
  id: string;
  modelId: string;
  name: string;
  type: 'gpt' | 'claude' | 'gemini' | 'deepseek';
  inputPrice: number;
  outputPrice: number;
  cacheReadPrice?: number;
  pricePerRequest?: number;
}

// 获取自定义模型列表
export async function getCustomModels(): Promise<CustomModel[]> {
  try {
    const response = await axiosForBackend<CustomModel[]>({
      url: '/api/config/custom-models',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取自定义模型列表失败', error);
    throw error;
  }
}

// 创建自定义模型
export async function createCustomModel(request: CreateCustomModelRequest): Promise<CustomModel> {
  try {
    const response = await axiosForBackend<CustomModel>({
      url: '/api/config/custom-models',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('创建自定义模型失败', error);
    throw error;
  }
}

// 删除自定义模型
export async function deleteCustomModel(modelId: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/config/custom-models/${modelId}`,
      method: 'DELETE',
    });
  } catch (error) {
    logger.error('删除自定义模型失败', error);
    throw error;
  }
}

// ========== 工具相关 API ==========

/** 创建工具请求 */
export interface CreateToolRequest {
  name: string;
  type: 'mcp' | 'cloud_plugin' | 'skill';
  description?: string;
  configData?: Record<string, unknown>;
  skillData?: {
    name: string;
    description?: string;
    content: string;
    fileType: 'markdown' | 'zip';
    inputSchema?: Array<{ name: string; type: string; description: string; required?: boolean }>;
    outputSchema?: Array<{ name: string; type: string; description: string }>;
    examples?: Array<{ input: Record<string, unknown>; output: string }>;
    metadata?: { author?: string; tags?: string[]; category?: string };
    version?: string;
  };
}

/** 更新工具请求 */
export interface UpdateToolRequest {
  name?: string;
  description?: string;
  configData?: Record<string, unknown>;
  isActive?: boolean;
  skillData?: {
    name: string;
    description?: string;
    content: string;
    fileType: 'markdown' | 'zip';
    inputSchema?: Array<{ name: string; type: string; description: string; required?: boolean }>;
    outputSchema?: Array<{ name: string; type: string; description: string }>;
    examples?: Array<{ input: Record<string, unknown>; output: string }>;
    metadata?: { author?: string; tags?: string[]; category?: string };
    version?: string;
  };
}

/** 测试连接响应 */
export interface TestConnectionResp {
  success: boolean;
  message: string;
}

// 获取工具列表
export async function getToolList(): Promise<Tool[]> {
  try {
    const response = await axiosForBackend<Tool[]>({
      url: '/api/tools',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取工具列表失败', error);
    throw error;
  }
}

// 创建工具
export async function createTool(data: CreateToolRequest): Promise<Tool> {
  try {
    const response = await axiosForBackend<Tool>({
      url: '/api/tools',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建工具失败', error);
    throw error;
  }
}

// 更新工具
export async function updateTool(id: string, data: UpdateToolRequest): Promise<Tool | null> {
  try {
    const response = await axiosForBackend<Tool | null>({
      url: `/api/tools/${id}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新工具失败', error);
    throw error;
  }
}

// 删除工具
export async function deleteTool(id: string): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/tools/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除工具失败', error);
    throw error;
  }
}

// 测试工具连接
export async function testToolConnection(id: string): Promise<TestConnectionResp> {
  try {
    const response = await axiosForBackend<TestConnectionResp>({
      url: `/api/tools/${id}/test`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('测试工具连接失败', error);
    throw error;
  }
}

// 解析 Skill 文件
export async function parseSkillFile(file: File): Promise<SkillParseResult> {
  try {
    // 读取文件为 base64
    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data:application/zip;base64, 前缀
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await axiosForBackend<{
      success: boolean;
      data?: SkillParseResult;
      message?: string;
    }>({
      url: '/api/tools/parse-skill',
      method: 'POST',
      data: {
        fileName: file.name,
        content: base64Content,
      },
    });

    const result = response.data;

    if (!result.success) {
      throw new Error(result.message || '解析失败');
    }

    if (!result.data) {
      throw new Error('解析结果为空');
    }

    return result.data;
  } catch (error) {
    logger.error('解析 Skill 文件失败', error);
    throw error;
  }
}

// ========== Agent 相关 API ==========
export async function getAgentList(): Promise<AgentListResp> {
  try {
    const response = await axiosForBackend<AgentListResp>({
      url: '/api/agents',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取Agent列表失败', error);
    throw error;
  }
}

// 获取Agent详情
export async function getAgent(id: string): Promise<AgentConfig | null> {
  try {
    const response = await axiosForBackend<AgentConfig | null>({
      url: `/api/agents/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取Agent详情失败', error);
    throw error;
  }
}

// 创建Agent
export async function createAgent(data: CreateAgentRequest): Promise<AgentConfig> {
  try {
    const response = await axiosForBackend<AgentConfig>({
      url: '/api/agents',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建Agent失败', error);
    throw error;
  }
}

// 更新Agent
export async function updateAgent(id: string, data: UpdateAgentRequest): Promise<AgentConfig | null> {
  try {
    const response = await axiosForBackend<AgentConfig | null>({
      url: `/api/agents/${id}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新Agent失败', error);
    throw error;
  }
}

// 删除Agent
export async function deleteAgent(id: string): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/agents/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除Agent失败', error);
    throw error;
  }
}

// 与Agent对话
export async function chatWithAgent(
  agentId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  mentions?: Array<{ type: 'knowledge' | 'tool' | 'datasource'; id: string; name: string }>,
  signal?: AbortSignal
): Promise<{ content: string; toolCalls?: string[] }> {
  try {
    const response = await axiosForBackend<{ content: string; toolCalls?: string[] }>({
      url: `/api/agents/${agentId}/chat`,
      method: 'POST',
      data: { messages, mentions },
      signal,
    });
    return response.data;
  } catch (error) {
    logger.error('Agent对话失败', error);
    throw error;
  }
}

// 获取Workflow列表
export async function getWorkflowList(): Promise<WorkflowListResp> {
  try {
    const response = await axiosForBackend<WorkflowListResp>({
      url: '/api/workflows',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取Workflow列表失败', error);
    throw error;
  }
}

// 获取Workflow详情
export async function getWorkflow(id: string): Promise<WorkflowConfig | null> {
  try {
    const response = await axiosForBackend<WorkflowConfig | null>({
      url: `/api/workflows/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取Workflow详情失败', error);
    throw error;
  }
}

// 创建Workflow
export async function createWorkflow(data: CreateWorkflowRequest): Promise<WorkflowConfig> {
  try {
    const response = await axiosForBackend<WorkflowConfig>({
      url: '/api/workflows',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建Workflow失败', error);
    throw error;
  }
}

// 更新Workflow
export async function updateWorkflow(id: string, data: UpdateWorkflowRequest): Promise<WorkflowConfig | null> {
  try {
    const response = await axiosForBackend<WorkflowConfig | null>({
      url: `/api/workflows/${id}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新Workflow失败', error);
    throw error;
  }
}

// 删除Workflow
export async function deleteWorkflow(id: string): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/workflows/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除Workflow失败', error);
    throw error;
  }
}

// 执行Workflow
export async function executeWorkflow(
  id: string,
  inputs: Record<string, unknown>
): Promise<ExecuteWorkflowResp> {
  try {
    const response = await axiosForBackend<ExecuteWorkflowResp>({
      url: `/api/workflows/${id}/execute`,
      method: 'POST',
      data: { inputs },
    });
    return response.data;
  } catch (error) {
    logger.error('执行Workflow失败', error);
    throw error;
  }
}

// 获取知识库列表
export async function getKnowledgeBaseList(organizationId?: string): Promise<KnowledgeBaseListResp> {
  try {
    const params = organizationId ? { organizationId } : undefined;
    const response = await axiosForBackend<KnowledgeBaseListResp>({
      url: '/api/knowledge',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取知识库列表失败', error);
    throw error;
  }
}

// 获取知识库详情
export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  try {
    const response = await axiosForBackend<KnowledgeBase | null>({
      url: `/api/knowledge/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取知识库详情失败', error);
    throw error;
  }
}

// 创建知识库
export async function createKnowledgeBase(data: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> {
  try {
    const response = await axiosForBackend<KnowledgeBase>({
      url: '/api/knowledge',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建知识库失败', error);
    throw error;
  }
}

// 更新知识库
export async function updateKnowledgeBase(id: string, data: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase | null> {
  try {
    const response = await axiosForBackend<KnowledgeBase | null>({
      url: `/api/knowledge/${id}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新知识库失败', error);
    throw error;
  }
}

// 删除知识库
export async function deleteKnowledgeBase(id: string): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/knowledge/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除知识库失败', error);
    throw error;
  }
}

// 上传文档到知识库
export async function uploadDocumentToKnowledgeBase(
  knowledgeBaseId: string,
  doc: UploadDocumentRequest
): Promise<{ id: string }> {
  try {
    const response = await axiosForBackend<{ id: string }>({
      url: `/api/knowledge/${knowledgeBaseId}/documents`,
      method: 'POST',
      data: doc,
    });
    return response.data;
  } catch (error) {
    logger.error('上传文档失败', error);
    throw error;
  }
}

// 获取知识库文档列表
export async function getKnowledgeBaseDocuments(
  knowledgeBaseId: string,
  folderId?: string
): Promise<KnowledgeDocumentListResp> {
  try {
    const params = new URLSearchParams();
    if (folderId) {
      params.set('folderId', folderId);
    }
    const queryString = params.toString();
    const url = queryString
      ? `/api/knowledge/${knowledgeBaseId}/documents?${queryString}`
      : `/api/knowledge/${knowledgeBaseId}/documents`;
    const response = await axiosForBackend<KnowledgeDocumentListResp>({
      url,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取文档列表失败', error);
    throw error;
  }
}

// 获取知识库文件夹列表
export async function getKnowledgeBaseFolders(
  knowledgeBaseId: string,
  parentId?: string
): Promise<KnowledgeFolderListResp> {
  try {
    const params = new URLSearchParams();
    if (parentId) {
      params.set('parentId', parentId);
    }
    const queryString = params.toString();
    const url = queryString
      ? `/api/knowledge/${knowledgeBaseId}/folders?${queryString}`
      : `/api/knowledge/${knowledgeBaseId}/folders`;
    const response = await axiosForBackend<KnowledgeFolderListResp>({
      url,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取文件夹列表失败', error);
    throw error;
  }
}

// 创建文件夹
export async function createKnowledgeBaseFolder(
  knowledgeBaseId: string,
  data: CreateFolderRequest
): Promise<{ id: string }> {
  try {
    const response = await axiosForBackend<{ id: string }>({
      url: `/api/knowledge/${knowledgeBaseId}/folders`,
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建文件夹失败', error);
    throw error;
  }
}

// 更新文件夹
export async function updateKnowledgeBaseFolder(
  knowledgeBaseId: string,
  folderId: string,
  data: UpdateFolderRequest
): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/knowledge/${knowledgeBaseId}/folders/${folderId}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新文件夹失败', error);
    throw error;
  }
}

// 删除文件夹
export async function deleteKnowledgeBaseFolder(
  knowledgeBaseId: string,
  folderId: string
): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/knowledge/${knowledgeBaseId}/folders/${folderId}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除文件夹失败', error);
    throw error;
  }
}

// 删除知识库文档
export async function deleteKnowledgeBaseDocument(
  knowledgeBaseId: string,
  docId: string
): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/knowledge/${knowledgeBaseId}/documents/${docId}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除文档失败', error);
    throw error;
  }
}

// ========== Agent 任务执行相关 API ==========

// 执行 Agent 任务（带任务拆解）
export async function executeAgent(
  agentId: string,
  data: ExecuteAgentRequest
): Promise<ExecuteAgentResponse> {
  try {
    const response = await axiosForBackend<ExecuteAgentResponse>({
      url: `/api/agents/${agentId}/execute`,
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('执行Agent任务失败', error);
    throw error;
  }
}

// 获取 Agent 执行历史
export async function getAgentExecutions(
  agentId: string,
  limit?: number,
  offset?: number
): Promise<TaskExecutionListResp> {
  try {
    const params = new URLSearchParams();
    if (limit !== undefined) {
      params.set('limit', String(limit));
    }
    if (offset !== undefined) {
      params.set('offset', String(offset));
    }
    const queryString = params.toString();
    const url = queryString ? `/api/agents/${agentId}/executions?${queryString}` : `/api/agents/${agentId}/executions`;
    const response = await axiosForBackend<TaskExecutionListResp>({
      url,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取Agent执行历史失败', error);
    throw error;
  }
}

// 获取执行详情
export async function getExecutionDetail(
  executionId: string
): Promise<TaskExecutionRecord | null> {
  try {
    const response = await axiosForBackend<TaskExecutionRecord | null>({
      url: `/api/executions/${executionId}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取执行详情失败', error);
    throw error;
  }
}

// 获取子任务列表
export async function getExecutionSubTasks(
  executionId: string
): Promise<SubTaskRecord[]> {
  try {
    const response = await axiosForBackend<SubTaskRecord[]>({
      url: `/api/executions/${executionId}/subtasks`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取子任务列表失败', error);
    throw error;
  }
}

// 角色管理 API
import type {
  RoleListResp,
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '@shared/api.interface';

// 组织管理 API
import type {
  Organization,
  OrganizationListResp,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationResourcePermission,
  GrantResourcePermissionRequest,
} from '@shared/api.interface';

// 获取组织列表
export async function getOrganizationList(): Promise<OrganizationListResp> {
  try {
    const response = await axiosForBackend<OrganizationListResp>({
      url: '/api/organization',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取组织列表失败', error);
    throw error;
  }
}

// 获取组织详情
export async function getOrganization(id: string): Promise<Organization> {
  try {
    const response = await axiosForBackend<Organization>({
      url: `/api/organization/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取组织详情失败', error);
    throw error;
  }
}

// 创建组织
export async function createOrganization(request: CreateOrganizationRequest): Promise<Organization> {
  try {
    const response = await axiosForBackend<Organization>({
      url: '/api/organization',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('创建组织失败', error);
    throw error;
  }
}

// 更新组织
export async function updateOrganization(id: string, request: UpdateOrganizationRequest): Promise<Organization> {
  try {
    const response = await axiosForBackend<Organization>({
      url: `/api/organization/${id}`,
      method: 'PUT',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('更新组织失败', error);
    throw error;
  }
}

// 删除组织
export async function deleteOrganization(id: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/organization/${id}`,
      method: 'DELETE',
    });
  } catch (error) {
    logger.error('删除组织失败', error);
    throw error;
  }
}

// 获取组织的资源授权列表
export async function getOrganizationPermissions(orgId: string): Promise<{ items: OrganizationResourcePermission[] }> {
  try {
    const response = await axiosForBackend<{ items: OrganizationResourcePermission[] }>({
      url: `/api/organization/${orgId}/permissions`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取组织权限列表失败', error);
    throw error;
  }
}

// 授予资源权限
export async function grantResourcePermission(
  orgId: string,
  request: GrantResourcePermissionRequest,
): Promise<OrganizationResourcePermission> {
  try {
    const response = await axiosForBackend<OrganizationResourcePermission>({
      url: `/api/organization/${orgId}/permissions`,
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('授予资源权限失败', error);
    throw error;
  }
}

// 撤销资源权限
export async function revokeResourcePermission(orgId: string, permissionId: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/organization/${orgId}/permissions/${permissionId}`,
      method: 'DELETE',
    });
  } catch (error) {
    logger.error('撤销资源权限失败', error);
    throw error;
  }
}

// 获取组织下的角色列表
export async function getOrganizationRoles(orgId: string): Promise<{ items: Role[] }> {
  try {
    const response = await axiosForBackend<{ items: Role[] }>({
      url: `/api/organization/${orgId}/roles`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取组织角色列表失败', error);
    throw error;
  }
}

// 获取角色列表
export async function getRoleList(): Promise<RoleListResp> {
  try {
    const response = await axiosForBackend<RoleListResp>({
      url: '/api/role',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取角色列表失败', error);
    throw error;
  }
}

// 获取角色详情
export async function getRole(id: string): Promise<Role> {
  try {
    const response = await axiosForBackend<Role>({
      url: `/api/role/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取角色详情失败', error);
    throw error;
  }
}

// 创建角色
export async function createRole(request: CreateRoleRequest): Promise<Role> {
  try {
    const response = await axiosForBackend<Role>({
      url: '/api/role',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('创建角色失败', error);
    throw error;
  }
}

// 更新角色
export async function updateRole(id: string, request: UpdateRoleRequest): Promise<Role> {
  try {
    const response = await axiosForBackend<Role>({
      url: `/api/role/${id}`,
      method: 'PUT',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('更新角色失败', error);
    throw error;
  }
}

// 删除角色
export async function deleteRole(id: string): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/role/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除角色失败', error);
    throw error;
  }
}

// 文件处理 API

export interface ParseFileRequest {
  fileName: string;
  mimeType: string;
  base64Data: string;
}

export interface ParseFileResponse {
  success: boolean;
  data: {
    type: 'excel' | 'word' | 'pdf' | 'ppt' | 'image' | 'text' | 'unknown';
    content: string;
    metadata?: {
      sheets?: string[];
      pages?: number;
      slideCount?: number;
      [key: string]: unknown;
    };
  };
}

export interface GenerateFileRequest {
  type: 'excel' | 'word' | 'pdf' | 'ppt';
  content: string;
  options?: {
    fileName?: string;
    title?: string;
  };
}

export interface GenerateFileResponse {
  success: boolean;
  data: {
    fileName: string;
    mimeType: string;
    base64Data: string;
  };
}

// 解析文件内容
export async function parseFile(request: ParseFileRequest): Promise<ParseFileResponse> {
  try {
    const response = await axiosForBackend<ParseFileResponse>({
      url: '/api/files/parse',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('解析文件失败', error);
    throw error;
  }
}

// 生成文件
export async function generateFile(request: GenerateFileRequest): Promise<GenerateFileResponse> {
  try {
    const response = await axiosForBackend<GenerateFileResponse>({
      url: '/api/files/generate',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('生成文件失败', error);
    throw error;
  }
}
