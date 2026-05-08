import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, Key, Globe, Info, Settings2, AlertCircle, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getConfigStatus, saveConfig, validateConfig, getCustomModels, createCustomModel, deleteCustomModel } from '@/api/index';
import type { ConfigStatusResp, ModelPricing, CustomModel } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

const DEFAULT_BASE_URL = 'https://wcnb.ai/v1';
const MAX_ENABLED_MODELS = 10;

const ApiConfigTab: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [showApiKey, setShowApiKey] = useState(false);
  const [configStatus, setConfigStatus] = useState<ConfigStatusResp | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [enabledModels, setEnabledModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<ModelPricing[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | null; text: string }>({
    type: null,
    text: '',
  });

  // 自定义模型状态
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModel, setNewModel] = useState({
    modelId: '',
    name: '',
    type: 'gpt' as const,
    inputPrice: '',
    outputPrice: '',
    cacheReadPrice: '',
  });
  const [isAddingModel, setIsAddingModel] = useState(false);

  // 编辑模型状态
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editModelData, setEditModelData] = useState<Partial<ModelPricing>>({});

  useEffect(() => {
    const fetchConfigStatus = async () => {
      try {
        const [status, customModelList] = await Promise.all([
          getConfigStatus(),
          getCustomModels(),
        ]);
        setConfigStatus(status);
        setCustomModels(customModelList);
        if (status.baseUrl) {
          setBaseUrl(status.baseUrl);
        }
        setAvailableModels(status.availableModels || []);
        
        // 过滤已启用的模型，只保留当前可用模型列表中存在的
        const availableModelIds = new Set((status.availableModels || []).map(m => m.id));
        const validEnabledModels = (status.enabledModels || []).filter(id => availableModelIds.has(id));
        setEnabledModels(validEnabledModels);
        
        // 如果默认模型不在有效列表中，清除默认模型
        if (status.defaultModel && !validEnabledModels.includes(status.defaultModel)) {
          setDefaultModel(validEnabledModels.length > 0 ? validEnabledModels[0] : '');
        } else {
          setDefaultModel(status.defaultModel || '');
        }
      } catch (error) {
        logger.error('获取配置状态失败', error);
      }
    };
    fetchConfigStatus();
  }, []);

  const handleSave = async () => {
    // 检查是否有现有配置或输入了 API Key
    const hasExistingConfig = configStatus?.apiKeyMask && configStatus.apiKeyMask !== '未设置';
    if (!apiKey.trim() && !hasExistingConfig) {
      setStatusMessage({ type: 'warning', text: '请输入 API Key' });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: null, text: '' });

    try {
      const result = await saveConfig({
        apiKey: apiKey.trim() || undefined,
        baseUrl: baseUrl.trim() || DEFAULT_BASE_URL,
        enabledModels,
        defaultModel: defaultModel || undefined,
      });

      if (result.success) {
        setStatusMessage({
          type: result.isValid ? 'success' : 'warning',
          text: result.message || (result.isValid ? '配置保存成功' : '配置已保存，但验证未通过'),
        });
        setApiKey('');
        const status = await getConfigStatus();
        setConfigStatus(status);
        setAvailableModels(status.availableModels || []);
        
        // 过滤已启用的模型，只保留当前可用模型列表中存在的
        const availableModelIds = new Set((status.availableModels || []).map(m => m.id));
        const validEnabledModels = (status.enabledModels || []).filter(id => availableModelIds.has(id));
        setEnabledModels(validEnabledModels);
        
        // 如果默认模型不在有效列表中，清除默认模型
        if (status.defaultModel && !validEnabledModels.includes(status.defaultModel)) {
          setDefaultModel(validEnabledModels.length > 0 ? validEnabledModels[0] : '');
        } else {
          setDefaultModel(status.defaultModel || '');
        }
      } else {
        setStatusMessage({ type: 'error', text: result.message || '保存失败' });
      }
    } catch (error) {
      logger.error('保存配置失败', error);
      setStatusMessage({ type: 'error', text: '保存配置时发生错误' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveModelsOnly = async () => {
    setIsLoading(true);
    setStatusMessage({ type: null, text: '' });

    try {
      const result = await saveConfig({
        apiKey: undefined,
        baseUrl: baseUrl.trim() || DEFAULT_BASE_URL,
        enabledModels,
        defaultModel: defaultModel || undefined,
      });

      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: '模型配置已保存',
        });
        const status = await getConfigStatus();
        setConfigStatus(status);
        setAvailableModels(status.availableModels || []);
        
        // 过滤已启用的模型，只保留当前可用模型列表中存在的
        const availableModelIds = new Set((status.availableModels || []).map(m => m.id));
        const validEnabledModels = (status.enabledModels || []).filter(id => availableModelIds.has(id));
        setEnabledModels(validEnabledModels);
        
        // 如果默认模型不在有效列表中，清除默认模型
        if (status.defaultModel && !validEnabledModels.includes(status.defaultModel)) {
          setDefaultModel(validEnabledModels.length > 0 ? validEnabledModels[0] : '');
        } else {
          setDefaultModel(status.defaultModel || '');
        }
      } else {
        setStatusMessage({ type: 'error', text: result.message || '保存失败' });
      }
    } catch (error) {
      logger.error('保存模型配置失败', error);
      setStatusMessage({ type: 'error', text: '保存模型配置时发生错误' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setStatusMessage({ type: 'warning', text: '请输入 API Key 进行验证' });
      return;
    }

    setIsValidating(true);
    setStatusMessage({ type: null, text: '' });

    try {
      const result = await validateConfig({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || DEFAULT_BASE_URL,
      });

      if (result.success) {
        setStatusMessage({ type: 'success', text: result.message || '验证成功，API Key 有效' });
      } else {
        setStatusMessage({ type: 'error', text: result.message || '验证失败，API Key 无效' });
      }
    } catch (error) {
      logger.error('验证配置失败', error);
      setStatusMessage({ type: 'error', text: '验证配置时发生错误' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleModelToggle = (modelId: string, checked: boolean) => {
    if (checked) {
      if (enabledModels.length >= MAX_ENABLED_MODELS) {
        setStatusMessage({
          type: 'warning',
          text: `最多只能选择 ${MAX_ENABLED_MODELS} 个模型`,
        });
        return;
      }
      const newEnabled = [...enabledModels, modelId];
      setEnabledModels(newEnabled);
      // 如果没有设置默认模型，自动设置为第一个启用的模型
      if (!defaultModel) {
        setDefaultModel(modelId);
      }
    } else {
      const newEnabled = enabledModels.filter(id => id !== modelId);
      setEnabledModels(newEnabled);
      // 如果取消选中的是默认模型，清除默认模型
      if (defaultModel === modelId) {
        setDefaultModel(newEnabled.length > 0 ? newEnabled[0] : '');
      }
    }
  };

  const handleSetDefault = (modelId: string) => {
    if (!enabledModels.includes(modelId)) {
      // 如果模型未启用，先启用它
      if (enabledModels.length >= MAX_ENABLED_MODELS) {
        setStatusMessage({
          type: 'warning',
          text: `最多只能选择 ${MAX_ENABLED_MODELS} 个模型，请先取消其他模型`,
        });
        return;
      }
      setEnabledModels([...enabledModels, modelId]);
    }
    setDefaultModel(modelId);
  };

  // 按类型分组模型（availableModels 已包含自定义模型）
  const modelsByType = availableModels.reduce((acc, model) => {
    if (!acc[model.type]) {
      acc[model.type] = [];
    }
    acc[model.type].push(model);
    return acc;
  }, {} as Record<string, ModelPricing[]>);

  const typeLabels: Record<string, string> = {
    gpt: 'GPT 系列 (OpenAI)',
    claude: 'Claude 系列 (Anthropic)',
    gemini: 'Gemini 系列 (Google)',
    deepseek: 'DeepSeek 系列',
  };

  const typeOrder = ['gpt', 'claude', 'gemini', 'deepseek'];

  // 处理添加自定义模型
  const handleAddCustomModel = async () => {
    if (!newModel.modelId.trim() || !newModel.name.trim()) {
      setStatusMessage({ type: 'error', text: '请输入模型ID和名称' });
      return;
    }

    const trimmedModelId = newModel.modelId.trim();

    // 检查模型ID是否已存在
    if (availableModels.some(m => m.id === trimmedModelId)) {
      setStatusMessage({ type: 'error', text: `模型 "${trimmedModelId}" 已存在，无法重复添加` });
      return;
    }

    setIsAddingModel(true);
    try {
      const created = await createCustomModel({
        modelId: trimmedModelId,
        name: newModel.name.trim(),
        type: newModel.type,
        inputPrice: newModel.inputPrice ? parseFloat(newModel.inputPrice) : 0,
        outputPrice: newModel.outputPrice ? parseFloat(newModel.outputPrice) : 0,
        cacheReadPrice: newModel.cacheReadPrice ? parseFloat(newModel.cacheReadPrice) : undefined,
      });
      setCustomModels([...customModels, created]);
      // 同时更新 availableModels，将新模型添加到列表
      const newModelAsPricing: ModelPricing = {
        id: created.modelId,
        name: created.name,
        type: created.type,
        inputPrice: created.inputPrice,
        outputPrice: created.outputPrice,
        cacheReadPrice: created.cacheReadPrice,
        pricePerRequest: created.pricePerRequest,
      };
      setAvailableModels([...availableModels, newModelAsPricing]);
      setNewModel({
        modelId: '',
        name: '',
        type: 'gpt',
        inputPrice: '',
        outputPrice: '',
        cacheReadPrice: '',
      });
      setShowAddModel(false);
      setStatusMessage({ type: 'success', text: '自定义模型添加成功' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: '添加自定义模型失败' });
    } finally {
      setIsAddingModel(false);
    }
  };

  // 处理删除自定义模型
  const handleDeleteCustomModel = async (modelId: string) => {
    try {
      await deleteCustomModel(modelId);
      setCustomModels(customModels.filter(m => m.modelId !== modelId));
      // 同时从 availableModels 中移除
      setAvailableModels(availableModels.filter(m => m.id !== modelId));
      // 如果删除的是已启用的模型，从启用列表中移除
      if (enabledModels.includes(modelId)) {
        const newEnabled = enabledModels.filter(id => id !== modelId);
        setEnabledModels(newEnabled);
        if (defaultModel === modelId) {
          setDefaultModel(newEnabled.length > 0 ? newEnabled[0] : '');
        }
      }
      setStatusMessage({ type: 'success', text: '自定义模型已删除' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: '删除自定义模型失败' });
    }
  };

  // 开始编辑模型
  const handleStartEdit = (model: ModelPricing) => {
    setEditingModel(model.id);
    setEditModelData({
      name: model.name,
      inputPrice: model.inputPrice,
      outputPrice: model.outputPrice,
      cacheReadPrice: model.cacheReadPrice,
    });
  };

  // 保存编辑
  const handleSaveEdit = async (modelId: string) => {
    // 这里只更新自定义模型，预定义模型无法修改
    const customModel = customModels.find(m => m.modelId === modelId);
    if (customModel) {
      // 更新 customModels
      setCustomModels(customModels.map(m =>
        m.modelId === modelId
          ? {
              ...m,
              name: editModelData.name || m.name,
              inputPrice: editModelData.inputPrice ?? m.inputPrice,
              outputPrice: editModelData.outputPrice ?? m.outputPrice,
              cacheReadPrice: editModelData.cacheReadPrice ?? m.cacheReadPrice,
            }
          : m
      ));
      // 同时更新 availableModels
      setAvailableModels(availableModels.map(m =>
        m.id === modelId
          ? {
              ...m,
              name: editModelData.name || m.name,
              inputPrice: editModelData.inputPrice ?? m.inputPrice,
              outputPrice: editModelData.outputPrice ?? m.outputPrice,
              cacheReadPrice: editModelData.cacheReadPrice ?? m.cacheReadPrice,
            }
          : m
      ));
    }
    setEditingModel(null);
    setEditModelData({});
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingModel(null);
    setEditModelData({});
  };

  // 删除任意模型（预定义模型只在本地删除，自定义模型调用API）
  const handleDeleteModel = async (modelId: string) => {
    // 检查是否是自定义模型
    const isCustom = customModels.some(m => m.modelId === modelId);

    if (isCustom) {
      await handleDeleteCustomModel(modelId);
    } else {
      // 预定义模型：只在本地移除
      setAvailableModels(availableModels.filter(m => m.id !== modelId));
      // 如果删除的是已启用的模型，从启用列表中移除
      if (enabledModels.includes(modelId)) {
        const newEnabled = enabledModels.filter(id => id !== modelId);
        setEnabledModels(newEnabled);
        if (defaultModel === modelId) {
          setDefaultModel(newEnabled.length > 0 ? newEnabled[0] : '');
        }
      }
    }
  };

  // 判断是否是自定义模型
  const isCustomModel = (modelId: string): boolean => {
    return customModels.some(m => m.modelId === modelId);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {statusMessage.type && (
          <Alert
            variant={
              statusMessage.type === 'success'
                ? 'default'
                : statusMessage.type === 'warning'
                ? 'default'
                : 'destructive'
            }
            className={
              statusMessage.type === 'success'
                ? 'border-green-500 text-green-700'
                : statusMessage.type === 'warning'
                ? 'border-yellow-500 text-yellow-700'
                : ''
            }
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : statusMessage.type === 'error' ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            <AlertTitle>
              {statusMessage.type === 'success'
                ? '成功'
                : statusMessage.type === 'warning'
                ? '警告'
                : '错误'}
            </AlertTitle>
            <AlertDescription>{statusMessage.text}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              API 配置
            </CardTitle>
            <CardDescription>配置 wcnb.ai 中转站的 API 密钥和模型参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="输入您的 API Key"
                  className="pr-10 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">您的 API Key 将被安全加密存储</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Base URL</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={DEFAULT_BASE_URL}
                  className="pl-10 font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">API 服务的基础 URL，通常不需要修改</p>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={isLoading} className="flex-1">
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
                保存配置
              </Button>
              <Button variant="outline" onClick={handleValidate} disabled={isValidating}>
                {isValidating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                验证
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              模型配置
            </CardTitle>
            <CardDescription>
              选择要启用的模型（最多 {MAX_ENABLED_MODELS} 个），设置默认模型
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{enabledModels.length}/{MAX_ENABLED_MODELS}</Badge>
                <span className="text-sm text-muted-foreground">已启用模型</span>
              </div>
              {defaultModel && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">默认模型:</span>
                  <Badge variant="default">
                    {availableModels.find(m => m.id === defaultModel)?.name || defaultModel}
                  </Badge>
                </div>
              )}
            </div>

            <Separator />

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {typeOrder.map((type) => {
                  const models = modelsByType[type];
                  if (!models || models.length === 0) return null;

                  return (
                    <div key={type} className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        {typeLabels[type] || type}
                      </h4>
                      <div className="space-y-2">
                        {models.map((model) => {
                          const isEnabled = enabledModels.includes(model.id);
                          const isDefault = defaultModel === model.id;
                          const isEditing = editingModel === model.id;
                          const custom = isCustomModel(model.id);

                          return (
                            <div
                              key={model.id}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                isEnabled
                                  ? 'bg-accent border-primary/20'
                                  : 'bg-card border-border hover:bg-accent/50'
                              }`}
                            >
                              {isEditing ? (
                                // 编辑模式
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={editModelData.name || ''}
                                      onChange={(e) => setEditModelData({ ...editModelData, name: e.target.value })}
                                      placeholder="模型名称"
                                      className="flex-1"
                                    />
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editModelData.inputPrice ?? ''}
                                      onChange={(e) => setEditModelData({ ...editModelData, inputPrice: parseFloat(e.target.value) || 0 })}
                                      placeholder="输入价格"
                                    />
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editModelData.outputPrice ?? ''}
                                      onChange={(e) => setEditModelData({ ...editModelData, outputPrice: parseFloat(e.target.value) || 0 })}
                                      placeholder="输出价格"
                                    />
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editModelData.cacheReadPrice ?? ''}
                                      onChange={(e) => setEditModelData({ ...editModelData, cacheReadPrice: parseFloat(e.target.value) || undefined })}
                                      placeholder="缓存价格"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleSaveEdit(model.id)}>保存</Button>
                                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}>取消</Button>
                                  </div>
                                </div>
                              ) : (
                                // 展示模式
                                <>
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <Checkbox
                                      id={`model-${model.id}`}
                                      checked={isEnabled}
                                      onCheckedChange={(checked) =>
                                        handleModelToggle(model.id, checked as boolean)
                                      }
                                    />
                                    <div className="flex-1 min-w-0">
                                      <Label
                                        htmlFor={`model-${model.id}`}
                                        className="font-medium cursor-pointer flex items-center gap-2"
                                      >
                                        {model.name}
                                        {isDefault && (
                                          <Badge variant="default" className="text-[10px] h-5">
                                            默认
                                          </Badge>
                                        )}
                                      </Label>
                                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                        {model.pricePerRequest ? (
                                          <span>¥{model.pricePerRequest.toFixed(3)}/次</span>
                                        ) : (
                                          <>
                                            <span>输入: ¥{model.inputPrice.toFixed(2)}/M</span>
                                            <span>输出: ¥{model.outputPrice.toFixed(2)}/M</span>
                                            {model.cacheReadPrice && (
                                              <span>缓存: ¥{model.cacheReadPrice.toFixed(2)}/M</span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isEnabled && (
                                      <Button
                                        variant={isDefault ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => handleSetDefault(model.id)}
                                      >
                                        {isDefault ? (
                                          <>
                                            <Check className="h-3 w-3 mr-1" />
                                            默认
                                          </>
                                        ) : (
                                          '设为默认'
                                        )}
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleStartEdit(model)}
                                      title="编辑"
                                    >
                                      <Settings2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteModel(model.id)}
                                      className="text-destructive hover:text-destructive"
                                      title="删除"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* 自定义模型管理 */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">自定义模型</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModel(!showAddModel)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {showAddModel ? '取消' : '添加模型'}
                </Button>
              </div>

              {showAddModel && (
                <div className="space-y-3 p-4 bg-accent/50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm">模型ID <span className="text-red-500">*</span></Label>
                    <Input
                      value={newModel.modelId}
                      onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })}
                      placeholder="如: gpt-3.5-turbo-0125"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">显示名称 <span className="text-red-500">*</span></Label>
                    <Input
                      value={newModel.name}
                      onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                      placeholder="如: GPT-3.5 Turbo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">模型类型</Label>
                    <select
                      value={newModel.type}
                      onChange={(e) => setNewModel({ ...newModel, type: e.target.value as typeof newModel.type })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="gpt">GPT 系列</option>
                      <option value="claude">Claude 系列</option>
                      <option value="gemini">Gemini 系列</option>
                      <option value="deepseek">DeepSeek 系列</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">输入价格 (¥/M)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newModel.inputPrice}
                        onChange={(e) => setNewModel({ ...newModel, inputPrice: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">输出价格 (¥/M)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newModel.outputPrice}
                        onChange={(e) => setNewModel({ ...newModel, outputPrice: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">缓存价格 (¥/M)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newModel.cacheReadPrice}
                        onChange={(e) => setNewModel({ ...newModel, cacheReadPrice: e.target.value })}
                        placeholder="选填"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddCustomModel}
                    disabled={isAddingModel}
                    className="w-full"
                  >
                    {isAddingModel ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    添加模型
                  </Button>
                </div>
              )}
            </div>

            {enabledModels.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium">默认模型选择</Label>
                  <RadioGroup
                    value={defaultModel}
                    onValueChange={handleSetDefault}
                    className="grid grid-cols-2 gap-2"
                  >
                    {enabledModels.map((modelId) => {
                      const model = availableModels.find(m => m.id === modelId);
                      if (!model) return null;
                      return (
                        <div key={modelId} className="flex items-center space-x-2">
                          <RadioGroupItem value={modelId} id={`default-${modelId}`} />
                          <Label htmlFor={`default-${modelId}`} className="text-sm cursor-pointer">
                            {model.name}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </div>
              </>
            )}

            <Separator />

            <Button
              onClick={handleSaveModelsOnly}
              disabled={isLoading}
              className="w-full"
              variant={configStatus?.apiKeyMask && configStatus.apiKeyMask !== '未设置' ? 'default' : 'secondary'}
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              保存模型配置
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">当前配置状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">状态</p>
                <div className="flex items-center gap-2">
                  <Badge variant={configStatus?.isValid ? 'default' : 'destructive'}>
                    {configStatus?.isValid ? '有效' : '未配置'}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">API Key</p>
                <p className="font-mono text-sm text-foreground">{configStatus?.apiKeyMask || '未设置'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Base URL</p>
                <p className="font-mono text-sm text-foreground truncate">
                  {configStatus?.baseUrl || DEFAULT_BASE_URL}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">已启用模型</p>
                <p className="text-sm text-foreground">{configStatus?.enabledModels?.length || 0} 个</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">默认模型</p>
                <p className="text-sm text-foreground">
                  {configStatus?.defaultModel
                    ? (availableModels.find(m => m.id === configStatus.defaultModel)?.name || configStatus.defaultModel)
                    : '未设置'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">配置说明</CardTitle>
            <CardDescription>wcnb.ai 中转站使用指南</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">获取 API Key</h3>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>访问 <span className="font-mono bg-accent px-1 rounded">wcnb.ai</span> 官网</li>
                <li>注册/登录账号</li>
                <li>在个人中心获取 API Key</li>
                <li>复制密钥并粘贴到左侧表单</li>
              </ol>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">模型配置说明</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-warning" />
                  最多可选择 10 个模型
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-warning" />
                  必须设置一个默认模型
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-warning" />
                  价格单位：¥/百万 tokens
                </li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">注意事项</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-warning mt-0.5">⚠</span>API Key 仅显示一次，请妥善保管</li>
                <li className="flex items-start gap-2"><span className="text-warning mt-0.5">⚠</span>建议定期更换 API Key</li>
                <li className="flex items-start gap-2"><span className="text-warning mt-0.5">⚠</span>请勿在公共场合泄露您的密钥</li>
                <li className="flex items-start gap-2"><span className="text-warning mt-0.5">⚠</span>费用将根据实际使用量计算</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApiConfigTab;
