# Multi-Agent Configuration for Cursor

## Current Setup

Your Cursor workspace is configured with:

### 1. Cursor Rules (`.cursor/rules/`)
Located in `/Users/foo/projects/konnect-caas-base/.cursor/rules/`

**Active Rules:**
- `project.mdc` - Project overview and conventions
- `typescript-standards.mdc` - TypeScript coding standards
- `react-components.mdc` - React component patterns
- `nextjs-app-router.mdc` - Next.js App Router conventions
- `supabase-database.mdc` - Supabase/PostgreSQL patterns
- `telnyx-integrations.mdc` - Telnyx API integration rules

### 2. Agent Configuration (`.cursor/AGENTS.md`)
Documents the Abacus AI Agent extension setup and usage.

### 3. MCP Configuration (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "supabase-local": {
      "url": "http://127.0.0.1:54321/mcp"
    }
  }
}
```

## Models and Multi-Agent Support

### Cursor Native Models

Cursor supports multiple AI models that you can use:

1. **Claude Opus 4.6** (Your Current Model)
   - Most capable model
   - Best for complex reasoning and large codebases
   - Higher cost per request
   - Excellent for architectural decisions

2. **Claude Sonnet 4.5**
   - Balanced capability and speed
   - Good for most coding tasks
   - More cost-effective than Opus
   - Recommended for day-to-day development

3. **Claude Haiku**
   - Fastest model
   - Best for simple tasks and quick responses
   - Most cost-effective
   - Good for code completion and simple queries

4. **GPT-4 Turbo**
   - Alternative to Claude models
   - Good for specific use cases
   - Different reasoning style

### Multi-Agent Workflows in Cursor

Cursor doesn't have built-in "multi-agent" orchestration like some frameworks, but you can achieve multi-agent workflows through:

#### 1. Agent Mode (Cmd+I / Ctrl+I)
- Opens Cursor's Agent interface
- Can perform multi-step tasks autonomously
- Reads files, makes changes, runs commands
- Maintains context across steps

#### 2. Composer Mode (Cmd+Shift+I / Ctrl+Shift+I)
- Multi-file editing mode
- Can work across multiple files simultaneously
- Better for refactoring and large changes

#### 3. Chat Mode (Cmd+L / Ctrl+L)
- Interactive Q&A mode
- Good for exploration and planning
- Can reference files with @filename

#### 4. Inline Edit (Cmd+K / Ctrl+K)
- Quick inline code edits
- Fastest for small changes

### Using Multiple Agents Effectively

While Cursor doesn't have explicit "multi-agent" configuration, you can use different modes for different tasks:

```
┌─────────────────────────────────────────────────────────────┐
│ Task Breakdown: Multi-Agent Approach                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Agent 1 (Chat Mode): Planning & Architecture                │
│   - Cmd+L to open chat                                      │
│   - Ask: "How should we implement X?"                       │
│   - Get architectural guidance                              │
│   - Create task breakdown                                   │
│                                                              │
│ Agent 2 (Agent Mode): Implementation                        │
│   - Cmd+I to open agent                                     │
│   - Task: "Implement the plan we discussed"                 │
│   - Agent reads files, makes changes                        │
│   - Autonomous multi-step execution                         │
│                                                              │
│ Agent 3 (Composer Mode): Refactoring                        │
│   - Cmd+Shift+I to open composer                            │
│   - Task: "Refactor these 5 files to use new pattern"      │
│   - Multi-file coordinated changes                          │
│                                                              │
│ Agent 4 (Inline Edit): Quick Fixes                          │
│   - Cmd+K on selected code                                  │
│   - Task: "Fix this bug"                                    │
│   - Fast, focused changes                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Model Selection Strategy

### When to Use Opus 4.6 (Your Current Model)

✅ **Use Opus for:**
- Complex architectural decisions
- Large refactoring across many files
- Understanding complex codebases
- Debugging difficult issues
- Writing comprehensive documentation
- Multi-step reasoning tasks

❌ **Don't Use Opus for:**
- Simple code completion
- Quick fixes
- Formatting changes
- Obvious bugs

### When to Use Sonnet 4.5

✅ **Use Sonnet for:**
- Day-to-day development
- Feature implementation
- Code reviews
- Test writing
- API integration
- Most coding tasks

### When to Use Haiku

✅ **Use Haiku for:**
- Code completion
- Simple refactoring
- Formatting
- Quick questions
- Documentation updates

## Configuring Model Preferences

### In Cursor Settings

1. **Open Settings**
   - `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux)
   - Or: `Cursor` → `Settings...`

2. **Search for "Model"**
   - Look for "Cursor: Model" or "AI Model"

3. **Select Default Model**
   - Choose your preferred default model
   - You can override per-session

### Per-Session Model Selection

In any Cursor AI interface (Chat, Agent, Composer):
- Look for model selector dropdown (usually top-right)
- Click to change model for current session
- Model preference persists for that mode

## Multi-Agent Patterns for Your Project

### Pattern 1: Planning → Implementation → Review

```typescript
// Step 1: Chat Mode (Opus) - Planning
"I need to add client billing for Telnyx number purchases.
What's the best architecture?"

// Step 2: Agent Mode (Sonnet) - Implementation
"Implement the billing system we discussed:
1. Create Stripe integration
2. Add cost tracking
3. Implement billing actions"

// Step 3: Chat Mode (Sonnet) - Review
"Review the billing implementation for:
- Security issues
- Edge cases
- Error handling"
```

### Pattern 2: Parallel Tasks

```typescript
// Terminal 1: Agent Mode (Sonnet)
"Implement the frontend UI for number checkout"

// Terminal 2: Agent Mode (Sonnet)
"Implement the backend API for order processing"

// Terminal 3: Chat Mode (Opus)
"Review both implementations and suggest integration points"
```

### Pattern 3: Iterative Refinement

```typescript
// Round 1: Agent Mode (Sonnet)
"Create basic reservation system"

// Round 2: Composer Mode (Sonnet)
"Add error handling across all reservation files"

// Round 3: Inline Edit (Haiku)
"Fix this specific error message"

// Round 4: Chat Mode (Opus)
"Analyze the complete flow and suggest improvements"
```

## Cursor Rules for Multi-Agent Workflows

Your cursor rules (`.mdc` files) are automatically applied to all AI interactions. They provide context about:

- **Project structure** (`project.mdc`)
- **Coding standards** (`typescript-standards.mdc`, `react-components.mdc`)
- **Framework conventions** (`nextjs-app-router.mdc`)
- **Integration patterns** (`telnyx-integrations.mdc`, `supabase-database.mdc`)

### Creating New Rules

To add a new rule:

1. **Create a new `.mdc` file**
   ```bash
   touch .cursor/rules/billing-system.mdc
   ```

2. **Write the rule**
   ```markdown
   # Billing System Rules
   
   ## Stripe Integration
   - Always use Stripe SDK v12+
   - Handle webhooks with idempotency
   - Store customer IDs in tenant table
   
   ## Cost Tracking
   - Record all costs in tenant_usage_costs table
   - Use UTC timestamps
   - Include source_type and source_id
   
   ## Error Handling
   - Retry failed charges with exponential backoff
   - Log all billing errors to monitoring
   - Send alerts for payment failures
   ```

3. **Rules are automatically loaded**
   - Cursor reads all `.mdc` files in `.cursor/rules/`
   - No restart needed
   - Applied to all AI interactions

## Abacus AI Agent Extension

You have the Abacus AI Agent extension installed. This provides additional capabilities:

### Activation
```
F1 → Type "Abacus" → Select "Abacus: Open Abacus"
```

### Capabilities
- Cursor skill creation
- GoHighLevel (GHL) integrations
- Code generation and automation
- Deep Agent functionality for complex coding tasks

### Configuration
```json
// In Cursor settings
{
  "abacus.viewKind": "editor"  // or "sidebar" or "panel"
}
```

## MCP (Model Context Protocol) Integration

Your project has MCP configured for Supabase:

```json
{
  "mcpServers": {
    "supabase-local": {
      "url": "http://127.0.0.1:54321/mcp"
    }
  }
}
```

This allows Cursor to:
- Query your local Supabase database
- Understand your schema
- Generate type-safe queries
- Validate database operations

### Adding More MCP Servers

You can add additional MCP servers:

```json
{
  "mcpServers": {
    "supabase-local": {
      "url": "http://127.0.0.1:54321/mcp"
    },
    "telnyx-api": {
      "url": "http://127.0.0.1:8080/mcp",
      "description": "Telnyx API documentation and examples"
    },
    "stripe-api": {
      "url": "http://127.0.0.1:8081/mcp",
      "description": "Stripe billing integration context"
    }
  }
}
```

## Recommended Workflow for Complex Tasks

### Example: Implementing Telnyx Number Billing

```
Step 1: Planning (Chat Mode + Opus)
├─ "Design billing system for Telnyx numbers"
├─ Get architectural guidance
└─ Create task breakdown

Step 2: Database Schema (Agent Mode + Sonnet)
├─ "Create migration for billing tables"
├─ Uses supabase-database.mdc rules
└─ Validates with MCP

Step 3: Backend API (Agent Mode + Sonnet)
├─ "Implement billing actions"
├─ Uses typescript-standards.mdc rules
└─ Follows telnyx-integrations.mdc patterns

Step 4: Frontend UI (Composer Mode + Sonnet)
├─ "Add billing UI to checkout flow"
├─ Uses react-components.mdc rules
└─ Follows nextjs-app-router.mdc conventions

Step 5: Testing (Chat Mode + Sonnet)
├─ "Generate test cases for billing"
├─ Review edge cases
└─ Suggest improvements

Step 6: Documentation (Inline Edit + Haiku)
├─ Add JSDoc comments
├─ Update README
└─ Quick formatting fixes

Step 7: Review (Chat Mode + Opus)
├─ "Review complete billing implementation"
├─ Security analysis
└─ Performance optimization suggestions
```

## Cost Optimization

### Model Costs (Approximate)

- **Opus 4.6**: ~$15 per 1M input tokens, ~$75 per 1M output tokens
- **Sonnet 4.5**: ~$3 per 1M input tokens, ~$15 per 1M output tokens
- **Haiku**: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens

### Cost-Effective Strategy

1. **Use Opus sparingly** (10-20% of tasks)
   - Architecture decisions
   - Complex debugging
   - Critical reviews

2. **Use Sonnet for most work** (70-80% of tasks)
   - Feature implementation
   - Code reviews
   - Test writing

3. **Use Haiku for simple tasks** (10% of tasks)
   - Code completion
   - Formatting
   - Quick fixes

### Example Monthly Usage

```
Opus:    10 hours/month  × $15/hour  = $150
Sonnet:  80 hours/month  × $3/hour   = $240
Haiku:   10 hours/month  × $0.25/hour = $2.50
─────────────────────────────────────────────
Total:   100 hours/month             = $392.50
```

## Advanced: Custom Agent Workflows

### Creating a Custom Workflow Script

You can create bash scripts to orchestrate multi-agent workflows:

```bash
#!/bin/bash
# .cursor/workflows/implement-feature.sh

echo "🤖 Multi-Agent Feature Implementation"
echo "======================================="

# Step 1: Planning with Opus
echo "Step 1: Planning..."
cursor chat --model opus "Plan implementation for: $1"

# Step 2: Implementation with Sonnet
echo "Step 2: Implementation..."
cursor agent --model sonnet "Implement the plan for: $1"

# Step 3: Testing with Sonnet
echo "Step 3: Testing..."
cursor agent --model sonnet "Write tests for: $1"

# Step 4: Review with Opus
echo "Step 4: Review..."
cursor chat --model opus "Review implementation of: $1"

echo "✅ Multi-agent workflow complete!"
```

Usage:
```bash
.cursor/workflows/implement-feature.sh "Telnyx number billing"
```

## Summary

### Your Current Setup

✅ **Models Available:**
- Claude Opus 4.6 (current)
- Claude Sonnet 4.5
- Claude Haiku
- GPT-4 Turbo

✅ **Agent Modes:**
- Chat (Cmd+L)
- Agent (Cmd+I)
- Composer (Cmd+Shift+I)
- Inline Edit (Cmd+K)

✅ **Context Systems:**
- Cursor Rules (6 `.mdc` files)
- MCP (Supabase integration)
- Abacus AI Agent extension

✅ **Multi-Agent Patterns:**
- Sequential (Planning → Implementation → Review)
- Parallel (Multiple agents on different tasks)
- Iterative (Refinement loops)

### Recommendations

1. **Use Sonnet as default** - Best balance of capability and cost
2. **Reserve Opus for complex tasks** - Architecture, debugging, reviews
3. **Create more cursor rules** - Add billing-system.mdc, error-handling.mdc
4. **Set up MCP for Telnyx** - Add Telnyx API context
5. **Document workflows** - Create scripts for common multi-step tasks

### Next Steps

1. ✅ **Immediate** - Switch default model to Sonnet 4.5
2. ✅ **Short-term** - Create billing-system.mdc cursor rule
3. ⏳ **Medium-term** - Set up Telnyx MCP server
4. ⏳ **Long-term** - Create custom workflow scripts

## Questions?

- **How do I change models?** - Click model dropdown in any AI interface
- **Can I use multiple models at once?** - Yes, open multiple Cursor windows/tabs
- **Do cursor rules apply to all models?** - Yes, automatically
- **Is there a true multi-agent framework?** - Not built-in, but you can orchestrate with scripts
- **Which model should I use?** - Sonnet for most tasks, Opus for complex ones

For more information:
- Cursor Docs: https://docs.cursor.com
- Cursor Rules: https://cursor.directory
- MCP Protocol: https://modelcontextprotocol.io
