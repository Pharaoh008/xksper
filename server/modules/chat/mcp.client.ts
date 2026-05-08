import { Logger } from '@nestjs/common';
import axios from 'axios';

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class McpClient {
  private readonly logger = new Logger(McpClient.name);

  /**
   * 使用 JSON-RPC over HTTP 获取 MCP 工具列表
   */
  async listTools(url: string, headers?: Record<string, string>): Promise<McpTool[]> {
    this.logger.log(`获取 MCP 工具列表: ${url}`);
    
    try {
      const response = await axios.post(
        url,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            ...headers,
          },
          timeout: 30000,
        },
      );

      this.logger.log(`MCP 响应: ${JSON.stringify(response.data)}`);
      
      // 处理 SSE 格式响应 (text/event-stream)
      let data = response.data;
      if (typeof data === 'string' && data.includes('event: message')) {
        // 解析 SSE 格式
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              data = JSON.parse(line.slice(6));
              break;
            } catch {
              // 继续尝试下一行
            }
          }
        }
      }
      
      const result = data.result || data;
      if (result && Array.isArray(result.tools)) {
        return result.tools.map((t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
          name: t.name,
          description: t.description || '',
          inputSchema: t.inputSchema || {},
        }));
      }
      
      throw new Error(`Invalid response format: ${JSON.stringify(data).substring(0, 500)}`);
    } catch (error) {
      this.logger.error(`获取 MCP 工具列表失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 使用 JSON-RPC over HTTP 调用 MCP 工具
   */
  async callTool(
    url: string,
    toolName: string,
    args: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<string> {
    this.logger.log(`调用 MCP 工具: ${toolName}, args: ${JSON.stringify(args)}`);

    try {
      const response = await axios.post(
        url,
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            ...headers,
          },
          timeout: 25000,  // 25秒超时，确保在FaaS限制内
        },
      );

      const result = response.data.result;
      
      // 处理返回结果
      const textParts: string[] = [];
      if (result && Array.isArray(result.content)) {
        for (const part of result.content) {
          if (part.type === 'text' && part.text) {
            textParts.push(part.text);
          }
        }
      }
      
      if (textParts.length === 0) {
        textParts.push(JSON.stringify(result));
      }
      
      return textParts.join('\n');
    } catch (error) {
      this.logger.error(`调用 MCP 工具失败: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * 获取 MCP 服务器的完整工具定义（用于传给 LLM 的 tools 参数）
   */
  async getToolsForLlm(url: string, headers?: Record<string, string>): Promise<Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>> {
    const tools = await this.listTools(url, headers);
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }
}

export const mcpClient = new McpClient();
