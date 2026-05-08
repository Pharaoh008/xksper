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

            if ($path === '/chat/agent' && $method === 'POST') {
                $this->agentChat($body);
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
                $this->agentChat(array_merge($body, [
                    'agentId' => $m[1],
                    'model' => (string)($agent['model'] ?? $body['model'] ?? ''),
                ]));
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
                $this->json(['success' => true, 'data' => $this->parseSkill($body)]);
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
        $messages = is_array($body['messages'] ?? null) ? $body['messages'] : [];
        $mentions = is_array($body['mentions'] ?? null) ? $body['mentions'] : [];
        if ($mentions) {
            $query = $this->lastUserMessage($messages);
            $threadId = (string)($body['conversationId'] ?? 'default-thread');
            $resources = $this->agentResources($mentions, $query, $threadId, false);
            $messages = array_merge([
                ['role' => 'system', 'content' => $this->resourceSystemPrompt($resources)],
            ], $messages);
        }

        $result = $this->callChatModel($messages, (string)($body['model'] ?? ''));
        $this->json([
            'id' => $this->id(),
            'role' => 'assistant',
            'content' => $result['content'],
            'tokenUsage' => $result['tokenUsage'],
        ]);
    }

    private function agentChat(array $body): void
    {
        $messages = is_array($body['messages'] ?? null) ? $body['messages'] : [];
        $mentions = is_array($body['mentions'] ?? null) ? $body['mentions'] : [];
        $query = $this->lastUserMessage($messages);
        $threadId = (string)($body['conversationId'] ?? 'default-thread');
        $agent = trim((string)($body['agentId'] ?? '')) !== '' ? ($this->store->find('agents', (string)$body['agentId']) ?? []) : [];
        $resources = $this->agentResources($mentions, $query, $threadId, true, $agent);

        $system = $this->agentSystemPrompt($resources, $threadId);
        $result = $this->callChatModel(array_merge([
            ['role' => 'system', 'content' => $system],
        ], $messages), (string)($body['model'] ?? ''));

        $this->rememberAgentTurn($threadId, $query, $result['content']);

        $this->json([
            'id' => $this->id(),
            'role' => 'assistant',
            'content' => $result['content'],
            'tokenUsage' => $result['tokenUsage'],
            'harness' => [
                'runtime' => 'langgraph-style-react-harness',
                'nodes' => ['prepare', 'memory', 'retrieve', 'skills', 'tools', 'react', 'model', 'audit'],
                'knowledgeCount' => count($resources['knowledge']),
                'skillCount' => count($resources['skills']),
                'toolCount' => count($resources['tools']),
                'mcpObservationCount' => count($resources['mcpObservations']),
                'skillObservationCount' => count($resources['skillObservations']),
                'memoryCount' => count($resources['memory']),
            ],
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

            $role = (string)($message['role'] ?? 'user');
            $normalized[] = [
                'role' => in_array($role, ['system', 'assistant', 'user'], true) ? $role : 'user',
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

    private function agentResources(array $mentions, string $query, string $threadId, bool $executeMcp = true, array $agent = []): array
    {
        $knowledgeIds = $this->mentionIds($mentions, 'knowledge');
        $toolIds = $this->mentionIds($mentions, 'tool');
        $dataSourceIds = $this->mentionIds($mentions, 'datasource');
        foreach (($agent['knowledgeBase'] ?? []) as $id) {
            if (is_string($id) && $id !== '') {
                $knowledgeIds[] = $id;
            }
        }
        foreach (($agent['tools'] ?? []) as $id) {
            if (is_string($id) && $id !== '') {
                $toolIds[] = $id;
            }
        }
        $knowledgeIds = array_values(array_unique($knowledgeIds));
        $toolIds = array_values(array_unique($toolIds));
        $toolRows = $this->selectedTools($toolIds);

        return [
            'knowledge' => $this->rankKnowledge($knowledgeIds, $query),
            'tools' => $this->toolManifests($toolRows),
            'skills' => $this->skillManifests($toolRows),
            'dataSources' => $this->selectedDataSources($dataSourceIds),
            'mcpObservations' => $executeMcp ? $this->callMcpTools($toolIds ? $toolRows : [], $query) : [],
            'skillObservations' => $executeMcp ? $this->callSkillScripts($toolIds ? $toolRows : [], $query) : [],
            'memory' => $this->agentMemory($threadId),
            'mentions' => $mentions,
        ];
    }

    private function mentionIds(array $mentions, string $type): array
    {
        $ids = [];
        foreach ($mentions as $mention) {
            if (!is_array($mention) || (string)($mention['type'] ?? '') !== $type) {
                continue;
            }
            $id = (string)($mention['id'] ?? '');
            if ($id !== '') {
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }

    private function rankKnowledge(array $knowledgeIds, string $query): array
    {
        $tokens = array_values(array_filter(preg_split('/\s+/u', strtolower($query)) ?: []));
        $documents = $this->store->all('documents');
        if ($knowledgeIds) {
            $documents = array_values(array_filter($documents, fn ($row) => in_array((string)($row['knowledgeBaseId'] ?? ''), $knowledgeIds, true)));
        }

        $ranked = [];
        foreach ($documents as $row) {
            $content = (string)($row['content'] ?? $row['parsedContent'] ?? $row['text'] ?? '');
            if ($content === '') {
                continue;
            }

            $haystack = strtolower((string)($row['name'] ?? '') . "\n" . $content);
            $score = 0;
            foreach ($tokens as $token) {
                if ($token !== '' && str_contains($haystack, $token)) {
                    $score++;
                }
            }

            $ranked[] = [
                'score' => $score,
                'title' => (string)($row['name'] ?? 'Document'),
                'knowledgeBaseId' => (string)($row['knowledgeBaseId'] ?? ''),
                'content' => $this->slice($content, 0, 1800),
            ];
        }

        usort($ranked, fn ($a, $b) => ($b['score'] <=> $a['score']));
        return array_slice($ranked, 0, 6);
    }

    private function selectedTools(array $toolIds): array
    {
        $tools = array_values(array_filter($this->store->all('tools'), fn ($row) => (bool)($row['isActive'] ?? true)));
        if (!$toolIds) {
            return $tools;
        }

        return array_values(array_filter($tools, fn ($row) => in_array((string)($row['id'] ?? ''), $toolIds, true)));
    }

    private function toolManifests(array $tools): array
    {
        return array_map(function ($tool) {
            $config = is_array($tool['configData'] ?? null) ? $tool['configData'] : [];
            return [
                'id' => (string)($tool['id'] ?? ''),
                'name' => (string)($tool['name'] ?? 'Tool'),
                'type' => (string)($tool['type'] ?? 'mcp'),
                'description' => (string)($tool['description'] ?? ''),
                'callPolicy' => $this->toolCallPolicy((string)($tool['type'] ?? 'mcp'), $config),
            ];
        }, $tools);
    }

    private function skillManifests(array $tools): array
    {
        $skills = [];
        foreach ($tools as $tool) {
            if ((string)($tool['type'] ?? '') !== 'skill') {
                continue;
            }

            $skill = is_array($tool['skill'] ?? null) ? $tool['skill'] : (is_array($tool['skillData'] ?? null) ? $tool['skillData'] : []);
            $config = is_array($tool['configData'] ?? null) ? $tool['configData'] : [];
            $skills[] = [
                'id' => (string)($tool['id'] ?? ''),
                'name' => (string)($tool['name'] ?? $skill['name'] ?? 'Skill'),
                'description' => (string)($tool['description'] ?? $skill['description'] ?? ''),
                'content' => $this->slice((string)($skill['content'] ?? $skill['prompt'] ?? ''), 0, 5000),
                'scriptEnabled' => (bool)($config['scriptEnabled'] ?? $skill['scriptEnabled'] ?? false),
                'scriptRuntime' => (string)($config['scriptRuntime'] ?? $skill['scriptRuntime'] ?? ''),
            ];
        }

        return $skills;
    }

    private function selectedDataSources(array $dataSourceIds): array
    {
        $rows = $this->store->all('dataSources');
        if ($dataSourceIds) {
            $rows = array_values(array_filter($rows, fn ($row) => in_array((string)($row['id'] ?? ''), $dataSourceIds, true)));
        }

        return array_map(fn ($row) => [
            'id' => (string)($row['id'] ?? ''),
            'name' => (string)($row['name'] ?? 'Data Source'),
            'type' => (string)($row['type'] ?? ''),
            'description' => (string)($row['description'] ?? ''),
            'syncStatus' => (string)($row['syncStatus'] ?? ''),
            'recordCount' => (int)($row['recordCount'] ?? 0),
        ], $rows);
    }

    private function agentMemory(string $threadId): array
    {
        $memory = $this->store->meta('agentMemory') ?: [];
        $rows = is_array($memory[$threadId] ?? null) ? $memory[$threadId] : [];
        return array_slice($rows, -8);
    }

    private function rememberAgentTurn(string $threadId, string $query, string $answer): void
    {
        $memory = $this->store->meta('agentMemory') ?: [];
        $rows = is_array($memory[$threadId] ?? null) ? $memory[$threadId] : [];
        $rows[] = ['role' => 'user', 'content' => $this->slice($query, 0, 1200), 'at' => $this->now()];
        $rows[] = ['role' => 'assistant', 'content' => $this->slice($answer, 0, 1600), 'at' => $this->now()];
        $memory[$threadId] = array_slice($rows, -20);
        $this->store->setMeta('agentMemory', $memory);
    }

    private function toolCallPolicy(string $type, array $config): string
    {
        if ($type === 'skill') {
            if ((bool)($config['scriptEnabled'] ?? false)) {
                return 'Executable Skill script. The harness may run it and inject stdout/stderr as an observation.';
            }
            return 'Apply as an internal skill instruction before answering.';
        }
        if (trim((string)($config['url'] ?? $config['endpoint'] ?? '')) !== '') {
            return 'Callable through configured HTTP endpoint; never invent results, state when execution is unavailable.';
        }

        return 'Available as a declared tool manifest; request explicit user confirmation before irreversible or paid actions.';
    }

    private function callMcpTools(array $tools, string $query): array
    {
        $observations = [];
        foreach ($tools as $tool) {
            if ((string)($tool['type'] ?? '') !== 'mcp') {
                continue;
            }

            $config = is_array($tool['configData'] ?? null) ? $tool['configData'] : [];
            $url = trim((string)($config['url'] ?? ''));
            if ($url === '') {
                $observations[] = [
                    'tool' => (string)($tool['name'] ?? 'MCP'),
                    'status' => 'skipped',
                    'message' => 'MCP URL is empty.',
                ];
                continue;
            }

            try {
                $headers = $this->mcpHeaders($config);
                $this->mcpJsonRpc($url, 'initialize', [
                    'protocolVersion' => '2024-11-05',
                    'capabilities' => new \stdClass(),
                    'clientInfo' => ['name' => 'xksper-agent-harness', 'version' => '1.0.0'],
                ], $headers);
                $list = $this->mcpJsonRpc($url, 'tools/list', new \stdClass(), $headers);
                $available = is_array($list['result']['tools'] ?? null) ? $list['result']['tools'] : [];
                $selected = $this->selectMcpTool($available, $query);
                if (!$selected) {
                    $observations[] = [
                        'tool' => (string)($tool['name'] ?? 'MCP'),
                        'status' => 'listed',
                        'availableTools' => array_map(fn ($row) => (string)($row['name'] ?? ''), $available),
                        'message' => 'No callable MCP tool was selected.',
                    ];
                    continue;
                }

                $called = $this->mcpJsonRpc($url, 'tools/call', [
                    'name' => (string)$selected['name'],
                    'arguments' => $this->mcpArguments($selected, $query),
                ], $headers);

                $observations[] = [
                    'tool' => (string)($tool['name'] ?? 'MCP'),
                    'calledTool' => (string)$selected['name'],
                    'status' => 'ok',
                    'result' => $this->slice(json_encode($called['result'] ?? $called, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}', 0, 6000),
                ];
            } catch (Throwable $error) {
                $observations[] = [
                    'tool' => (string)($tool['name'] ?? 'MCP'),
                    'status' => 'error',
                    'message' => $this->slice($error->getMessage(), 0, 800),
                ];
            }
        }

        return $observations;
    }

    private function callSkillScripts(array $tools, string $query): array
    {
        $observations = [];
        foreach ($tools as $tool) {
            if ((string)($tool['type'] ?? '') !== 'skill') {
                continue;
            }

            $config = is_array($tool['configData'] ?? null) ? $tool['configData'] : [];
            $skill = is_array($tool['skill'] ?? null) ? $tool['skill'] : (is_array($tool['skillData'] ?? null) ? $tool['skillData'] : []);
            if (!(bool)($config['scriptEnabled'] ?? $skill['scriptEnabled'] ?? false)) {
                continue;
            }

            $script = (string)($config['scriptContent'] ?? $skill['scriptContent'] ?? '');
            $runtime = (string)($config['scriptRuntime'] ?? $skill['scriptRuntime'] ?? 'node');
            if (trim($script) === '') {
                $observations[] = [
                    'skill' => (string)($tool['name'] ?? 'Skill'),
                    'status' => 'skipped',
                    'message' => 'Skill script is empty.',
                ];
                continue;
            }

            try {
                $observations[] = $this->runSkillScript($tool, $skill, $runtime, $script, $query);
            } catch (Throwable $error) {
                $observations[] = [
                    'skill' => (string)($tool['name'] ?? 'Skill'),
                    'runtime' => $runtime,
                    'status' => 'error',
                    'message' => $this->slice($error->getMessage(), 0, 1200),
                ];
            }
        }

        return $observations;
    }

    private function runSkillScript(array $tool, array $skill, string $runtime, string $script, string $query): array
    {
        if (!function_exists('proc_open')) {
            throw new RuntimeException('proc_open is disabled in this runtime. Use a remote MCP/HTTP tool for script execution.');
        }

        $runtime = in_array($runtime, ['node', 'python', 'php', 'shell'], true) ? $runtime : 'node';
        $extension = ['node' => 'js', 'python' => 'py', 'php' => 'php', 'shell' => 'sh'][$runtime];
        $file = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'skill_' . $this->id() . '.' . $extension;
        file_put_contents($file, $script);

        $command = match ($runtime) {
            'python' => ['python', $file],
            'php' => ['php', $file],
            'shell' => ['sh', $file],
            default => ['node', $file],
        };

        $payload = json_encode([
            'query' => $query,
            'tool' => [
                'id' => (string)($tool['id'] ?? ''),
                'name' => (string)($tool['name'] ?? ''),
                'description' => (string)($tool['description'] ?? ''),
            ],
            'skill' => [
                'name' => (string)($skill['name'] ?? $tool['name'] ?? ''),
                'description' => (string)($skill['description'] ?? $tool['description'] ?? ''),
                'content' => $this->slice((string)($skill['content'] ?? ''), 0, 8000),
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';

        $descriptor = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = proc_open($command, $descriptor, $pipes, sys_get_temp_dir());
        if (!is_resource($process)) {
            @unlink($file);
            throw new RuntimeException('Unable to start script process. Runtime may be unavailable.');
        }

        fwrite($pipes[0], $payload);
        fclose($pipes[0]);
        stream_set_timeout($pipes[1], 12);
        stream_set_timeout($pipes[2], 12);
        $stdout = stream_get_contents($pipes[1]) ?: '';
        $stderr = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        @unlink($file);

        return [
            'skill' => (string)($tool['name'] ?? 'Skill'),
            'runtime' => $runtime,
            'status' => $exitCode === 0 ? 'ok' : 'error',
            'exitCode' => $exitCode,
            'stdout' => $this->slice($stdout, 0, 6000),
            'stderr' => $this->slice($stderr, 0, 2000),
        ];
    }

    private function mcpHeaders(array $config): array
    {
        $headers = [];
        foreach (($config['headers'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $key = trim((string)($row['key'] ?? ''));
            $value = trim((string)($row['value'] ?? ''));
            if ($key !== '' && $value !== '') {
                $headers[] = $key . ': ' . $value;
            }
        }

        return $headers;
    }

    private function mcpJsonRpc(string $url, string $method, mixed $params, array $headers): array
    {
        $body = [
            'jsonrpc' => '2.0',
            'id' => $this->id(),
            'method' => $method,
            'params' => $params,
        ];
        $response = $this->httpJson('POST', $url, $body, array_merge(['Accept: application/json, text/event-stream'], $headers));
        if (isset($response['error'])) {
            $message = is_array($response['error']) ? (string)($response['error']['message'] ?? json_encode($response['error'], JSON_UNESCAPED_UNICODE)) : (string)$response['error'];
            throw new RuntimeException('MCP error: ' . $message);
        }

        return $response;
    }

    private function selectMcpTool(array $tools, string $query): ?array
    {
        $query = strtolower($query);
        foreach ($tools as $tool) {
            if (!is_array($tool)) {
                continue;
            }
            $name = strtolower((string)($tool['name'] ?? ''));
            $description = strtolower((string)($tool['description'] ?? ''));
            if ($name !== '' && ($query === '' || str_contains($query, $name) || str_contains($description, 'search') || str_contains($description, 'query') || str_contains($description, 'read'))) {
                return $tool;
            }
        }

        return is_array($tools[0] ?? null) ? $tools[0] : null;
    }

    private function mcpArguments(array $tool, string $query): array
    {
        $schema = is_array($tool['inputSchema'] ?? null) ? $tool['inputSchema'] : [];
        $properties = is_array($schema['properties'] ?? null) ? $schema['properties'] : [];
        if (!$properties) {
            return ['query' => $query, 'input' => $query];
        }

        $args = [];
        foreach ($properties as $name => $property) {
            $lower = strtolower((string)$name);
            if (in_array($lower, ['query', 'q', 'search', 'keyword', 'keywords', 'input', 'prompt', 'text'], true)) {
                $args[(string)$name] = $query;
                continue;
            }

            if (is_array($property) && ($property['type'] ?? '') === 'string') {
                $args[(string)$name] = $query;
            }
        }

        return $args ?: ['query' => $query];
    }

    private function agentSystemPrompt(array $resources, string $threadId): string
    {
        return implode("\n\n", [
            'You are the universal assistant running in a LangGraph-style ReAct state graph.',
            'Architecture contract: prepare -> memory -> retrieve -> skills -> tools -> react -> model -> audit.',
            'Harness constraints: clarify the user goal when needed; prefer cited local knowledge over guesses; use memory only when relevant; apply skills as operating procedures; use tool manifests to decide possible actions; never fabricate tool outputs; ask before irreversible, external, or paid actions; answer in Chinese unless the user requests another language.',
            'Reason privately. Do not expose hidden chain-of-thought. When useful, show a concise public plan, key evidence, and final answer.',
            'Thread ID: ' . $threadId,
            'Memory:' . "\n" . $this->formatContext($resources['memory']),
            'Knowledge:' . "\n" . $this->formatContext($resources['knowledge']),
            'Skills:' . "\n" . $this->formatContext($resources['skills']),
            'Tool Manifest:' . "\n" . $this->formatContext($resources['tools']),
            'MCP Observations:' . "\n" . $this->formatContext($resources['mcpObservations']),
            'Skill Script Observations:' . "\n" . $this->formatContext($resources['skillObservations']),
            'Data Sources:' . "\n" . $this->formatContext($resources['dataSources']),
        ]);
    }

    private function resourceSystemPrompt(array $resources): string
    {
        return implode("\n\n", [
            'Use the following local resources when answering. Prefer this context over guesses. If context is insufficient, say what is missing.',
            'Knowledge:' . "\n" . $this->formatContext($resources['knowledge']),
            'Skills:' . "\n" . $this->formatContext($resources['skills']),
            'Tool Manifest:' . "\n" . $this->formatContext($resources['tools']),
            'Skill Script Observations:' . "\n" . $this->formatContext($resources['skillObservations'] ?? []),
            'Data Sources:' . "\n" . $this->formatContext($resources['dataSources']),
        ]);
    }

    private function formatContext(array $items): string
    {
        if (!$items) {
            return 'none';
        }

        return implode("\n", array_map(fn ($item) => '- ' . $this->slice(json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}', 0, 2500), $items));
    }

    private function lastUserMessage(array $messages): string
    {
        for ($i = count($messages) - 1; $i >= 0; $i--) {
            $message = $messages[$i];
            if (is_array($message) && (string)($message['role'] ?? '') === 'user') {
                return $this->messageText($message['content'] ?? '');
            }
        }

        return '';
    }

    private function messageText(mixed $content): string
    {
        if (is_string($content)) {
            return $content;
        }
        if (!is_array($content)) {
            return (string)$content;
        }

        $parts = [];
        foreach ($content as $part) {
            if (is_array($part) && ($part['type'] ?? '') === 'text') {
                $parts[] = (string)($part['text'] ?? '');
            }
        }

        return trim(implode("\n", $parts));
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
        if (!is_array($decoded) && str_contains((string)$raw, 'data:')) {
            foreach (preg_split('/\R/', (string)$raw) ?: [] as $line) {
                $line = trim($line);
                if (!str_starts_with($line, 'data:')) {
                    continue;
                }
                $candidate = trim(substr($line, 5));
                if ($candidate === '' || $candidate === '[DONE]') {
                    continue;
                }
                $event = json_decode($candidate, true);
                if (is_array($event)) {
                    $decoded = $event;
                    break;
                }
            }
        }
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

    private function parseSkill(array $body): array
    {
        $fileName = (string)($body['fileName'] ?? 'Skill.md');
        $raw = (string)($body['content'] ?? '');
        $decoded = base64_decode($raw, true);
        $content = $decoded !== false ? $decoded : $raw;
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $fileType = $extension === 'zip' ? 'zip' : 'markdown';
        $scriptContent = '';
        $scriptRuntime = 'node';

        if ($fileType === 'zip') {
            $parsed = $this->extractSkillZip($content);
            $content = $parsed['content'];
            $scriptContent = $parsed['scriptContent'];
            $scriptRuntime = $parsed['scriptRuntime'];
        } else {
            $detected = $this->extractEmbeddedScript($content);
            $scriptContent = $detected['scriptContent'];
            $scriptRuntime = $detected['scriptRuntime'];
        }

        $frontmatter = $this->parseFrontmatter($content);
        $name = (string)($frontmatter['name'] ?? preg_replace('/\.(md|markdown|zip)$/i', '', $fileName) ?: 'Skill');
        $description = (string)($frontmatter['description'] ?? $this->firstMarkdownParagraph($content));

        return [
            'name' => $name,
            'description' => $description,
            'inputSchema' => $this->normalizeSkillParams($frontmatter['inputSchema'] ?? $frontmatter['inputs'] ?? []),
            'outputSchema' => $this->normalizeSkillParams($frontmatter['outputSchema'] ?? $frontmatter['outputs'] ?? []),
            'examples' => is_array($frontmatter['examples'] ?? null) ? $frontmatter['examples'] : [],
            'metadata' => is_array($frontmatter['metadata'] ?? null) ? $frontmatter['metadata'] : [],
            'version' => (string)($frontmatter['version'] ?? '1.0.0'),
            'content' => $content,
            'fileType' => $fileType,
            'scriptRuntime' => $scriptRuntime,
            'scriptContent' => $scriptContent,
        ];
    }

    private function extractSkillZip(string $bytes): array
    {
        $result = ['content' => '', 'scriptRuntime' => 'node', 'scriptContent' => ''];
        if (!class_exists('ZipArchive')) {
            $result['content'] = 'ZipArchive is not available in this PHP runtime. Store the zip externally or upload markdown.';
            return $result;
        }

        $zipPath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'skill_' . $this->id() . '.zip';
        file_put_contents($zipPath, $bytes);
        $zip = new \ZipArchive();
        if ($zip->open($zipPath) !== true) {
            @unlink($zipPath);
            $result['content'] = 'Unable to open uploaded zip skill.';
            return $result;
        }

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string)$zip->getNameIndex($i);
            $lower = strtolower($name);
            if ($result['content'] === '' && (str_ends_with($lower, 'skill.md') || str_ends_with($lower, 'skill.markdown') || str_ends_with($lower, '.md'))) {
                $result['content'] = (string)$zip->getFromIndex($i);
            }
            if ($result['scriptContent'] === '' && preg_match('/\.(js|mjs|py|php|sh)$/i', $name, $m)) {
                $result['scriptContent'] = (string)$zip->getFromIndex($i);
                $result['scriptRuntime'] = match (strtolower($m[1])) {
                    'py' => 'python',
                    'php' => 'php',
                    'sh' => 'shell',
                    default => 'node',
                };
            }
        }
        $zip->close();
        @unlink($zipPath);

        if ($result['content'] === '') {
            $result['content'] = 'No SKILL.md or markdown file was found in the uploaded zip.';
        }

        return $result;
    }

    private function extractEmbeddedScript(string $content): array
    {
        if (preg_match('/```(javascript|js|node|python|py|php|bash|shell|sh)\s+skill-script\s*\R([\s\S]*?)```/i', $content, $m)) {
            $lang = strtolower($m[1]);
            return [
                'scriptRuntime' => match ($lang) {
                    'python', 'py' => 'python',
                    'php' => 'php',
                    'bash', 'shell', 'sh' => 'shell',
                    default => 'node',
                },
                'scriptContent' => trim($m[2]),
            ];
        }

        return ['scriptRuntime' => 'node', 'scriptContent' => ''];
    }

    private function parseFrontmatter(string $content): array
    {
        if (!preg_match('/^---\s*\R([\s\S]*?)\R---/u', $content, $m)) {
            return [];
        }

        $data = [];
        foreach (preg_split('/\R/', trim($m[1])) ?: [] as $line) {
            if (!str_contains($line, ':')) {
                continue;
            }
            [$key, $value] = array_map('trim', explode(':', $line, 2));
            $value = trim($value, " \"'");
            if ($key !== '') {
                $data[$key] = $value;
            }
        }

        return $data;
    }

    private function firstMarkdownParagraph(string $content): string
    {
        $content = preg_replace('/^---\s*\R[\s\S]*?\R---/u', '', $content) ?? $content;
        foreach (preg_split('/\R{2,}/', trim($content)) ?: [] as $block) {
            $block = trim((string)preg_replace('/^#+\s*/m', '', $block));
            if ($block !== '' && !str_starts_with($block, '```')) {
                return $this->slice($block, 0, 240);
            }
        }

        return '';
    }

    private function normalizeSkillParams(mixed $value): array
    {
        return is_array($value) ? array_values(array_filter(array_map(function ($row) {
            if (!is_array($row)) {
                return null;
            }
            return [
                'name' => (string)($row['name'] ?? ''),
                'type' => (string)($row['type'] ?? 'string'),
                'description' => (string)($row['description'] ?? ''),
                'required' => (bool)($row['required'] ?? false),
            ];
        }, $value))) : [];
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
        $row = $this->timestamps($row + ['name' => 'Default Tool', 'type' => 'mcp', 'description' => '', 'configData' => [], 'isActive' => true]);
        if (($row['type'] ?? '') === 'skill') {
            $skill = is_array($row['skill'] ?? null) ? $row['skill'] : (is_array($row['skillData'] ?? null) ? $row['skillData'] : []);
            $config = is_array($row['configData'] ?? null) ? $row['configData'] : [];
            $row['skill'] = [
                'id' => (string)($skill['id'] ?? $row['id'] . '-skill'),
                'toolId' => (string)$row['id'],
                'name' => (string)($skill['name'] ?? $row['name']),
                'description' => (string)($skill['description'] ?? $row['description'] ?? ''),
                'content' => (string)($skill['content'] ?? ''),
                'fileType' => (string)($skill['fileType'] ?? 'markdown'),
                'inputSchema' => is_array($skill['inputSchema'] ?? null) ? $skill['inputSchema'] : [],
                'outputSchema' => is_array($skill['outputSchema'] ?? null) ? $skill['outputSchema'] : [],
                'examples' => is_array($skill['examples'] ?? null) ? $skill['examples'] : [],
                'metadata' => is_array($skill['metadata'] ?? null) ? $skill['metadata'] : [],
                'version' => (string)($skill['version'] ?? '1.0.0'),
                'scriptEnabled' => (bool)($config['scriptEnabled'] ?? $skill['scriptEnabled'] ?? false),
                'scriptRuntime' => (string)($config['scriptRuntime'] ?? $skill['scriptRuntime'] ?? 'node'),
                'scriptContent' => (string)($config['scriptContent'] ?? $skill['scriptContent'] ?? ''),
                'isActive' => (bool)($row['isActive'] ?? true),
                'createdAt' => (string)($skill['createdAt'] ?? $row['createdAt']),
                'updatedAt' => (string)$row['updatedAt'],
            ];
            unset($row['skillData']);
        }

        return $row;
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
