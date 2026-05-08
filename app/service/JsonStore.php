<?php

declare(strict_types=1);

namespace app\service;

final class JsonStore
{
    private string $file;
    private array $data;

    public function __construct()
    {
        $this->file = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'thinkphp_vercel_store.json';
        $this->data = $this->load();
    }

    public function all(string $name): array
    {
        return array_values($this->data[$name] ?? []);
    }

    public function find(string $name, string $id): ?array
    {
        return $this->data[$name][$id] ?? null;
    }

    public function upsert(string $name, array $row): void
    {
        $id = (string)($row['id'] ?? bin2hex(random_bytes(8)));
        $row['id'] = $id;
        $this->data[$name][$id] = $row;
        $this->save();
    }

    public function delete(string $name, string $id): bool
    {
        $exists = isset($this->data[$name][$id]);
        unset($this->data[$name][$id]);
        $this->save();
        return $exists;
    }

    public function deleteMany(string $name, array $ids): int
    {
        $deleted = 0;
        foreach ($ids as $id) {
            if (isset($this->data[$name][$id])) {
                unset($this->data[$name][$id]);
                $deleted++;
            }
        }
        $this->save();
        return $deleted;
    }

    public function meta(string $name): ?array
    {
        $value = $this->data['_meta'][$name] ?? null;
        return is_array($value) ? $value : null;
    }

    public function setMeta(string $name, array $value): void
    {
        $this->data['_meta'][$name] = $value;
        $this->save();
    }

    private function load(): array
    {
        if (is_file($this->file)) {
            $data = json_decode((string)file_get_contents($this->file), true);
            if (is_array($data)) {
                return $data;
            }
        }

        $now = gmdate('c');
        return [
            'agents' => [
                'agent-demo' => [
                    'id' => 'agent-demo',
                    'name' => '通用助手',
                    'description' => '默认演示智能体',
                    'instruction' => '帮助用户完成日常任务。',
                    'greeting' => '你好，我是通用助手。',
                    'model' => 'gpt-4o-mini',
                    'knowledgeBase' => [],
                    'tools' => [],
                    'avatarUrl' => '',
                    'isActive' => true,
                    'createdAt' => $now,
                    'updatedAt' => $now,
                ],
            ],
            'workflows' => [],
            'knowledge' => [],
            'tools' => [],
            'organizations' => [
                'org-default' => [
                    'id' => 'org-default',
                    'name' => '默认组织',
                    'description' => '',
                    'createdAt' => $now,
                    'updatedAt' => $now,
                ],
            ],
            'roles' => [],
            'conversations' => [],
            'messages' => [],
            'documents' => [],
            'folders' => [],
            'permissions' => [],
            'executions' => [],
            'dataSources' => [],
            'customModels' => [],
            '_meta' => [],
        ];
    }

    private function save(): void
    {
        file_put_contents($this->file, json_encode($this->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}
