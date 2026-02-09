# Cursor Skills

This directory contains Agent Skills for Cursor that help the AI assistant understand how to work with specific APIs and integrations in this project.

## Available Skills

### Telnyx Skills (JavaScript)

These skills teach the AI how to use Telnyx APIs with the JavaScript SDK:

- **telnyx-messaging-javascript** - Send/receive SMS/MMS, manage messaging numbers, handle opt-outs
- **telnyx-voice-javascript** - Call control: dial, answer, hangup, transfer, bridge
- **telnyx-numbers-javascript** - Search, order, and manage phone numbers
- **telnyx-verify-javascript** - Phone verification, number lookup, 2FA
- **telnyx-ai-assistants-javascript** - AI voice assistants with knowledge bases

### Project-Specific Skills

- **gohighlevel-typescript** - GoHighLevel CRM integration following this project's provider pattern

## Usage

These skills are automatically available to Cursor when working in this project. The AI will use them when you ask questions like:

- "How do I send an SMS using Telnyx?"
- "Show me how to create a contact in GoHighLevel"
- "How do I make a voice call with Telnyx?"

## Adding More Skills

To add more Telnyx skills or other agent skills:

1. Clone the Telnyx skills repository: `git clone https://github.com/team-telnyx/telnyx-ext-agent-skills.git`
2. Copy the desired skill directory to `.cursor/skills/`
3. Skills are automatically detected by Cursor

## Skill Sources

- Telnyx skills: https://github.com/team-telnyx/telnyx-ext-agent-skills
- GoHighLevel skill: Created specifically for this project