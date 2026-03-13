---
name: abacus-chatllm-javascript
description: >-
  Use Abacus.AI ChatLLM for chat completions, LLM invocation, and multi-turn
  conversations. Supports top open-source and proprietary LLMs via REST API.
metadata:
  author: abacus-ai
  product: chatllm
  language: javascript
---

# Abacus.AI ChatLLM - JavaScript (REST API)

Abacus.AI ChatLLM (and ChatLLM Teams / Super Assistant) provides access to top LLMs for chat, code, and structured outputs. There is no official JavaScript SDK; use the REST API with `fetch` or your HTTP client. Authentication uses an API key.

**Docs:** [ChatLLM Introduction](https://abacus.ai/help/chatllm-ai-super-assistant/introduction) | [API Reference](https://abacus.ai/help/api/ref) | [Authentication](https://abacus.ai/help/authentication)

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

All examples below assume you have `abacusFetch` or equivalent (base URL + API key in headers).

## Get chat response (predict)

Call the chat/predict endpoint to get an LLM response. Maps to the Python SDK `evaluate_prompt` / API `getChatResponse`.

`POST /predict/getChatResponse` (or equivalent predict endpoint — check [API Reference](https://abacus.ai/help/api/ref/predict/getChatResponse))

```javascript
const response = await abacusFetch('/predict/getChatResponse', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'What is the capital of Greece?',
    system_message: 'You should answer concisely.',
    llm_name: 'OPENAI_GPT4O',
    // optional: messages for multi-turn
    // messages: [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }],
  }),
});
console.log(response.content);
```

## Evaluate prompt (LLM invocation)

Invoke an LLM with a single prompt and optional system message. Equivalent to Python `client.evaluate_prompt(prompt, system_message, llm_name)`.

`POST /ai_agents/evaluatePrompt` (or path from [evaluatePrompt ref](https://abacus.ai/help/api/ref/ai_agents/evaluatePrompt))

```javascript
const result = await abacusFetch('/ai_agents/evaluatePrompt', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'What is the capital of Greece?',
    system_message: 'Answer with a single word.',
    llm_name: 'OPENAI_GPT4O',
  }),
});
console.log(result.content);
```

## JSON / structured response

Request a structured JSON response using a schema.

```javascript
const result = await abacusFetch('/ai_agents/evaluatePrompt', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'List three learning objectives for a course on car maintenance.',
    llm_name: 'OPENAI_GPT4O',
    response_type: 'json',
    json_response_schema: {
      learning_objectives: {
        type: 'list',
        description: 'List of learning objectives',
        is_required: true,
      },
    },
  }),
});
const data = JSON.parse(result.content);
console.log(data.learning_objectives);
```

## Multi-turn messages (with optional image)

Send a list of messages for multi-turn chat. Messages can include image content (base64 data URL).

```javascript
const result = await abacusFetch('/ai_agents/evaluatePrompt', {
  method: 'POST',
  body: JSON.stringify({
    llm_name: 'OPENAI_GPT4O',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,...' },
          },
        ],
      },
      {
        role: 'user',
        content: 'What do you see in the image?',
      },
    ],
  }),
});
console.log(result.content);
```

## Common LLM names

Use `llm_name` to select the model. Examples (verify in Abacus docs): `OPENAI_GPT4O`, `OPENAI_GPT4O_MINI`, and other open-source or proprietary LLMs available on the platform.

## Environment variables

- `ABACUS_API_KEY` — Required. Get from Abacus.AI dashboard or developer settings.
- `ABACUS_API_URL` — Optional. Base URL (e.g. `https://api.abacus.ai`). Defaults may vary; check [API Reference](https://abacus.ai/help/api/ref).

## References

- [ChatLLM & Super Assistant Introduction](https://abacus.ai/help/chatllm-ai-super-assistant/introduction)
- [Invoking LLMs (Python SDK)](https://abacus.ai/help/python-sdk/genai/calling-llms) — same parameters map to REST.
- [API Reference](https://abacus.ai/help/api/ref) — exact paths and request/response shapes.
