import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { llmConfig, customModel } from '@server/database/schema';
import { eq, and } from 'drizzle-orm';
import type { ConfigStatusResp, SaveConfigRequest, SaveConfigResp, ValidateConfigResp, ModelPricing, ModelType, CustomModel, CreateCustomModelRequest } from '@shared/api.interface';
import axios from 'axios';

/** 模型定价表 (单位: 每千token人民币)
 * 价格来源: wcnb.ai 中转站定价 (¥/1M tokens) / 1000 = ¥/1K tokens
 */
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead?: number; cacheCreate?: number; pricePerRequest?: number }> = {
  // GPT 系列
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-5-mini': { input: 0.00025, output: 0.002, cacheRead: 0.000025 },
  'gpt-5.4': { input: 0.0025, output: 0.015, cacheRead: 0.00025 },
  // Claude 系列
  'claude-haiku-4-5-20251001': { input: 0.001, output: 0.005, cacheRead: 0.0001, cacheCreate: 0.00125 },
  'claude-opus-4-6': { input: 0.005, output: 0.025, cacheRead: 0.0005, cacheCreate: 0.00625 },
  'claude-sonnet-4-6': { input: 0.003, output: 0.015, cacheRead: 0.0003 },
  // Gemini 系列 (按次计费)
  'gemini-2.5-flash-image': { input: 0, output: 0, pricePerRequest: 0.04 },
  'gemini-3-pro-image-preview': { input: 0, output: 0, pricePerRequest: 0.24 },
};

/** 完整的模型列表 (wcnb.ai 中转站模型) */
const ALL_MODELS: Array<{ id: string; name: string; type: ModelType }> = [
  // GPT 系列 (OpenAI)
  { id: 'gpt-4o', name: 'gpt-4o', type: 'gpt' },
  { id: 'gpt-4o-mini', name: 'gpt-4o-mini', type: 'gpt' },
  { id: 'gpt-5-mini', name: 'gpt-5-mini', type: 'gpt' },
  { id: 'gpt-5.4', name: 'gpt-5.4', type: 'gpt' },
  // Claude 系列 (Anthropic)
  { id: 'claude-haiku-4-5-20251001', name: 'claude-haiku-4-5-20251001', type: 'claude' },
  { id: 'claude-opus-4-6', name: 'claude-opus-4-6', type: 'claude' },
  { id: 'claude-sonnet-4-6', name: 'claude-sonnet-4-6', type: 'claude' },
  // Gemini 系列 (Google)
  { id: 'gemini-2.5-flash-image', name: 'gemini-2.5-flash-image', type: 'gemini' },
  { id: 'gemini-3-pro-image-preview', name: 'gemini-3-pro-image-preview', type: 'gemini' },
];

/** 获取带定价的模型列表 */
const getAvailableModelsWithPricing = (): ModelPricing[] => {
  return ALL_MODELS.map(model => {
    const pricing = MODEL_PRICING[model.id] || { input: 0, output: 0 };
    return {
      id: model.id,
      name: model.name,
      type: model.type,
      inputPrice: pricing.input * 1000, // 转换为每百万token价格
      outputPrice: pricing.output * 1000,
      cacheReadPrice: pricing.cacheRead ? pricing.cacheRead * 1000 : undefined,
      cacheCreatePrice: pricing.cacheCreate ? pricing.cacheCreate * 1000 : undefined,
      pricePerRequest: pricing.pricePerRequest,
    };
  });
};

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly defaultBaseUrl = 'https://wcnb.ai/v1';

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /**
   * 加密 API Key
   */
  private encryptApiKey(apiKey: string): string {
    return Buffer.from(apiKey).toString('base64');
  }

  /**
   * 解密 API Key
   */
  private decryptApiKey(encryptedKey: string): string {
    return Buffer.from(encryptedKey, 'base64').toString('utf-8');
  }

  /**
   * 生成 API Key 掩码
   */
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return apiKey.substring(0, 2) + '****';
    }
    return apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
  }

  /**
   * 验证 API 配置有效性
   * 尝试多个常用模型，只要有一个成功即认为配置有效
   */
  async validateConfig(apiKey: string, baseUrl?: string): Promise<{ valid: boolean; message: string }> {
    const targetBaseUrl = baseUrl || this.defaultBaseUrl;
    const modelsToTry = ['gpt-5-mini', 'claude-haiku-4-5-20251001'];

    for (const model of modelsToTry) {
      try {
        const response = await axios.post(
          `${targetBaseUrl}/chat/completions`,
          {
            model: model,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 10000,
          },
        );

        if (response.status === 200) {
          return { valid: true, message: '配置有效' };
        }
      } catch (error: unknown) {
        // 如果是模型不可用错误，继续尝试下一个模型
        if (axios.isAxiosError(error)) {
          const errorMsg = error.response?.data?.error?.message || '';
          // 如果是模型不可用，继续尝试
          if (errorMsg.includes('No available channel for model') || errorMsg.includes('model not found')) {
            continue;
          }
          // 其他错误（如401、403）直接返回失败
          if (error.response?.status === 401) {
            return { valid: false, message: 'API Key 无效或已过期' };
          }
          if (error.response?.status === 403) {
            return { valid: false, message: 'API Key 权限不足' };
          }
          // 其他网络错误也继续尝试其他模型
          continue;
        }
      }
    }

    return { valid: false, message: '验证失败：无可用模型，请确认账户余额和模型配置' };
  }

  /**
   * 获取当前用户配置状态
   */
  async getConfigStatus(userId: string): Promise<ConfigStatusResp> {
    const [configResult, customModelList] = await Promise.all([
      this.db
        .select({
          baseUrl: llmConfig.baseUrl,
          isValid: llmConfig.isValid,
          apiKey: llmConfig.apiKey,
          enabledModels: llmConfig.enabledModels,
          defaultModel: llmConfig.defaultModel,
        })
        .from(llmConfig)
        .where(eq(llmConfig.userId, userId))
        .limit(1),
      this.getCustomModels(userId),
    ]);

    // 将自定义模型转换为 ModelPricing 格式
    const customModelsAsPricing: ModelPricing[] = customModelList.map(m => ({
      id: m.modelId,
      name: m.name,
      type: m.type,
      inputPrice: m.inputPrice,
      outputPrice: m.outputPrice,
      cacheReadPrice: m.cacheReadPrice,
      pricePerRequest: m.pricePerRequest,
    }));

    const allAvailableModels = [...getAvailableModelsWithPricing(), ...customModelsAsPricing];

    if (configResult.length === 0) {
      return {
        baseUrl: this.defaultBaseUrl,
        isValid: false,
        apiKeyMask: '',
        enabledModels: [],
        defaultModel: null,
        availableModels: allAvailableModels,
      };
    }

    const config = configResult[0];
    const decryptedApiKey = this.decryptApiKey(config.apiKey);

    return {
      baseUrl: config.baseUrl || this.defaultBaseUrl,
      isValid: config.isValid || false,
      apiKeyMask: this.maskApiKey(decryptedApiKey),
      enabledModels: config.enabledModels || [],
      defaultModel: config.defaultModel || null,
      availableModels: allAvailableModels,
    };
  }

  /**
   * 保存用户配置
   */
  async saveConfig(userId: string, request: SaveConfigRequest): Promise<SaveConfigResp> {
    const { apiKey, baseUrl, enabledModels, defaultModel } = request;

    // 检查是否已存在配置
    const existingConfig = await this.db
      .select({
        id: llmConfig.id,
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl,
        isValid: llmConfig.isValid,
      })
      .from(llmConfig)
      .where(eq(llmConfig.userId, userId))
      .limit(1);

    const hasExistingConfig = existingConfig.length > 0;
    const existingApiKey = hasExistingConfig ? this.decryptApiKey(existingConfig[0].apiKey) : null;

    // 确定要使用的 API Key 和 Base URL
    const targetApiKey = apiKey || existingApiKey;
    const targetBaseUrl = baseUrl || (hasExistingConfig ? existingConfig[0].baseUrl : this.defaultBaseUrl);

    // 如果没有 API Key（新建配置且未提供），返回错误
    if (!targetApiKey) {
      return {
        success: false,
        isValid: false,
        message: '请提供 API Key',
      };
    }

    // 验证配置有效性（仅当有新的 apiKey 或 baseUrl 时）
    let validation = { valid: hasExistingConfig ? existingConfig[0].isValid : false, message: '配置已更新' };
    if (apiKey || (baseUrl && baseUrl !== (hasExistingConfig ? existingConfig[0].baseUrl : this.defaultBaseUrl))) {
      validation = await this.validateConfig(targetApiKey, targetBaseUrl);
    }

    // 加密存储
    const encryptedApiKey = this.encryptApiKey(targetApiKey);

    if (hasExistingConfig) {
      // 更新现有配置
      await this.db
        .update(llmConfig)
        .set({
          apiKey: encryptedApiKey,
          baseUrl: targetBaseUrl,
          isValid: validation.valid,
          enabledModels: enabledModels !== undefined ? enabledModels : undefined,
          defaultModel: defaultModel !== undefined ? defaultModel : undefined,
          updatedAt: new Date(),
        })
        .where(eq(llmConfig.userId, userId));
    } else {
      // 创建新配置
      await this.db.insert(llmConfig).values({
        userId,
        apiKey: encryptedApiKey,
        baseUrl: targetBaseUrl,
        isValid: validation.valid,
        enabledModels: enabledModels || [],
        defaultModel: defaultModel || null,
      });
    }

    return {
      success: true,
      isValid: validation.valid,
      message: validation.message,
    };
  }

  /**
   * 仅验证配置，不保存
   */
  async validateConfigOnly(request: SaveConfigRequest): Promise<ValidateConfigResp> {
    const { apiKey, baseUrl } = request;
    const targetBaseUrl = baseUrl || this.defaultBaseUrl;

    const validation = await this.validateConfig(apiKey, targetBaseUrl);

    return {
      success: validation.valid,
      message: validation.message,
    };
  }

  /**
   * 获取所有可用模型列表（带定价）
   */
  getAllModels(): ModelPricing[] {
    return getAvailableModelsWithPricing();
  }

  /**
   * 获取用户的自定义模型列表
   */
  async getCustomModels(userId: string): Promise<CustomModel[]> {
    const result = await this.db
      .select({
        id: customModel.id,
        modelId: customModel.modelId,
        name: customModel.name,
        type: customModel.type,
        inputPrice: customModel.inputPrice,
        outputPrice: customModel.outputPrice,
        cacheReadPrice: customModel.cacheReadPrice,
        pricePerRequest: customModel.pricePerRequest,
      })
      .from(customModel)
      .where(eq(customModel.userId, userId));

    return result.map(m => ({
      ...m,
      type: m.type as ModelType,
    }));
  }

  /**
   * 创建自定义模型
   */
  async createCustomModel(userId: string, request: CreateCustomModelRequest): Promise<CustomModel> {
    // 检查自定义模型是否已存在
    const existingCustom = await this.db
      .select({ id: customModel.id })
      .from(customModel)
      .where(and(eq(customModel.userId, userId), eq(customModel.modelId, request.modelId)))
      .limit(1);

    if (existingCustom.length > 0) {
      throw new Error(`模型 "${request.modelId}" 已存在`);
    }

    // 检查是否与预定义模型ID冲突
    const allPredefinedModels = ALL_MODELS.map(m => m.id);
    if (allPredefinedModels.includes(request.modelId)) {
      throw new Error(`模型 "${request.modelId}" 是预定义模型，无法重复添加`);
    }

    const result = await this.db
      .insert(customModel)
      .values({
        userId,
        modelId: request.modelId,
        name: request.name,
        type: request.type,
        inputPrice: request.inputPrice ?? 0,
        outputPrice: request.outputPrice ?? 0,
        cacheReadPrice: request.cacheReadPrice ?? 0,
        pricePerRequest: request.pricePerRequest ?? 0,
      })
      .returning();

    return {
      id: result[0].id,
      modelId: result[0].modelId,
      name: result[0].name,
      type: result[0].type as ModelType,
      inputPrice: result[0].inputPrice,
      outputPrice: result[0].outputPrice,
      cacheReadPrice: result[0].cacheReadPrice,
      pricePerRequest: result[0].pricePerRequest,
    };
  }

  /**
   * 删除自定义模型
   */
  async deleteCustomModel(userId: string, modelId: string): Promise<void> {
    await this.db
      .delete(customModel)
      .where(and(eq(customModel.userId, userId), eq(customModel.modelId, modelId)));
  }
}
