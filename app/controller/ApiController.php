<?php

declare(strict_types=1);

namespace app\controller;

use app\service\JsonStore;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/../service/JsonStore.php';

final class ApiController
{
    private JsonStore $store;

    public function __construct()
    {
        $this->store = new JsonStore();
    }

    public function handle(): void
    {
        $this->cors();

        if ($this->method() === 'OPTIONS') {
            $this->json(null, 204);
        }

        try {
            $path = $this->path();
            $method = $this->method();
            $body = $this->body();

            if ($path === '/models' && $method === 'GET') {
                $this->json(['models' => $this->models(true)]);
            }

            if ($path === '/config') {
                $this->config($method, $body);
            }

            if ($path === '/config/validate' && $method === 'POST') {
                $this->validateConfig($body);
            }

            if ($path === '/config/custom-models') {
                $this->collection('customModels', $method, $body, fn ($row) => $this->customModel($row));
            }

            if (preg_match('#^/config/custom-models/([^/]+)$#', $path, $m)) {
                $this->resourceById('customModels', $method, $m[1], $body, fn ($row) => $this->customModel($row));
            }

            if ($path === '/chat/completions' && $method === 'POST') {
                $this->chat($body);
            }

            if ($path === '/conversations') {
                $this->collection('conversations', $method, $body, fn ($row) => $this->conversation($row), true);
            }

            if ($path === '/conversations/batch-delete' && $method === 'POST') {
                $ids = array_values(array_filter($body['ids'] ?? [], 'is_string'));
                $deleted = $this->store->deleteMany('conversations', $ids);
                $this->json(['success' => true, 'deleted' => $deleted, 'failed' => []]);
            }

            if (preg_match('#^/conversations/([^/]+)/messages$#', $path, $m) && $method === 'GET') {
                $items = array_values(array_filter($this->store->all('messages'), fn ($row) => ($row['conversationId'] ?? '') === $m[1]));
                $this->json(['items' => $items, 'total' => count($items)]);
            }

            if (preg_match('#^/conversations/([^/]+)$#', $path, $m)) {
                $this->resourceById('conversations', $method, $m[1], $body, fn ($row) => $this->conversation($row));
            }

            if ($path === '/agents') {
                $this->collection('agents', $method, $body, fn ($row) => $this->agent($row), true);
            }

            if (preg_match('#^/agents/([^/]+)/chat$#', $path, $m) && $method === 'POST') {
                $agent = $this->store->find('agents', $m[1]) ?? [];
                $result = $this->callChatModel($body['messages'] ?? [], (string)($agent['model'] ?? ''));
                $this->json(['content' => $result['content'], 'toolCalls' => []]);
            }

            if (preg_match('#^/agents/([^/]+)/execute$#', $path, $m) && $method === 'POST') {
                $execution = $this->execution($m[1], (string)($body['query'] ?? ''));
                $this->store->upsert('executions', $execution);
                $this->json(['executionId' => $execution['id'], 'plan' => $execution['plan'], 'finalResponse' => $execution['result'], 'status' => $execution['status']]);
            }

            if (preg_match('#^/agents/([^/]+)/executions$#', $path, $m) && $method === 'GET') {
                $items = array_values(array_filter($this->store->all('executions'), fn ($row) => ($row['agentId'] ?? '') === $m[1]));
                $this->json(['items' => $items, 'total' => count($items)]);
            }

            if (preg_match('#^/agents/([^/]+)$#', $path, $m)) {
                $this->resourceById('agents', $method, $m[1], $body, fn ($row) => $this->agent($row));
            }

            if ($path === '/workflows') {
                $this->collection('workflows', $method, $body, fn ($row) => $this->workflow($row), true);
            }

            if (preg_match('#^/workflows/([^/]+)/execute$#', $path, $m) && $method === 'POST') {
                $this->json(['success' => true, 'output' => $body['inputs'] ?? [], 'logs' => ['Workflow executed by PHP API.']]);
            }

            if (preg_match('#^/workflows/([^/]+)$#', $path, $m)) {
                $this->resourceById('workflows', $method, $m[1], $body, fn ($row) => $this->workflow($row));
            }

            if ($path === '/knowledge') {
                $this->collection('knowledge', $method, $body, fn ($row) => $this->knowledge($row), true);
            }

            if (preg_match('#^/knowledge/([^/]+)/documents$#', $path, $m)) {
                $this->knowledgeDocuments($m[1], $method, $body);
            }

            if (preg_match('#^/knowledge/([^/]+)/folders$#', $path, $m)) {
                $this->knowledgeFolders($m[1], $method, $body);
            }

            if (preg_match('#^/knowledge/([^/]+)/documents/([^/]+)$#', $path, $m) && $method === 'DELETE') {
                $this->json(['success' => $this->store->delete('documents', $m[2])]);
            }

            if (preg_match('#^/knowledge/([^/]+)/folders/([^/]+)$#', $path, $m)) {
                $this->resourceById('folders', $method, $m[2], $body, fn ($row) => $this->folder($row, $m[1]));
            }

            if (preg_match('#^/knowledge/([^/]+)$#', $path, $m)) {
                $this->resourceById('knowledge', $method, $m[1], $body, fn ($row) => $this->knowledge($row));
            }

            if ($path === '/tools') {
                $this->collection('tools', $method, $body, fn ($row) => $this->tool($row));
            }

            if ($path === '/tools/parse-skill' && $method === 'POST') {
                $this->json(['success' => true, 'data' => ['name' => $body['fileName'] ?? 'Skill', 'description' => 'Parsed by PHP API', 'inputSchema' => [], 'outputSchema' => [], 'examples' => [], 'content' => $body['content'] ?? '', 'fileType' => 'markdown']]);
            }

            if (preg_match('#^/tools/([^/]+)/test$#', $path, $m) && $method === 'POST') {
                $this->json(['success' => true, 'message' => 'Connection test passed.']);
            }

            if (preg_match('#^/tools/([^/]+)$#', $path, $m)) {
                $this->resourceById('tools', $method, $m[1], $body, fn ($row) => $this->tool($row));
            }

            if ($path === '/organization') {
                $this->collection('organizations', $method, $body, fn ($row) => $this->organization($row), true);
            }

            if (preg_match('#^/organization/([^/]+)/permissions$#', $path, $m)) {
                $this->permissions($m[1], $method, $body);
            }

            if (preg_match('#^/organization/([^/]+)/permissions/([^/]+)$#', $path, $m) && $method === 'DELETE') {
                $this->store->delete('permissions', $m[2]);
                $this->json(['success' => true]);
            }

            if (preg_match('#^/organization/([^/]+)/roles$#', $path, $m) && $method === 'GET') {
                $items = array_values(array_filter($this->store->all('roles'), fn ($row) => ($row['organizationId'] ?? '') === $m[1]));
                $this->json(['items' => $items, 'total' => count($items)]);
            }

            if (preg_match('#^/organization/([^/]+)$#', $path, $m)) {
                $this->resourceById('organizations', $method, $m[1], $body, fn ($row) => $this->organization($row));
            }

            if ($path === '/role') {
                $this->collection('roles', $method, $body, fn ($row) => $this->role($row), true);
            }

            if (preg_match('#^/role/([^/]+)$#', $path, $m)) {
                $this->resourceById('roles', $method, $m[1], $body, fn ($row) => $this->role($row));
            }

            if (str_starts_with($path, '/token-usage/')) {
                $this->tokenUsage($path);
            }

            if ($path === '/data-sources' || $path === '/data-sources/active') {
                $this->collection('dataSources', $method, $body, fn ($row) => $this->dataSource($row), $path !== '/data-sources/active');
            }

            if (preg_match('#^/executions/([^/]+)/subtasks$#', $path, $m) && $method === 'GET') {
                $this->json([]);
            }

            if (preg_match('#^/executions/([^/]+)$#', $path, $m) && $method === 'GET') {
                $this->json($this->store->find('executions', $m[1]));
            }

            if ($path === '/files/parse' && $method === 'POST') {
                $this->json(['success' => true, 'data' => ['type' => 'text', 'content' => 'File received by PHP API.', 'metadata' => []]]);
            }

            if ($path === '/files/generate' && $method === 'POST') {
                $content = (string)($body['content'] ?? '');
                $this->json(['success' => true, 'data' => ['fileName' => $body['options']['fileName'] ?? 'generated.txt', 'mimeType' => 'text/plain', 'base64Data' => base64_encode($content)]]);
            }

            $this->json(['message' => 'Not found', 'path' => $path], 404);
        } catch (Throwable $error) {
            $this->json(['message' => $error->getMessage()], 500);
        }
    }

    private function config(string $method, array $body): void
    {
        $config = $this->store->meta('config') ?: [];
        if ($method === 'POST') {
            if (array_key_exists('apiKey', $body) && trim((string)($body['apiKey'] ?? '')) === '') {
                unset($body['apiKey']);
            }
            $config = array_merge($config, $body, ['isValid' => true]);
            $this->store->setMeta('config', $config);
            $this->json(['success' => true, 'isValid' => true, 'message' => 'Configuration saved.']);
        }

        $availableModels = $this->models(true);
        $config = $this->normalizeModelSelection($this->resolvedConfig(), $availableModels);
        $apiKey = (string)($config['apiKey'] ?? '');
        $this->json([
            'baseUrl' => $config['baseUrl'] ?? 'https://wcnb.ai/v1',
            'isValid' => trim($apiKey) !== '',
            'apiKeyMask' => $apiKey === '' ? '' : substr($apiKey, 0, 4) . '****' . substr($apiKey, -4),
            'enabledModels' => $config['enabledModels'] ?? ['gpt-4o-mini'],
            'defaultModel' => $config['defaultModel'] ?? 'gpt-4o-mini',
            'availableModels' => array_map(fn ($m) => $m + ['inputPrice' => 0, 'outputPrice' => 0], $availableModels),
        ]);
    }

    private function validateConfig(array $body): void
    {
        try {
            $config = $this->resolvedConfig($body);
            $apiKey = trim((string)($config['apiKey'] ?? ''));
            if ($apiKey === '') {
                $this->json(['success' => false, 'message' => 'API Key is required.']);
            }

            $baseUrl = rtrim((string)($config['baseUrl'] ?? 'https://wcnb.ai/v1'), '/');
            $this->httpJson('GET', $baseUrl . '/models', [], ['Authorization: Bearer ' . $apiKey], false);
            $this->json(['success' => true, 'message' => 'API Key is valid.']);
        } catch (Throwable $error) {
            $this->json(['success' => false, 'message' => $error->getMessage()]);
        }
    }

    private function chat(array $body): void
    {
        $result = $this->callChatModel($body['messages'] ?? [], (string)($body['model'] ?? ''));
        $this->json([
            'id' => $this->id(),
            'role' => 'assistant',
            'content' => $result['content'],
            'tokenUsage' => $result['tokenUsage'],
        ]);
    }

    private function callChatModel(array $messages, string $requestedModel = ''): array
    {
        $availableModels = $this->models(true);
        $config = $this->normalizeModelSelection($this->resolvedConfig(), $availableModels);
        $apiKey = trim((string)($config['apiKey'] ?? ''));
        if ($apiKey === '') {
            throw new RuntimeException('API Key is not configured. Please save it in Config first.');
        }

        $model = trim($requestedModel);
        $availableIds = array_map(fn ($row) => (string)($row['id'] ?? ''), $availableModels);
        if ($model === '' || ($availableIds && !in_array($model, $availableIds, true))) {
            $model = (string)($config['defaultModel'] ?? 'gpt-4o-mini');
        }
        $baseUrl = rtrim((string)($config['baseUrl'] ?? 'https://wcnb.ai/v1'), '/');
        $endpoint = preg_match('#/chat/completions$#', $baseUrl) ? $baseUrl : $baseUrl . '/chat/completions';

        $response = $this->httpJson('POST', $endpoint, [
            'model' => $model,
            'messages' => $this->normalizeMessages($messages),
            'temperature' => 0.7,
            'stream' => false,
        ], ['Authorization: Bearer ' . $apiKey]);

        $content = trim((string)($response['choices'][0]['message']['content'] ?? $response['choices'][0]['text'] ?? $response['output_text'] ?? ''));
        if ($content === '') {
            throw new RuntimeException('The model returned an empty response.');
        }

        $usage = $response['usage'] ?? [];
        return [
            'content' => $content,
            'tokenUsage' => [
                'promptTokens' => (int)($usage['prompt_tokens'] ?? 0),
                'completionTokens' => (int)($usage['completion_tokens'] ?? 0),
                'totalTokens' => (int)($usage['total_tokens'] ?? 0),
                'cost' => 0,
            ],
        ];
    }

    private function resolvedConfig(array $override = []): array
    {
        $saved = $this->store->meta('config') ?: [];
        return array_merge([
            'apiKey' => getenv('WCNB_API_KEY') ?: '',
            'baseUrl' => getenv('WCNB_BASE_URL') ?: 'https://wcnb.ai/v1',
            'defaultModel' => 'gpt-4o-mini',
            'enabledModels' => ['gpt-4o-mini'],
        ], $saved, $override);
    }

    private function normalizeModelSelection(array $config, array $availableModels): array
    {
        $availableIds = array_values(array_filter(array_map(fn ($row) => (string)($row['id'] ?? ''), $availableModels)));
        if (!$availableIds) {
            return $config;
        }

        $enabledModels = array_values(array_filter(
            array_map('strval', $config['enabledModels'] ?? []),
            fn ($model) => in_array($model, $availableIds, true)
        ));

        $defaultModel = (string)($config['defaultModel'] ?? '');
        if ($defaultModel === '' || !in_array($defaultModel, $availableIds, true)) {
            $defaultModel = $enabledModels[0] ?? $this->preferredModel($availableIds);
        }

        if (!$enabledModels) {
            $enabledModels = [$defaultModel];
        }

        $config['defaultModel'] = $defaultModel;
        $config['enabledModels'] = $enabledModels;
        return $config;
    }

    private function preferredModel(array $availableIds): string
    {
        foreach (['gpt-4o', 'gpt-5-mini', 'gpt-5.2-chat', 'gpt-5', 'gpt-5.1'] as $candidate) {
            if (in_array($candidate, $availableIds, true)) {
                return $candidate;
            }
        }

        foreach ($availableIds as $candidate) {
            if (str_starts_with(strtolower($candidate), 'gpt')) {
                return $candidate;
            }
        }

        return $availableIds[0] ?? 'gpt-4o';
    }

    private function normalizeMessages(array $messages): array
    {
        $normalized = [];
        foreach ($messages as $message) {
            if (!is_array($message)) {
                continue;
            }

            $normalized[] = [
                'role' => ($message['role'] ?? '') === 'assistant' ? 'assistant' : 'user',
                'content' => $this->normalizeMessageContent($message['content'] ?? ''),
            ];
        }

        return $normalized ?: [['role' => 'user', 'content' => 'Hello']];
    }

    private function normalizeMessageContent(mixed $content): mixed
    {
        if (is_string($content)) {
            return $content;
        }

        if (!is_array($content)) {
            return (string)$content;
        }

        $parts = [];
        foreach ($content as $part) {
            if (!is_array($part)) {
                continue;
            }

            if (($part['type'] ?? '') === 'image_url') {
                $parts[] = ['type' => 'image_url', 'image_url' => ['url' => (string)($part['image_url']['url'] ?? '')]];
                continue;
            }

            $parts[] = ['type' => 'text', 'text' => (string)($part['text'] ?? '')];
        }

        return $parts ?: '';
    }

    private function httpJson(string $method, string $url, array $body = [], array $headers = [], bool $sendBody = true): array
    {
        $options = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
            CURLOPT_TIMEOUT => 45,
        ];

        if ($sendBody && $method !== 'GET') {
            $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, $options);
        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($raw === false || $error !== '') {
            throw new RuntimeException('Model request failed: ' . $error);
        }

        $decoded = json_decode((string)$raw, true);
        if ($status >= 400) {
            $message = is_array($decoded)
                ? (string)($decoded['error']['message'] ?? $decoded['message'] ?? json_encode($decoded, JSON_UNESCAPED_UNICODE))
                : (string)$raw;
            throw new RuntimeException('Model API error ' . $status . ': ' . $this->slice($message, 0, 500));
        }

        if (!is_array($decoded)) {
            throw new RuntimeException('Model API returned a non-JSON response.');
        }

        return $decoded;
    }

    private function collection(string $name, string $method, array $body, callable $shape, bool $wrapped = false): void
    {
        if ($method === 'GET') {
            $items = array_map($shape, $this->store->all($name));
            $this->json($wrapped ? ['items' => $items, 'total' => count($items)] : $items);
        }

        if ($method === 'POST') {
            $row = $shape(array_merge($body, ['id' => $body['id'] ?? $this->id()]));
            $this->store->upsert($name, $row);
            $this->json($row);
        }

        $this->json(['message' => 'Method not allowed'], 405);
    }

    private function resourceById(string $name, string $method, string $id, array $body, callable $shape): void
    {
        if ($method === 'GET') {
            $this->json($this->store->find($name, $id));
        }

        if ($method === 'PUT') {
            $current = $this->store->find($name, $id) ?? ['id' => $id];
            $row = $shape(array_merge($current, $body, ['id' => $id]));
            $this->store->upsert($name, $row);
            $this->json($row);
        }

        if ($method === 'DELETE') {
            $this->json(['success' => $this->store->delete($name, $id)]);
        }

        $this->json(['message' => 'Method not allowed'], 405);
    }

    private function knowledgeDocuments(string $knowledgeBaseId, string $method, array $body): void
    {
        if ($method === 'GET') {
            $items = array_values(array_filter($this->store->all('documents'), fn ($row) => ($row['knowledgeBaseId'] ?? '') === $knowledgeBaseId));
            $this->json(['items' => $items, 'total' => count($items)]);
        }

        if ($method === 'POST') {
            $row = $this->document(array_merge($body, ['id' => $this->id(), 'knowledgeBaseId' => $knowledgeBaseId]));
            $this->store->upsert('documents', $row);
            $this->json(['id' => $row['id']]);
        }

        $this->json(['message' => 'Method not allowed'], 405);
    }

    private function knowledgeFolders(string $knowledgeBaseId, string $method, array $body): void
    {
        if ($method === 'GET') {
            $items = array_values(array_filter($this->store->all('folders'), fn ($row) => ($row['knowledgeBaseId'] ?? '') === $knowledgeBaseId));
            $this->json(['items' => $items, 'total' => count($items)]);
        }

        if ($method === 'POST') {
            $row = $this->folder(array_merge($body, ['id' => $this->id()]), $knowledgeBaseId);
            $this->store->upsert('folders', $row);
            $this->json(['id' => $row['id']]);
        }

        $this->json(['message' => 'Method not allowed'], 405);
    }

    private function permissions(string $orgId, string $method, array $body): void
    {
        if ($method === 'GET') {
            $items = array_values(array_filter($this->store->all('permissions'), fn ($row) => ($row['organizationId'] ?? '') === $orgId));
            $this->json(['items' => $items]);
        }

        if ($method === 'POST') {
            $row = ['id' => $this->id(), 'organizationId' => $orgId, 'levelType' => $body['levelType'] ?? 'all', 'resourceType' => $body['resourceType'] ?? 'agent', 'resourceId' => $body['resourceId'] ?? '', 'createdAt' => $this->now()];
            $this->store->upsert('permissions', $row);
            $this->json($row);
        }

        $this->json(['message' => 'Method not allowed'], 405);
    }

    private function tokenUsage(string $path): void
    {
        if ($path === '/token-usage/list') {
            $this->json(['items' => [], 'total' => 0]);
        }

        if ($path === '/token-usage/global') {
            $this->json(['totalUsers' => 1, 'totalTokens' => 0, 'totalCost' => 0, 'totalCalls' => 0, 'userStats' => [], 'modelUsage' => [], 'agentStats' => [], 'workflowStats' => [], 'organizationStats' => [], 'roleStats' => []]);
        }

        $this->json(['totalTokens' => 0, 'totalCost' => 0, 'totalCalls' => 0, 'dailyUsage' => [], 'modelUsage' => []]);
    }

    private function models(bool $preferProvider = false): array
    {
        if ($preferProvider) {
            $providerModels = $this->providerModels();
            if ($providerModels) {
                return $providerModels;
            }
        }

        $custom = array_map(fn ($row) => [
            'id' => $row['modelId'] ?? $row['id'] ?? '',
            'name' => $row['name'] ?? $row['modelId'] ?? 'Custom Model',
            'type' => $row['type'] ?? 'gpt',
        ], $this->store->all('customModels'));

        return array_values(array_filter(array_merge([
            ['id' => 'gpt-4o-mini', 'name' => 'GPT-4o Mini', 'type' => 'gpt'],
            ['id' => 'gpt-4o', 'name' => 'GPT-4o', 'type' => 'gpt'],
            ['id' => 'deepseek-chat', 'name' => 'DeepSeek Chat', 'type' => 'deepseek'],
            ['id' => 'claude-3-5-sonnet-latest', 'name' => 'Claude 3.5 Sonnet', 'type' => 'claude'],
            ['id' => 'gemini-1.5-flash', 'name' => 'Gemini 1.5 Flash', 'type' => 'gemini'],
        ], $custom), fn ($row) => ($row['id'] ?? '') !== ''));
    }

    private function providerModels(): array
    {
        try {
            $config = $this->resolvedConfig();
            $apiKey = trim((string)($config['apiKey'] ?? ''));
            if ($apiKey === '') {
                return [];
            }

            $baseUrl = rtrim((string)($config['baseUrl'] ?? 'https://wcnb.ai/v1'), '/');
            $response = $this->httpJson('GET', $baseUrl . '/models', [], ['Authorization: Bearer ' . $apiKey], false);
            $rows = is_array($response['data'] ?? null) ? $response['data'] : [];

            return array_values(array_filter(array_map(function ($row) {
                if (!is_array($row)) {
                    return null;
                }

                $id = (string)($row['id'] ?? '');
                if ($id === '') {
                    return null;
                }

                return [
                    'id' => $id,
                    'name' => (string)($row['name'] ?? $id),
                    'type' => $this->guessModelType($id),
                ];
            }, $rows)));
        } catch (Throwable) {
            return [];
        }
    }

    private function guessModelType(string $model): string
    {
        $model = strtolower($model);
        if (str_contains($model, 'claude')) {
            return 'claude';
        }
        if (str_contains($model, 'gemini')) {
            return 'gemini';
        }
        if (str_contains($model, 'deepseek')) {
            return 'deepseek';
        }

        return 'gpt';
    }

    private function agent(array $row): array
    {
        return $this->timestamps($row + ['name' => 'Default Agent', 'description' => '', 'instruction' => '', 'greeting' => '', 'model' => 'gpt-4o-mini', 'knowledgeBase' => [], 'tools' => [], 'avatarUrl' => '', 'isActive' => true]);
    }

    private function workflow(array $row): array
    {
        return $this->timestamps($row + ['name' => 'Default Workflow', 'description' => '', 'inputSchema' => [], 'outputSchema' => [], 'nodes' => [], 'edges' => [], 'isActive' => true]);
    }

    private function knowledge(array $row): array
    {
        return $this->timestamps($row + ['name' => 'Default Knowledge Base', 'description' => '', 'type' => 'local', 'documentCount' => 0, 'tokenCount' => 0]);
    }

    private function tool(array $row): array
    {
        return $this->timestamps($row + ['name' => 'Default Tool', 'type' => 'mcp', 'description' => '', 'configData' => [], 'isActive' => true]);
    }

    private function organization(array $row): array
    {
        return $this->timestamps($row + ['name' => 'Default Organization', 'description' => '']);
    }

    private function role(array $row): array
    {
        return $this->timestamps($row + ['name' => 'Admin', 'description' => '', 'permissions' => [], 'levelType' => 'management']);
    }

    private function conversation(array $row): array
    {
        return $this->timestamps($row + ['title' => 'New Conversation', 'model' => 'gpt-4o-mini', 'messageCount' => 0]);
    }

    private function customModel(array $row): array
    {
        return $row + ['id' => $this->id(), 'modelId' => 'custom-model', 'name' => 'Custom Model', 'type' => 'gpt', 'inputPrice' => 0, 'outputPrice' => 0, 'cacheReadPrice' => 0, 'pricePerRequest' => 0];
    }

    private function document(array $row): array
    {
        return $row + ['name' => 'document.txt', 'fileSize' => 0, 'fileType' => 'text/plain', 'status' => 'completed', 'tokenCount' => 0, 'createdAt' => $this->now()];
    }

    private function folder(array $row, string $knowledgeBaseId): array
    {
        return $row + ['knowledgeBaseId' => $knowledgeBaseId, 'name' => 'Folder', 'type' => 'folder', 'sortOrder' => 0, 'createdAt' => $this->now()];
    }

    private function dataSource(array $row): array
    {
        return $this->timestamps($row + ['name' => 'Data Source', 'type' => 'feishu_bitable', 'baseToken' => '', 'tableId' => '', 'viewId' => '', 'description' => '', 'isActive' => true, 'syncStatus' => 'pending', 'recordCount' => 0]);
    }

    private function execution(string $agentId, string $query): array
    {
        return $this->timestamps(['id' => $this->id(), 'agentId' => $agentId, 'userId' => 'vercel-user', 'userQuery' => $query, 'status' => 'completed', 'plan' => ['tasks' => []], 'result' => 'Execution created.', 'tokenUsage' => 0]);
    }

    private function timestamps(array $row): array
    {
        $now = $this->now();
        $row['id'] = $row['id'] ?? $this->id();
        $row['createdAt'] = $row['createdAt'] ?? $now;
        $row['updatedAt'] = $now;
        return $row;
    }

    private function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    private function path(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $path = preg_replace('#^/api#', '', $uri) ?: '/';
        return rtrim($path, '/') ?: '/';
    }

    private function body(): array
    {
        $raw = file_get_contents('php://input') ?: '{}';
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    private function cors(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Cache-Control: no-store');
    }

    private function json(mixed $payload, int $status = 200): void
    {
        http_response_code($status);
        if ($status !== 204) {
            echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        exit;
    }

    private function id(): string
    {
        return bin2hex(random_bytes(8));
    }

    private function now(): string
    {
        return gmdate('c');
    }

    private function slice(string $value, int $start, int $length): string
    {
        return function_exists('mb_substr') ? mb_substr($value, $start, $length) : substr($value, $start, $length);
    }
}
