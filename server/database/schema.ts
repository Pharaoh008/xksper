/* eslint-disable */
/** auto generated, do not edit */
import { pgTable, index, pgPolicy, uuid, varchar, integer, uniqueIndex, text, boolean, jsonb, foreignKey, doublePrecision, bigint, check, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

/** Escape single quotes in SQL string literals */
function escapeLiteral(str: string): string {
  return `'${str.replace(/'/g, "''")}'`;
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number};
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number){
    if(value == null) return value as any;
    if (typeof value === 'number') {
      return new Date(value).toISOString();
    }
    if(typeof value === 'string') {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if(value instanceof Date) return value;
    return new Date(value);
  },
});

export const conversation = pgTable("conversation", {
  id: uuid().defaultRandom().notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: varchar({ length: 255 }).notNull(),
  model: varchar({ length: 100 }).notNull(),
  messageCount: integer("message_count").default(0),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_conversation_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_conversation_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const llmConfig = pgTable("llm_config", {
  id: uuid().defaultRandom().notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  apiKey: text("api_key").notNull(),
  baseUrl: varchar("base_url", { length: 255 }).default('https://wcnb.ai/v1'),
  isValid: boolean("is_valid").default(false),
  /**
   * @type { enabled_models?: string[]; default_model?: string }
   */
  configData: jsonb("config_data"),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
  enabledModels: text("enabled_models").array().default([""]),
  defaultModel: varchar("default_model", { length: 100 }),
}, (table) => [
  index("idx_llm_config_is_valid").using("btree", table.isValid.asc().nullsLast().op("bool_ops")),
  uniqueIndex("idx_llm_config_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const tokenUsage = pgTable("token_usage", {
  id: uuid().defaultRandom().notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  conversationId: uuid("conversation_id"),
  model: varchar({ length: 100 }).notNull(),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  cost: doublePrecision().default(0),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz('_updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
  agentId: uuid("agent_id"),
  workflowId: uuid("workflow_id"),
}, (table) => [
  index("idx_token_usage_agent_id").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
  index("idx_token_usage_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_token_usage_model").using("btree", table.model.asc().nullsLast().op("text_ops")),
  index("idx_token_usage_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  index("idx_token_usage_workflow_id").using("btree", table.workflowId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.conversationId],
    foreignColumns: [conversation.id],
    name: "token_usage_conversation_id_fkey"
  }).onDelete("set null"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const workflow = pgTable("workflow", {
  id: uuid().defaultRandom().notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  /**
   * 输入变量定义JSON
   */
  inputSchema: jsonb("input_schema").default([]),
  /**
   * 输出变量定义JSON
   */
  outputSchema: jsonb("output_schema").default([]),
  /**
   * 节点配置JSON
   */
  nodes: jsonb().default([]),
  /**
   * 连线配置JSON
   */
  edges: jsonb().default([]),
  isActive: boolean("is_active").default(true),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_workflow_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_workflow_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const agent = pgTable("agent", {
  id: uuid().defaultRandom().notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  instruction: text(),
  greeting: text(),
  model: varchar({ length: 100 }),
  knowledgeBase: text("knowledge_base").array(),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  isActive: boolean("is_active").default(true),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
  tools: text().array().default([""]),
}, (table) => [
  index("idx_agent_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_agent_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const message = pgTable("message", {
  id: uuid().defaultRandom().notNull(),
  conversationId: uuid("conversation_id").notNull(),
  role: varchar({ length: 50 }).notNull(),
  content: text().notNull(),
  tokenUsage: integer("token_usage").default(0),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz('_updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
  /**
   * 消息中引用的知识库和工具
   *
   * @type { Array<{ type: "knowledge" | "tool"; id: string; name: string }> }
   */
  mentions: jsonb(),
}, (table) => [
  index("idx_message_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("uuid_ops")),
  index("idx_message_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
  foreignKey({
    columns: [table.conversationId],
    foreignColumns: [conversation.id],
    name: "message_conversation_id_fkey"
  }).onDelete("cascade"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const knowledgeDocument = pgTable("knowledge_document", {
  id: uuid().defaultRandom().notNull(),
  knowledgeBaseId: uuid("knowledge_base_id").notNull(),
  name: varchar({ length: 500 }).notNull(),
  filePath: text("file_path"),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  fileSize: bigint("file_size", { mode: "number" }).default(0),
  fileType: varchar("file_type", { length: 100 }),
  content: text(),
  tokenCount: integer("token_count").default(0),
  status: varchar({ length: 50 }).default('pending'),
  errorMessage: text("error_message"),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
  folderId: uuid("folder_id"),
}, (table) => [
  index("idx_knowledge_document_folder_id").using("btree", table.folderId.asc().nullsLast().op("uuid_ops")),
  index("idx_knowledge_document_kb_id").using("btree", table.knowledgeBaseId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.knowledgeBaseId],
    foreignColumns: [knowledgeBase.id],
    name: "fk_knowledge_base"
  }).onDelete("cascade"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const role = pgTable("role", {
  id: uuid().defaultRandom().notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  userName: varchar("user_name", { length: 100 }),
  phone: varchar({ length: 50 }),
  department: varchar({ length: 200 }),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
  organizationId: uuid("organization_id"),
  levelType: varchar("level_type", { length: 20 }),
}, (table) => [
  foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organization.id],
    name: "role_organization_id_fkey"
  }).onDelete("set null"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  check("role_level_type_check", sql`(level_type)::text = ANY ((ARRAY['management'::character varying, 'normal'::character varying])::text[])`),
]);

export const tool = pgTable("tool", {
  id: uuid().defaultRandom().notNull(),
  name: varchar({ length: 100 }).notNull(),
  type: varchar({ length: 50 }).notNull(),
  description: text(),
  /**
   * 工具配置JSON
   */
  configData: jsonb("config_data").default({}),
  isActive: boolean("is_active").default(true),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_tool_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
  index("idx_tool_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const rolePermission = pgTable("role_permission", {
  id: uuid().defaultRandom().notNull(),
  roleId: uuid("role_id").notNull(),
  permissionType: varchar("permission_type", { length: 50 }).notNull(),
  permissionId: varchar("permission_id", { length: 255 }).notNull(),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz('_updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_role_permission_role_id").using("btree", table.roleId.asc().nullsLast().op("uuid_ops")),
  index("idx_role_permission_type").using("btree", table.permissionType.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.roleId],
    foreignColumns: [role.id],
    name: "role_permission_role_id_fkey"
  }).onDelete("cascade"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const knowledgeBase = pgTable("knowledge_base", {
  id: uuid().defaultRandom().notNull(),
  name: varchar({ length: 200 }).notNull(),
  description: text(),
  type: varchar({ length: 50 }).default('local').notNull(),
  feishuToken: text("feishu_token"),
  feishuSpaceId: varchar("feishu_space_id", { length: 255 }),
  /**
   * 飞书知识库节点ID列表
   */
  feishuNodeIds: jsonb("feishu_node_ids").default([]),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
  organizationId: uuid("organization_id"),
}, (table) => [
  index("idx_knowledge_base_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_knowledge_base_org_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const taskExecution = pgTable("task_execution", {
  id: uuid().defaultRandom().notNull(),
  agentId: uuid("agent_id").notNull(),
  userId: text("user_id").notNull(),
  userQuery: text("user_query").notNull(),
  status: text().default('running').notNull(),
  /**
   * 子任务计划 JSON
   */
  plan: jsonb(),
  result: text(),
  tokenUsage: integer("token_usage").default(0),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_task_execution_agent_id").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
  index("idx_task_execution_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_task_execution_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
  index("idx_task_execution_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.agentId],
    foreignColumns: [agent.id],
    name: "task_execution_agent_id_fkey"
  }),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const subTask = pgTable("sub_task", {
  id: uuid().defaultRandom().notNull(),
  executionId: uuid("execution_id").notNull(),
  taskId: text("task_id").notNull(),
  description: text().notNull(),
  status: text().default('pending').notNull(),
  result: text(),
  toolCalls: jsonb("tool_calls"),
  startedAt: customTimestamptz('started_at'),
  completedAt: customTimestamptz('completed_at'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz('_created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz('_updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_sub_task_execution_id").using("btree", table.executionId.asc().nullsLast().op("uuid_ops")),
  index("idx_sub_task_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.executionId],
    foreignColumns: [taskExecution.id],
    name: "sub_task_execution_id_fkey"
  }).onDelete("cascade"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const customModel = pgTable("custom_model", {
  id: uuid().defaultRandom().notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  modelId: varchar("model_id", { length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  type: varchar({ length: 50 }).default('gpt').notNull(),
  inputPrice: doublePrecision("input_price").default(0),
  outputPrice: doublePrecision("output_price").default(0),
  cacheReadPrice: doublePrecision("cache_read_price").default(0),
  pricePerRequest: doublePrecision("price_per_request").default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz('_created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz('_updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("idx_custom_model_user_model").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("text_ops")),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const organization = pgTable("organization", {
  id: uuid().defaultRandom().notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const organizationHierarchy = pgTable("organization_hierarchy", {
  id: uuid().defaultRandom().notNull(),
  organizationId: uuid("organization_id").notNull(),
  levelType: varchar("level_type", { length: 20 }).notNull(),
  parentId: uuid("parent_id"),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz('_updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_org_hierarchy_org_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organization.id],
    name: "organization_hierarchy_organization_id_fkey"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
    name: "organization_hierarchy_parent_id_fkey"
  }).onDelete("cascade"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  check("organization_hierarchy_level_type_check", sql`(level_type)::text = ANY ((ARRAY['management'::character varying, 'normal'::character varying])::text[])`),
]);

export const organizationResourcePermission = pgTable("organization_resource_permission", {
  id: uuid().defaultRandom().notNull(),
  organizationId: uuid("organization_id").notNull(),
  levelType: varchar("level_type", { length: 20 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: uuid("resource_id").notNull(),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz('_updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_org_resource_org_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
  index("idx_org_resource_resource_id").using("btree", table.resourceId.asc().nullsLast().op("uuid_ops")),
  index("idx_org_resource_type").using("btree", table.resourceType.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organization.id],
    name: "organization_resource_permission_organization_id_fkey"
  }).onDelete("cascade"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  check("organization_resource_permission_level_type_check", sql`(level_type)::text = ANY ((ARRAY['management'::character varying, 'normal'::character varying, 'all'::character varying])::text[])`),
  check("organization_resource_permission_resource_type_check", sql`(resource_type)::text = ANY ((ARRAY['knowledge_base'::character varying, 'agent'::character varying, 'workflow'::character varying, 'tool'::character varying])::text[])`),
]);

export const knowledgeFolder = pgTable("knowledge_folder", {
  id: uuid().defaultRandom().notNull(),
  knowledgeBaseId: uuid("knowledge_base_id").notNull(),
  parentId: uuid("parent_id"),
  name: varchar({ length: 255 }).notNull(),
  type: varchar({ length: 50 }).default('folder').notNull(),
  sortOrder: integer("sort_order").default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz('_created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz('_updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_knowledge_folder_kb_id").using("btree", table.knowledgeBaseId.asc().nullsLast().op("uuid_ops")),
  index("idx_knowledge_folder_parent_id").using("btree", table.parentId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.knowledgeBaseId],
    foreignColumns: [knowledgeBase.id],
    name: "fk_knowledge_folder_kb"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
    name: "fk_knowledge_folder_parent"
  }).onDelete("cascade"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const dataSource = pgTable("data_source", {
  id: uuid().defaultRandom().notNull(),
  name: varchar({ length: 200 }).notNull(),
  type: varchar({ length: 50 }).default('feishu_bitable').notNull(),
  baseToken: varchar("base_token", { length: 255 }).notNull(),
  tableId: varchar("table_id", { length: 255 }).notNull(),
  viewId: varchar("view_id", { length: 255 }),
  description: text(),
  isActive: boolean("is_active").default(true),
  lastSyncAt: customTimestamptz('last_sync_at'),
  syncStatus: varchar("sync_status", { length: 50 }).default('pending'),
  recordCount: integer("record_count").default(0),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_data_source_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_data_source_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
  index("idx_data_source_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const skill = pgTable("skill", {
  id: uuid().defaultRandom().notNull(),
  toolId: uuid("tool_id").notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  content: text().notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  /**
   * @type { Array<{ name: string; type: string; description: string; required?: boolean }> }
   */
  inputSchema: jsonb("input_schema").default({}),
  /**
   * @type { Array<{ name: string; type: string; description: string }> }
   */
  outputSchema: jsonb("output_schema").default({}),
  /**
   * @type { Array<{ input: Record<string, unknown>; output: string }> }
   */
  examples: jsonb().default([]),
  /**
   * @type { author?: string; tags?: string[]; category?: string }
   */
  metadata: jsonb().default({}),
  version: varchar({ length: 50 }).default('1.0.0'),
  isActive: boolean("is_active").default(true),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz('_created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz('_updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_skill_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
  index("idx_skill_tool_id").using("btree", table.toolId.asc().nullsLast().op("uuid_ops")),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

export const syncedData = pgTable("synced_data", {
  id: uuid().defaultRandom().notNull(),
  dataSourceId: uuid("data_source_id").notNull(),
  recordId: varchar("record_id", { length: 255 }).notNull(),
  data: jsonb().default({}).notNull(),
  createdAt: customTimestamptz('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('updated_at').default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_synced_data_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_synced_data_record_id").using("btree", table.recordId.asc().nullsLast().op("text_ops")),
  index("idx_synced_data_source_id").using("btree", table.dataSourceId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.dataSourceId],
    foreignColumns: [dataSource.id],
    name: "synced_data_data_source_id_fkey"
  }).onDelete("cascade"),
  pgPolicy("service_role_bypass_policy", { as: "permissive", for: "all", to: ["service_role_workspace_aadj27bhhdmis"], using: sql`true` }),
  pgPolicy("修改全部数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("查看全部数据", { as: "permissive", for: "select", to: ["anon_workspace_aadj27bhhdmis", "authenticated_workspace_aadj27bhhdmis"] }),
  pgPolicy("修改本人数据", { as: "permissive", for: "all", to: ["authenticated_workspace_aadj27bhhdmis"] }),
]);

// table aliases
export const agentTable = agent;
export const conversationTable = conversation;
export const customModelTable = customModel;
export const dataSourceTable = dataSource;
export const knowledgeBaseTable = knowledgeBase;
export const knowledgeDocumentTable = knowledgeDocument;
export const knowledgeFolderTable = knowledgeFolder;
export const llmConfigTable = llmConfig;
export const messageTable = message;
export const organizationTable = organization;
export const organizationHierarchyTable = organizationHierarchy;
export const organizationResourcePermissionTable = organizationResourcePermission;
export const roleTable = role;
export const rolePermissionTable = rolePermission;
export const skillTable = skill;
export const subTaskTable = subTask;
export const syncedDataTable = syncedData;
export const taskExecutionTable = taskExecution;
export const tokenUsageTable = tokenUsage;
export const toolTable = tool;
export const workflowTable = workflow;
