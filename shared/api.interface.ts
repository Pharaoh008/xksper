/* 前后端共享的类型定义 */

/** 模型类型枚举 */
export type ModelType = 'gpt' | 'gemini' | 'deepseek' | 'claude';

/** LLM模型信息 */
export interface LlmModel {
  id: string;
  name: string;
  type: ModelType;
}

/** 可用模型列表响应 */
export interface ModelListResp {
  models: LlmModel[];
}

/** 模型定价信息 */
export interface ModelPricing {
  id: string;
  name: string;
  type: ModelType;
  inputPrice: number;
  outputPrice: number;
  cacheReadPrice?: number;
  cacheCreatePrice?: number;
  pricePerRequest?: number;
}

/** API配置状态 */
export interface ConfigStatusResp {
  baseUrl: string;
  isValid: boolean;
  apiKeyMask: string;
  enabledModels: string[];
  defaultModel: string | null;
  availableModels: ModelPricing[];
}

/** 保存API配置请求 */
export interface SaveConfigRequest {
  apiKey: string;
  baseUrl?: string;
  enabledModels?: string[];
  defaultModel?: string;
}

/** 保存API配置响应 */
export interface SaveConfigResp {
  success: boolean;
  isValid: boolean;
  message?: string;
}

/** 验证配置响应 */
export interface ValidateConfigResp {
  success: boolean;
  message: string;
}

/** 自定义模型 */
export interface CustomModel {
  id: string;
  modelId: string;
  name: string;
  type: ModelType;
  inputPrice: number;
  outputPrice: number;
  cacheReadPrice?: number;
  pricePerRequest?: number;
}

/** 创建自定义模型请求 */
export interface CreateCustomModelRequest {
  modelId: string;
  name: string;
  type: ModelType;
  inputPrice?: number;
  outputPrice?: number;
  cacheReadPrice?: number;
  pricePerRequest?: number;
}

/** 消息角色 */
export type MessageRole = 'user' | 'assistant';

/** 消息内容类型 */
export type MessageContent = string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;

/** 消息内容项（不含file类型，file通过attachments字段发送） */
export type MessageContentItem = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** 文件附件信息 */
export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  parsedContent?: string;
}

/** 消息内容 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string | MessageContentItem[];
  imageUrls?: string[];
  attachments?: MessageAttachment[];
  tokenUsage: number;
  createdAt: string;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 完整内容（流式输出时使用） */
  fullContent?: string;
  /** 引用的知识库和工具 */
  mentions?: Mention[];
}

/** 对话会话 */
export interface Conversation {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  createdAt: string;
}

/** 对话消息列表响应 */
export interface MessageListResp {
  items: Message[];
  total: number;
}

/** 对话列表响应 */
export interface ConversationListResp {
  items: Conversation[];
  total: number;
}

/** 创建会话请求 */
export interface CreateConversationRequest {
  title: string;
  model: string;
}

/** 批量删除会话请求 */
export interface BatchDeleteConversationsRequest {
  ids: string[];
}

/** 引用类型 */
export type MentionType = 'knowledge' | 'tool' | 'datasource';

/** @引用 */
export interface Mention {
  type: MentionType;
  id: string;
  name: string;
}

/** 发送对话请求 */
export interface ChatRequest {
  model: string;
  messages: Array<{
    role: MessageRole;
    content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
    /** 文件附件（base64格式） */
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      base64Data: string;
    }>;
  }>;
  conversationId?: string;
  mentions?: Mention[];
}

/** Token使用量 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

/** 文件附件信息 */
export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  url?: string;
  /** 文件内容的文本表示（已解析） */
  content?: string;
  /** 是否为生成的文件 */
  isGenerated?: boolean;
}

/** 对话响应内容项 */
export type ChatContentItem = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: FileAttachment };

/** 对话响应 */
export interface ChatResp {
  id: string;
  role: MessageRole;
  content: string | ChatContentItem[];
  tokenUsage: TokenUsage;
}

/** Token消耗统计响应 */
export interface TokenStatsResp {
  daily: Array<{
    date: string;
    totalTokens: number;
    cost: number;
  }>;
  byModel: Array<{
    model: string;
    totalTokens: number;
    cost: number;
    percentage: number;
  }>;
  summary: {
    totalTokens: number;
    totalCost: number;
    conversationCount: number;
  };
}

/** 智能体信息 */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  instruction?: string;
  greeting?: string;
  model?: string;
  knowledgeBase?: string[];
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 智能体列表响应 */
export interface AgentListResp {
  items: Agent[];
  total: number;
}

/** 创建智能体请求 */
export interface CreateAgentRequest {
  name: string;
  description?: string;
  instruction?: string;
  greeting?: string;
  model?: string;
  knowledgeBase?: string[];
  tools?: string[];
  avatarUrl?: string;
}

/** 更新智能体请求 */
export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  instruction?: string;
  greeting?: string;
  model?: string;
  knowledgeBase?: string[];
  tools?: string[];
  avatarUrl?: string;
  isActive?: boolean;
}

/** 知识库信息 */
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  type: 'local' | 'feishu';
  feishuToken?: string;
  feishuSpaceId?: string;
  feishuNodeIds?: string[];
  organizationId?: string;
  documentCount: number;
  tokenCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 知识库列表响应 */
export interface KnowledgeBaseListResp {
  items: KnowledgeBase[];
  total: number;
}

/** 创建知识库请求 */
export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
  type?: 'local' | 'feishu';
  feishuToken?: string;
  feishuSpaceId?: string;
  feishuNodeIds?: string[];
  organizationId?: string;
}

/** 更新知识库请求 */
export interface UpdateKnowledgeBaseRequest {
  name?: string;
  description?: string;
  type?: 'local' | 'feishu';
  feishuToken?: string;
  feishuSpaceId?: string;
  feishuNodeIds?: string[];
  organizationId?: string;
}

/** 知识库文档信息 */
export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  folderId?: string;
  name: string;
  fileSize: number;
  fileType?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  tokenCount: number;
  createdAt: string;
}

/** 上传文档请求 */
export interface UploadDocumentRequest {
  name: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  content?: string;
  folderId?: string;
}

/** 知识库文件夹信息 */
export interface KnowledgeFolder {
  id: string;
  knowledgeBaseId: string;
  parentId?: string;
  name: string;
  type: 'folder' | 'knowledge';
  sortOrder: number;
  createdAt: string;
}

/** 知识库文件夹列表响应 */
export interface KnowledgeFolderListResp {
  items: KnowledgeFolder[];
  total: number;
}

/** 创建文件夹请求 */
export interface CreateFolderRequest {
  knowledgeBaseId: string;
  parentId?: string;
  name: string;
  type?: 'folder' | 'knowledge';
  sortOrder?: number;
}

/** 更新文件夹请求 */
export interface UpdateFolderRequest {
  name?: string;
  sortOrder?: number;
}

/** 知识库文档列表响应 */
export interface KnowledgeDocumentListResp {
  items: KnowledgeDocument[];
  total: number;
}

/** 按组织获取知识库列表请求 */
export interface GetKnowledgeBasesByOrgRequest {
  organizationId?: string;
}

/** Skill 定义 */
export interface Skill {
  id: string;
  toolId: string;
  name: string;
  description?: string;
  content: string;
  fileType: 'markdown' | 'zip';
  inputSchema?: SkillParam[];
  outputSchema?: SkillParam[];
  examples?: SkillExample[];
  metadata?: SkillMetadata;
  version: string;
  scriptRuntime?: 'node' | 'python' | 'php' | 'shell';
  scriptContent?: string;
  scriptEnabled?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Skill 参数定义 */
export interface SkillParam {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

/** Skill 示例 */
export interface SkillExample {
  input: Record<string, unknown>;
  output: string;
}

/** Skill 元数据 */
export interface SkillMetadata {
  author?: string;
  tags?: string[];
  category?: string;
}

/** Skill 解析结果 */
export interface SkillParseResult {
  name: string;
  description?: string;
  inputSchema: SkillParam[];
  outputSchema: SkillParam[];
  examples: SkillExample[];
  metadata?: SkillMetadata;
  version?: string;
  /** 文件内容（zip文件为base64编码） */
  content?: string;
  /** 文件类型 */
  fileType?: 'markdown' | 'zip';
  scriptRuntime?: 'node' | 'python' | 'php' | 'shell';
  scriptContent?: string;
}

/** 工具信息 */
export interface Tool {
  id: string;
  name: string;
  type: 'mcp' | 'cloud_plugin' | 'skill';
  description?: string;
  configData: {
    url?: string;
    headers?: Array<{ key: string; value: string }>;
    pluginKey?: string;
    instanceId?: string;
    skillId?: string;
    scriptEnabled?: boolean;
    scriptRuntime?: 'node' | 'python' | 'php' | 'shell';
    scriptContent?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  skill?: Skill;
}

/** 工具列表响应 */
export interface ToolListResp {
  items: Tool[];
  total: number;
}

/** 测试工具连接响应 */
export interface TestConnectionResp {
  success: boolean;
  message: string;
}

/** 创建工作流请求 */
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  inputSchema?: VariableSchema[];
  outputSchema?: VariableSchema[];
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

/** 更新工作流请求 */
export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  inputSchema?: VariableSchema[];
  outputSchema?: VariableSchema[];
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  isActive?: boolean;
}

/** 节点类型 */
export type NodeType = 'start' | 'end' | 'llm' | 'plugin' | 'code' | 'condition' | 'loop' | 'batch' | 'workflow' | 'text' | 'annotation';

/** 变量 Schema */
export interface VariableSchema {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}

/** 节点配置 */
export type NodeConfig = Record<string, unknown>;

/** 变量引用 */
export interface VariableReference {
  name: string;
  source?: string; // 格式: nodeId.outputName 或直接使用变量名
}

/** 开始节点配置 */
export interface StartNodeConfig {
  variables: VariableSchema[];
}

/** 结束节点配置 */
export interface EndNodeConfig {
  outputs: Array<{
    name: string;
    source: string; // 引用上游变量 {{nodeId.outputName}}
  }>;
}

/** 大模型节点配置 */
export interface LLMNodeConfig {
  model: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  knowledgeBases?: string[];
  tools?: string[];
  inputVariables?: VariableReference[];
  outputVariable?: string;
}

/** 插件节点配置 */
export interface PluginNodeConfig {
  pluginId: string;
  pluginName?: string;
  inputs?: Record<string, string>; // 参数名 -> 变量引用
  outputVariable?: string;
}

/** 子工作流节点配置 */
export interface WorkflowNodeConfig {
  workflowId: string;
  workflowName?: string;
  inputs?: Record<string, string>; // 参数名 -> 变量引用
  outputVariable?: string;
}

/** 代码节点配置 */
export interface CodeNodeConfig {
  language: 'javascript';
  code: string;
  inputVariable?: string;
  outputVariable?: string;
}

/** 条件分支 */
export interface ConditionBranch {
  id: string;
  label: string;
  condition: string; // 条件表达式
}

/** 选择器节点配置 */
export interface ConditionNodeConfig {
  logic: 'and' | 'or';
  branches: ConditionBranch[];
}

/** 循环节点配置 */
export interface LoopNodeConfig {
  loopType: 'forEach' | 'while';
  maxIterations: number;
  inputVariable?: string;
  outputVariable?: string;
}

/** 批处理节点配置 */
export interface BatchNodeConfig {
  batchSize: number;
  concurrency: number;
  inputVariable?: string;
  outputVariable?: string;
}

/** 文本处理操作类型 */
export type TextOperationType = 'concat' | 'split' | 'replace' | 'extract';

/** 文本处理操作 */
export interface TextOperation {
  type: TextOperationType;
  config: Record<string, unknown>;
}

/** 文本处理节点配置 */
export interface TextNodeConfig {
  operations: TextOperation[];
  inputs?: string[]; // 变量引用
  outputVariable?: string;
}

/** 注释节点配置 */
export interface AnnotationNodeConfig {
  content: string;
  color?: string;
}

/** 工作流节点 */
export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string; // 节点显示标签
  position: { x: number; y: number };
  config?: NodeConfig;
  data?: Record<string, unknown>;
}

/** 工作流连线 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  condition?: string;
}

/** 工作流信息 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  inputSchema: VariableSchema[];
  outputSchema: VariableSchema[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 工作流列表响应 */
export interface WorkflowListResp {
  items: Workflow[];
  total: number;
}

/** 执行工作流请求 */
export interface ExecuteWorkflowRequest {
  inputs: Record<string, unknown>;
}

/** 执行工作流响应 */
export interface ExecuteWorkflowResp {
  workflowId: string;
  executionId: string;
  status: 'running' | 'completed' | 'failed';
  outputs?: Record<string, unknown>;
  error?: string;
}

/** 工作流执行步骤 */
export interface WorkflowExecutionStep {
  nodeId: string;
  nodeType: NodeType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

/** 工作流执行详情 */
export interface WorkflowExecutionDetail {
  executionId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  steps: WorkflowExecutionStep[];
  outputs?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/** 批量删除响应 */
export interface BatchDeleteResp {
  success: boolean;
  deletedCount?: number;
}

/** 模型使用情况 */
export interface ModelUsage {
  model: string;
  tokens: number;
  cost: number;
  percentage: number;
}

/** 用户Token统计 */
export interface UserTokenStat {
  userId: string;
  totalTokens: number;
  totalCost: number;
  callCount: number;
}

/** Agent维度Token统计 */
export interface AgentTokenStat {
  agentId: string | null;
  agentName: string | null;
  totalTokens: number;
  totalCost: number;
  callCount: number;
}

/** Workflow维度Token统计 */
export interface WorkflowTokenStat {
  workflowId: string | null;
  workflowName: string | null;
  totalTokens: number;
  totalCost: number;
  callCount: number;
}

/** 组织维度Token统计 */
export interface OrganizationTokenStat {
  orgId: string | null;
  orgName: string | null;
  totalTokens: number;
  totalCost: number;
  userCount: number;
}

/** 角色维度Token统计 */
export interface RoleTokenStat {
  roleId: string | null;
  roleName: string | null;
  totalTokens: number;
  totalCost: number;
  userCount: number;
}

/** Token使用概览响应 */
export interface TokenOverviewResp {
  totalTokens: number;
  totalCost: number;
  modelUsage: ModelUsage[];
}

/** 全局Token使用概览响应 */
export interface GlobalTokenOverviewResp {
  totalUsers: number;
  totalTokens: number;
  totalCost: number;
  totalCalls: number;
  userStats: UserTokenStat[];
  modelUsage: ModelUsage[];
  agentStats: AgentTokenStat[];
  workflowStats: WorkflowTokenStat[];
  organizationStats: OrganizationTokenStat[];
  roleStats: RoleTokenStat[];
}

/** 消费记录项 */
export interface UsageRecord {
  id: string;
  userId: string;
  userName?: string;
  conversationId?: string;
  conversationTitle?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

/** 消费记录列表响应 */
export interface UsageRecordListResp {
  items: UsageRecord[];
  total: number;
}

/** Agent配置详情 */
export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  instruction?: string;
  greeting?: string;
  model?: string;
  knowledgeBase?: string[];
  tools?: string[];
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Workflow配置详情 */
export interface WorkflowConfig {
  id: string;
  name: string;
  description?: string;
  inputSchema: VariableSchema[];
  outputSchema: VariableSchema[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 角色权限类型 */
export type PermissionType = 'agent' | 'workflow' | 'tool' | 'knowledge';

/** 角色权限 */
export interface RolePermission {
  id: string;
  roleId: string;
  permissionType: PermissionType;
  permissionId: string;
  permissionName?: string;
  createdAt: string;
}

/** 角色信息 */
export interface Role {
  id: string;
  name: string;
  description?: string;
  userName?: string;
  phone?: string;
  department?: string;
  organizationId?: string;
  levelType?: LevelType;
  permissions: RolePermission[];
  createdAt: string;
  updatedAt: string;
}

/** 角色列表响应 */
export interface RoleListResp {
  items: Role[];
  total: number;
}

/** 创建角色请求 */
export interface CreateRoleRequest {
  name: string;
  description?: string;
  userName?: string;
  phone?: string;
  department?: string;
  organizationId?: string;
  levelType?: LevelType;
  permissions?: Array<{
    permissionType: PermissionType;
    permissionId: string;
  }>;
}

/** 更新角色请求 */
export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  userName?: string;
  phone?: string;
  department?: string;
  organizationId?: string;
  levelType?: LevelType;
  permissions?: Array<{
    permissionType: PermissionType;
    permissionId: string;
  }>;
}

// ========== LangGraph Agent 任务拆解相关类型 ==========

/** 子任务状态 */
export type SubTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

/** 子任务 */
export interface SubTask {
  id: string;
  description: string;
  status: SubTaskStatus;
  dependsOn?: string[];
  result?: string;
  error?: string;
}

/** 任务计划 */
export interface TaskPlan {
  tasks: SubTask[];
}

/** 执行任务请求 */
export interface ExecuteAgentRequest {
  query: string;
  enablePlanning?: boolean;
  stream?: boolean;
}

/** 执行任务响应 */
export interface ExecuteAgentResponse {
  executionId: string;
  plan?: TaskPlan;
  finalResponse?: string;
  status?: TaskExecutionStatus;
}

/** 任务执行状态 */
export type TaskExecutionStatus = 'running' | 'completed' | 'failed';

/** 子任务记录 */
export interface SubTaskRecord {
  id: string;
  executionId: string;
  taskId: string;
  description: string;
  status: SubTaskStatus;
  result?: string;
  toolCalls?: unknown;
  startedAt?: string;
  completedAt?: string;
}

/** 任务执行记录 */
export interface TaskExecutionRecord {
  id: string;
  agentId: string;
  userId: string;
  userQuery: string;
  status: TaskExecutionStatus;
  plan?: TaskPlan;
  result?: string;
  tokenUsage: number;
  createdAt: string;
  updatedAt: string;
}

/** 任务执行历史响应 */
export interface TaskExecutionListResp {
  items: TaskExecutionRecord[];
  total: number;
}

// ========== 组织管理相关类型 ==========

/** 层级类型 */
export type LevelType = 'management' | 'normal';

/** 组织信息 */
export interface Organization {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 组织列表响应 */
export interface OrganizationListResp {
  items: Organization[];
  total: number;
}

/** 创建组织请求 */
export interface CreateOrganizationRequest {
  name: string;
  description?: string;
}

/** 更新组织请求 */
export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
}

/** 组织资源授权 */
export interface OrganizationResourcePermission {
  id: string;
  organizationId: string;
  levelType: LevelType | 'all';
  resourceType: PermissionType;
  resourceId: string;
  createdAt: string;
}

/** 授予资源权限请求 */
export interface GrantResourcePermissionRequest {
  levelType: LevelType | 'all';
  resourceType: PermissionType;
  resourceId: string;
}

// ========== 数据源相关类型 ==========

/** 数据源类型 */
export type DataSourceType = 'feishu_bitable';

/** 数据源同步状态 */
export type DataSourceSyncStatus = 'pending' | 'syncing' | 'success' | 'failed';

/** 数据源信息 */
export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  baseToken: string;
  tableId: string;
  viewId?: string;
  description?: string;
  isActive: boolean;
  syncStatus: DataSourceSyncStatus;
  lastSyncAt?: string;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 数据源列表响应 */
export interface DataSourceListResp {
  items: DataSource[];
  total: number;
}

/** 创建数据源请求 */
export interface CreateDataSourceRequest {
  name: string;
  baseToken: string;
  tableId: string;
  viewId?: string;
  description?: string;
}

/** 更新数据源请求 */
export interface UpdateDataSourceRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

/** 同步数据响应 */
export interface SyncDataSourceResp {
  success: boolean;
  recordCount: number;
}

/** 同步后的数据记录 */
export interface SyncedDataRecord {
  id: string;
  recordId: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
