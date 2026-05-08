<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
}

$payload = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($payload)) {
    respond(400, ['ok' => false, 'error' => 'Invalid JSON payload.']);
}

try {
    $harness = new AgentHarness($payload);
    respond(200, $harness->run());
} catch (Throwable $error) {
    respond(500, [
        'ok' => false,
        'error' => $error->getMessage(),
    ]);
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

final class AgentHarness
{
    private array $input;
    private array $trace = [];
    private array $reasoning = [];
    private array $state = [];

    public function __construct(array $input)
    {
        $this->input = $input;
    }

    public function run(): array
    {
        $this->node('prepare', fn () => $this->prepare());
        $this->node('route', fn () => $this->routeIntent());
        $this->node('retrieve', fn () => $this->retrieveKnowledge());
        $this->node('skills', fn () => $this->compileSkills());
        $this->node('mcp', fn () => $this->collectMcpContext());
        $this->node('planner', fn () => $this->buildExecutionPlan());
        $this->node('prompt', fn () => $this->compilePrompt());
        $this->node('model', fn () => $this->callModel());
        $this->node('audit', fn () => $this->auditOutput());

        return [
            'ok' => true,
            'output' => $this->state['output'] ?? '',
            'trace' => $this->trace,
            'reasoning' => $this->reasoning,
            'harness' => [
                'runtime' => 'php-state-graph',
                'langgraphAligned' => true,
                'threadId' => $this->state['threadId'] ?? '',
                'checkpointCount' => count($this->trace),
            ],
            'usage' => $this->state['usage'] ?? null,
        ];
    }

    private function node(string $name, callable $callback): void
    {
        $started = microtime(true);
        $before = $this->checkpointSummary();
        $callback();
        $after = $this->checkpointSummary();
        $this->trace[] = [
            'node' => $name,
            'status' => 'ok',
            'durationMs' => (int)round((microtime(true) - $started) * 1000),
            'input' => $before,
            'output' => $after,
            'detail' => $this->nodeDetail($name),
        ];
    }

    private function prepare(): void
    {
        $settings = $this->input['settings'] ?? [];
        $agent = $this->input['agent'] ?? [];
        $messages = $this->input['messages'] ?? [];

        $apiKey = trim((string)($settings['apiKey'] ?? getenv('WCNB_API_KEY') ?: ''));
        if ($apiKey === '') {
            throw new RuntimeException('Missing wcnb.ai API Key.');
        }

        $baseUrl = rtrim((string)($settings['baseUrl'] ?? 'https://wcnb.ai'), '/');
        if (!filter_var($baseUrl, FILTER_VALIDATE_URL)) {
            throw new RuntimeException('Invalid wcnb.ai Base URL.');
        }

        $this->state = [
            'apiKey' => $apiKey,
            'baseUrl' => $baseUrl,
            'threadId' => trim((string)($this->input['threadId'] ?? $this->input['sessionId'] ?? ('thread_' . bin2hex(random_bytes(6))))),
            'agent' => [
                'name' => trim((string)($agent['name'] ?? 'Agent')),
                'provider' => trim((string)($agent['provider'] ?? 'openai')),
                'model' => trim((string)($agent['model'] ?? 'gpt-4o')),
                'temperature' => (float)($agent['temperature'] ?? 0.4),
                'systemPrompt' => trim((string)($agent['systemPrompt'] ?? 'You are a helpful assistant.')),
            ],
            'messages' => is_array($messages) ? $messages : [],
            'query' => is_array($messages) ? $this->lastUserMessage($messages) : '',
        ];

        $this->addReasoning('接收任务', '已创建 thread/checkpoint 上下文，并确认模型中转配置可用。');
    }

    private function routeIntent(): void
    {
        $query = $this->lower($this->state['query']);
        $intent = 'general';

        if (preg_match('/code|api|php|vercel|deploy|bug|error|代码|接口|部署|报错/u', $query)) {
            $intent = 'engineering';
        } elseif (preg_match('/plan|方案|策略|设计|架构|agent|智能体/u', $query)) {
            $intent = 'planning';
        } elseif (preg_match('/summar|总结|提炼|归纳/u', $query)) {
            $intent = 'synthesis';
        }

        $this->state['intent'] = $intent;
        $this->state['riskLevel'] = preg_match('/delete|payment|法律|医疗|财务|删除|付款|生产/u', $query) ? 'review' : 'normal';
        $this->addReasoning('意图路由', '任务被路由为 ' . $intent . '，风险级别为 ' . $this->state['riskLevel'] . '。');
    }

    private function retrieveKnowledge(): void
    {
        $query = $this->lower($this->state['query']);
        $items = array_filter($this->input['knowledge'] ?? [], 'is_array');
        $ranked = [];

        foreach ($items as $item) {
            $title = (string)($item['title'] ?? '');
            $content = (string)($item['content'] ?? '');
            $haystack = $this->lower($title . "\n" . $content);
            $score = 0;

            foreach (preg_split('/\s+/u', $query) ?: [] as $token) {
                if ($token !== '' && $this->contains($haystack, $token)) {
                    $score++;
                }
            }

            $ranked[] = [
                'score' => $score,
                'text' => trim($title . "\n" . $content),
            ];
        }

        usort($ranked, fn ($a, $b) => $b['score'] <=> $a['score']);
        $selected = array_slice($ranked, 0, 5);
        $this->state['knowledgeContext'] = array_column($selected, 'text');
        $this->state['knowledgeScores'] = array_map(fn ($item) => (int)$item['score'], $selected);
        $this->addReasoning('知识检索', '已从 ' . count($items) . ' 条知识中选择 ' . count($selected) . ' 条加入上下文。');
    }

    private function compileSkills(): void
    {
        $skills = array_filter($this->input['skills'] ?? [], 'is_array');
        $this->state['skillContext'] = array_values(array_filter(array_map(
            fn ($skill) => trim((string)($skill['name'] ?? '') . ': ' . (string)($skill['prompt'] ?? '')),
            $skills
        )));
        $this->addReasoning('Skill 注入', '已注入 ' . count($this->state['skillContext']) . ' 个 Skill 约束。');
    }

    private function collectMcpContext(): void
    {
        $contexts = [];

        foreach (array_filter($this->input['mcp'] ?? [], 'is_array') as $mcp) {
            $endpoint = trim((string)($mcp['endpoint'] ?? ''));
            if ($endpoint === '' || !filter_var($endpoint, FILTER_VALIDATE_URL)) {
                continue;
            }

            $result = $this->httpJson('POST', $endpoint, [
                'agent' => $this->state['agent']['name'],
                'input' => $this->state['query'],
                'messages' => array_slice($this->state['messages'], -6),
            ], []);

            $contexts[] = [
                'name' => (string)($mcp['name'] ?? 'MCP'),
                'result' => $this->slice(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 0, 4000),
            ];
        }

        $this->state['mcpContext'] = $contexts;
        $this->addReasoning('MCP 调用', '已调用 ' . count($contexts) . ' 个有效 MCP HTTP 网关。');
    }

    private function buildExecutionPlan(): void
    {
        $plan = [
            '理解用户目标并确认输出形态',
            '合并系统提示词、知识库、Skill 与 MCP 上下文',
            '调用模型生成答案',
            '检查答案是否为空、是否需要提示风险或下一步',
        ];

        if (($this->state['riskLevel'] ?? 'normal') === 'review') {
            array_splice($plan, 2, 0, ['对高风险动作加入人工确认建议']);
        }

        $this->state['publicPlan'] = $plan;
        $this->addReasoning('执行计划', implode('；', $plan));
    }

    private function compilePrompt(): void
    {
        $this->state['compiledSystemPrompt'] = $this->systemBlock();
        $this->addReasoning('提示编译', '已生成包含 Agent 角色、公开计划、知识、Skill、MCP 和审计规则的系统提示。');
    }

    private function callModel(): void
    {
        $provider = $this->state['agent']['provider'];
        $response = match ($provider) {
            'anthropic' => $this->callAnthropic(),
            'gemini' => $this->callGemini(),
            default => $this->callOpenAiCompatible(),
        };

        $this->state['rawResponse'] = $response;
        $this->state['output'] = $this->extractText($provider, $response);
        $this->state['usage'] = $response['usage'] ?? null;
    }

    private function auditOutput(): void
    {
        $output = trim((string)($this->state['output'] ?? ''));
        if ($output === '') {
            throw new RuntimeException('Model returned an empty response.');
        }

        $checks = [];
        $checks[] = 'non_empty';
        $checks[] = $this->contains($this->lower($output), 'api key') ? 'mentions_api_key' : 'no_secret_echo';

        $this->state['output'] = $output;
        $this->state['auditChecks'] = $checks;
        $this->addReasoning('结果审计', '答案非空，完成基础质量检查：' . implode(', ', $checks) . '。');
    }

    private function callOpenAiCompatible(): array
    {
        return $this->httpJson('POST', $this->state['baseUrl'] . '/v1/chat/completions', [
            'model' => $this->state['agent']['model'],
            'temperature' => $this->state['agent']['temperature'],
            'messages' => $this->openAiMessages(),
        ], $this->authHeaders());
    }

    private function callAnthropic(): array
    {
        return $this->httpJson('POST', $this->state['baseUrl'] . '/v1/messages', [
            'model' => $this->state['agent']['model'],
            'max_tokens' => 2048,
            'temperature' => $this->state['agent']['temperature'],
            'system' => $this->state['compiledSystemPrompt'] ?? $this->systemBlock(),
            'messages' => $this->anthropicMessages(),
        ], $this->authHeaders());
    }

    private function callGemini(): array
    {
        $model = rawurlencode($this->state['agent']['model']);
        return $this->httpJson('POST', $this->state['baseUrl'] . '/v1beta/models/' . $model . ':generateContent', [
            'systemInstruction' => [
                'parts' => [['text' => $this->state['compiledSystemPrompt'] ?? $this->systemBlock()]],
            ],
            'contents' => $this->geminiMessages(),
            'generationConfig' => [
                'temperature' => $this->state['agent']['temperature'],
            ],
        ], $this->authHeaders());
    }

    private function openAiMessages(): array
    {
        $messages = [['role' => 'system', 'content' => $this->state['compiledSystemPrompt'] ?? $this->systemBlock()]];

        foreach ($this->state['messages'] as $message) {
            $role = ($message['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
            $messages[] = ['role' => $role, 'content' => (string)($message['content'] ?? '')];
        }

        return $messages;
    }

    private function anthropicMessages(): array
    {
        return array_values(array_map(function ($message) {
            $role = ($message['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
            return ['role' => $role, 'content' => (string)($message['content'] ?? '')];
        }, $this->state['messages']));
    }

    private function geminiMessages(): array
    {
        return array_values(array_map(function ($message) {
            $role = ($message['role'] ?? '') === 'assistant' ? 'model' : 'user';
            return ['role' => $role, 'parts' => [['text' => (string)($message['content'] ?? '')]]];
        }, $this->state['messages']));
    }

    private function systemBlock(): string
    {
        $sections = [
            $this->state['agent']['systemPrompt'],
            'Harness policy: expose concise public reasoning summaries, selected evidence, tool/MCP outcomes, assumptions, and final answer. Do not reveal hidden chain-of-thought or private internal deliberation.',
            'Current agent: ' . $this->state['agent']['name'],
            'Thread ID: ' . ($this->state['threadId'] ?? ''),
            'Intent: ' . ($this->state['intent'] ?? 'general'),
            "Public execution plan:\n" . $this->joinContext($this->state['publicPlan'] ?? []),
            "Knowledge context:\n" . $this->joinContext($this->state['knowledgeContext'] ?? []),
            "Skills:\n" . $this->joinContext($this->state['skillContext'] ?? []),
            "MCP context:\n" . $this->joinContext(array_map(
                fn ($item) => ($item['name'] ?? 'MCP') . "\n" . ($item['result'] ?? ''),
                $this->state['mcpContext'] ?? []
            )),
        ];

        return implode("\n\n---\n\n", array_filter($sections));
    }

    private function joinContext(array $items): string
    {
        if (!$items) {
            return 'none';
        }

        return implode("\n\n", array_map(
            fn ($item, $index) => '[' . ($index + 1) . '] ' . trim((string)$item),
            $items,
            array_keys($items)
        ));
    }

    private function extractText(string $provider, array $response): string
    {
        if ($provider === 'anthropic') {
            $parts = $response['content'] ?? [];
            return trim(implode("\n", array_map(fn ($part) => (string)($part['text'] ?? ''), is_array($parts) ? $parts : [])));
        }

        if ($provider === 'gemini') {
            $parts = $response['candidates'][0]['content']['parts'] ?? [];
            return trim(implode("\n", array_map(fn ($part) => (string)($part['text'] ?? ''), is_array($parts) ? $parts : [])));
        }

        return trim((string)($response['choices'][0]['message']['content'] ?? $response['output_text'] ?? ''));
    }

    private function authHeaders(): array
    {
        return [
            'Authorization: Bearer ' . $this->state['apiKey'],
            'x-api-key: ' . $this->state['apiKey'],
        ];
    }

    private function httpJson(string $method, string $url, array $body, array $headers): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
            CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_TIMEOUT => 45,
        ]);

        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($raw === false || $error !== '') {
            throw new RuntimeException('HTTP request failed: ' . $error);
        }

        $decoded = json_decode($raw, true);
        if ($status >= 400) {
            throw new RuntimeException('Upstream error ' . $status . ': ' . $this->slice($raw, 0, 800));
        }

        if (!is_array($decoded)) {
            $decoded = $this->decodeServerSentEvents($raw);
        }

        if (!is_array($decoded)) {
            throw new RuntimeException('Upstream returned invalid JSON: ' . $this->slice($raw, 0, 800));
        }

        return $decoded;
    }

    private function decodeServerSentEvents(string $raw): ?array
    {
        if (!str_contains($raw, 'data:')) {
            return null;
        }

        $text = '';
        $usage = null;
        $model = '';
        $chunks = 0;

        foreach (preg_split('/\r\n|\r|\n/', $raw) ?: [] as $line) {
            $line = trim($line);
            if (!str_starts_with($line, 'data:')) {
                continue;
            }

            $data = trim(substr($line, 5));
            if ($data === '' || $data === '[DONE]') {
                continue;
            }

            $chunk = json_decode($data, true);
            if (!is_array($chunk)) {
                continue;
            }

            $chunks++;
            $model = $model ?: (string)($chunk['model'] ?? '');
            $usage = $chunk['usage'] ?? $usage;

            $choice = $chunk['choices'][0] ?? [];
            $text .= (string)($choice['delta']['content'] ?? '');
            $text .= (string)($choice['message']['content'] ?? '');
            $text .= (string)($choice['text'] ?? '');
        }

        if ($text === '' && $chunks === 0) {
            return null;
        }

        return [
            'object' => 'chat.completion',
            'model' => $model,
            'choices' => [[
                'message' => [
                    'role' => 'assistant',
                    'content' => $text,
                ],
            ]],
            'usage' => $usage,
        ];
    }

    private function addReasoning(string $title, string $summary): void
    {
        $this->reasoning[] = [
            'title' => $title,
            'summary' => $summary,
        ];
    }

    private function checkpointSummary(): array
    {
        return [
            'messages' => count($this->state['messages'] ?? []),
            'knowledge' => count($this->state['knowledgeContext'] ?? []),
            'skills' => count($this->state['skillContext'] ?? []),
            'mcp' => count($this->state['mcpContext'] ?? []),
            'plan' => count($this->state['publicPlan'] ?? []),
            'hasOutput' => trim((string)($this->state['output'] ?? '')) !== '',
        ];
    }

    private function nodeDetail(string $name): string
    {
        return match ($name) {
            'prepare' => 'Loaded settings, model provider, thread id and latest user task.',
            'route' => 'Classified intent and risk before choosing context policy.',
            'retrieve' => 'Ranked local knowledge entries with lightweight lexical matching.',
            'skills' => 'Converted Skill cards into model instructions.',
            'mcp' => 'Called configured HTTP MCP endpoints and captured JSON summaries.',
            'planner' => 'Built a visible execution plan for the run.',
            'prompt' => 'Compiled the final system prompt with public reasoning policy.',
            'model' => 'Called wcnb.ai model endpoint through the selected provider adapter.',
            'audit' => 'Checked final output and prepared the public reasoning trail.',
            default => 'Completed graph node.',
        };
    }

    private function lastUserMessage(array $messages): string
    {
        for ($i = count($messages) - 1; $i >= 0; $i--) {
            if (($messages[$i]['role'] ?? '') === 'user') {
                return (string)($messages[$i]['content'] ?? '');
            }
        }

        return '';
    }

    private function lower(string $value): string
    {
        return function_exists('mb_strtolower') ? mb_strtolower($value) : strtolower($value);
    }

    private function contains(string $haystack, string $needle): bool
    {
        return function_exists('mb_strpos')
            ? mb_strpos($haystack, $needle) !== false
            : strpos($haystack, $needle) !== false;
    }

    private function slice(string $value, int $start, int $length): string
    {
        return function_exists('mb_substr') ? mb_substr($value, $start, $length) : substr($value, $start, $length);
    }
}
