import express from 'express';
import {
  CopilotRuntime,
  AnthropicAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from '@copilotkit/runtime';

const app = express();
const PORT = 4001;

// Support both env var names — the .env file has CLAUDE_API_KEY
const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

if (!apiKey) {
  console.error('Missing ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable');
  process.exit(1);
}

const serviceAdapter = new AnthropicAdapter({
  model: 'claude-sonnet-4-5-20250929',
});

const runtime = new CopilotRuntime();

const handler = copilotRuntimeNodeHttpEndpoint({
  endpoint: '/copilotkit',
  runtime,
  serviceAdapter,
});

app.use(handler);

app.listen(PORT, () => {
  console.log(`Copilot runtime listening on port ${PORT}`);
});
