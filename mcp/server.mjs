#!/usr/bin/env node
// Starts the Testing and Feedback Kit's agent server on stdio. What it does and its settings: tools.mjs.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.mjs';

const server = new McpServer({ name: 'testing-feedback', version: '1.0.0' });
registerTools(server);
await server.connect(new StdioServerTransport());
