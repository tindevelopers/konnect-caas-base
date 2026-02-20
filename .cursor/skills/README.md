# Cursor Skills

This directory contains Agent Skills for Cursor that help the AI assistant understand how to work with specific APIs and integrations in this project.

## Available Skills

### Telnyx Skills (JavaScript)

Official [Telnyx Agent Skills](https://github.com/team-telnyx/telnyx-ext-agent-skills) — teach the AI how to use Telnyx APIs with the JavaScript SDK. Quick start: [Telnyx AI agent skills (Cursor)](https://telnyx.com/resources/ai-agent-skills-claude-code#quick-start-install-in-30-seconds).

- **telnyx-messaging-javascript** - Send/receive SMS/MMS, manage messaging numbers, handle opt-outs
- **telnyx-messaging-profiles-javascript** - Messaging profiles, number pools, short codes, auto-response
- **telnyx-voice-javascript** - Call control: dial, answer, hangup, transfer, bridge
- **telnyx-voice-media-javascript** - Playback, TTS, call recording
- **telnyx-numbers-javascript** - Search, order, and manage phone numbers
- **telnyx-verify-javascript** - Phone verification, number lookup, 2FA
- **telnyx-ai-assistants-javascript** - AI voice assistants with knowledge bases
- **telnyx-sip-javascript** - SIP trunking, outbound voice profiles, connections

### Abacus.AI Skills (JavaScript / REST)

Skills for working with Abacus.AI ChatLLM and Super Assistants (similar in spirit to Telnyx AI assistants):

- **abacus-chatllm-javascript** - Chat completions, LLM invocation (evaluate_prompt), multi-turn chat, JSON responses via REST API
- **abacus-super-assistants-javascript** - Deep Agent, custom chatbots, deployments, and embedding super assistants in applications

### Project-Specific Skills

- **gohighlevel-typescript** - GoHighLevel CRM integration following this project's provider pattern

## Usage

These skills are automatically available to Cursor when working in this project. The AI will use them when you ask questions like:

- "How do I send an SMS using Telnyx?"
- "Show me how to create a contact in GoHighLevel"
- "How do I make a voice call with Telnyx?"
- "How do I call Abacus.AI ChatLLM for a chat completion?"
- "How do I deploy an Abacus super assistant or Deep Agent app?"

## Adding More Skills

To add more Telnyx skills or other agent skills:

1. Clone the Telnyx skills repository: `git clone https://github.com/team-telnyx/telnyx-ext-agent-skills.git`
2. Copy the desired skill directory to `.cursor/skills/`
3. Skills are automatically detected by Cursor

## Skill Sources

- Telnyx skills: https://github.com/team-telnyx/telnyx-ext-agent-skills
- Abacus.AI skills: Created for this project (REST API; no official JS SDK). Docs: https://abacus.ai/help
- GoHighLevel skill: Created specifically for this project