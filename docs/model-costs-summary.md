# Model Cost Summary: Opus vs Others

A quick reference for AI model costs when using Cursor or similar tools.

## Cursor Pricing Model

- **Pro plan**: $20/month with 500 "fast" requests
- **Premium models** (e.g., Claude Opus 4.6) consume requests at a higher rate — typically ~10x per request
- **Slow requests**: Unlimited but may be queued during peak times

## Upstream API Pricing (Approximate)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Relative Cost |
|-------|------------------------|------------------------|---------------|
| **Claude Opus 4.6** | ~$15 | ~$75 | Highest |
| **Claude Sonnet 4** | ~$3 | ~$15 | Medium |
| **Claude Haiku 3.5** | ~$0.80 | ~$4 | Low |
| **GPT-4o** | ~$2.50 | ~$10 | Medium |
| **GPT-4o mini** | ~$0.15 | ~$0.60 | Very Low |

## Relative Cost Comparison

- **Opus 4.6** is roughly **5x** more expensive than Sonnet 4
- **Opus 4.6** is roughly **~50x** more expensive than Haiku at the API level
- **Sonnet 4** is the typical sweet spot for most coding tasks

## Usage Tips

| Use Case | Recommended Model |
|----------|-------------------|
| Routine coding, quick edits | Sonnet 4, Haiku |
| Complex refactors, architecture | Opus 4.6 |
| Deep debugging, multi-file changes | Opus 4.6 |
| Exploration, simple questions | Haiku, Sonnet |

> **Note**: You can switch models per-chat in Cursor via the model dropdown. Cursor may automatically use a faster model for subagent tasks when appropriate.
