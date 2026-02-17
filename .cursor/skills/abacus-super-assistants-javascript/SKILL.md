---
name: abacus-super-assistants-javascript
description: >-
  Build and deploy AI super assistants and Deep Agent apps with Abacus.AI:
  custom chatbots, agentic workflows, and deployments. Use when building
  enterprise assistants or embedding ChatLLM/Deep Agent in applications.
metadata:
  author: abacus-ai
  product: super-assistants
  language: javascript
---

# Abacus.AI Super Assistants & Deep Agent - JavaScript

Abacus.AI Super Assistant (ChatLLM Teams / Abacus Enterprise) provides an all-in-one AI assistant for chat, code, voice, images, and video. The **Deep Agent** extends this with agentic tasks, app creation, and custom deployments. Use the REST API from JavaScript/TypeScript when building custom chatbots or embedding super assistants.

**Docs:** [ChatLLM Introduction](https://abacus.ai/help/chatllm-ai-super-assistant/introduction) | [Deep Agent](https://abacus.ai/help/chatllm-ai-super-assistant/deepagent) | [Deep Agent Apps](https://abacus.ai/help/chatllm-ai-super-assistant/deepagent-apps) | [Developer Platform](https://abacus.ai/help/developer-platform/introduction)

## Concepts

- **ChatLLM / Super Assistant** — All-in-one AI (text, code, voice, image, video) with access to top LLMs.
- **Deep Agent** — Advanced agent with tasks, tools, and multi-step workflows.
- **Deep Agent Apps** — Deploy custom chatbots or agents to users; custom domains and branding.
- **Enterprise Platform** — Custom chatbots, AI Workflows, agentic framework, connectors.

## Setup

```javascript
const ABACUS_API_BASE = process.env.ABACUS_API_URL || 'https://api.abacus.ai';
const ABACUS_API_KEY = process.env.ABACUS_API_KEY;

async function abacusFetch(path, options = {}) {
  const url = `${ABACUS_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ABACUS_API_KEY}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Abacus API ${res.status}: ${await res.text()}`);
  return res.json();
}
```

## Create deployment (deploy chatbot / agent)

Deploy a custom chatbot or agent so it can be used by end users. See [API Reference: createDeployment](https://abacus.ai/help/api/ref/deployment/createDeployment).

`POST /deployment/createDeployment` (or equivalent — check API ref)

```javascript
const deployment = await abacusFetch('/deployment/createDeployment', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Support Bot',
    project_id: 'your-project-id',
    // deployment config: model, system prompt, tools, etc.
  }),
});
console.log(deployment.deployment_id, deployment.url);
```

## List or get deployments

List deployments for a project or get a single deployment by ID. Exact paths in [API Reference](https://abacus.ai/help/api/ref).

```javascript
const list = await abacusFetch('/deployment/list?project_id=your-project-id');
list.forEach(d => console.log(d.deployment_id, d.name));
```

## Deep Agent tasks

Deep Agent supports task-based workflows. Use the API to run or schedule agent tasks (see [Deep Agent Tasks](https://abacus.ai/help/chatllm-ai-super-assistant/deepagent-tasks)).

```javascript
// Example: trigger or query a Deep Agent task (path from API ref)
const taskResult = await abacusFetch('/ai_agents/tasks', {
  method: 'POST',
  body: JSON.stringify({
    agent_id: 'your-agent-id',
    task_description: 'Summarize the last 5 support tickets',
  }),
});
```

## Custom chatbots (Enterprise)

For enterprise custom chatbots, use the Developer Platform and ChatLLM use case. Build with AI Workflows and the agentic framework; expose via REST or embed in your app.

- [Custom Chatbots](https://abacus.ai/help/developer-platform/useCases/CHAT_LLM)
- [AI Workflows & Agentic Framework](https://abacus.ai/help/developer-platform/useCases/AI_AGENTS)

## App deployment and custom domains

Deploy Deep Agent apps and attach custom domains so users access your assistant at your URL.

- [App Deployment & Custom Domains](https://abacus.ai/help/chatllm-ai-super-assistant/deepagent-apps-deployment)

## Environment variables

- `ABACUS_API_KEY` — Required.
- `ABACUS_API_URL` — Optional base URL.

## When to use this skill

- Building an AI super assistant (chat + code + voice + media) similar to Telnyx AI Assistants but using Abacus ChatLLM/Deep Agent.
- Deploying custom chatbots or agents for enterprises or teams.
- Integrating Abacus Deep Agent or ChatLLM into an existing app via REST.

## References

- [ChatLLM & Abacus AI Deep Agent](https://abacus.ai/help/chatllm-ai-super-assistant/introduction)
- [Deep Agent How-To](https://abacus.ai/help/chatllm-ai-super-assistant/deepagent)
- [Deep Agent Apps How-To](https://abacus.ai/help/chatllm-ai-super-assistant/deepagent-apps)
- [Developer Platform](https://abacus.ai/help/developer-platform/introduction)
- [API Reference](https://abacus.ai/help/api/ref)
