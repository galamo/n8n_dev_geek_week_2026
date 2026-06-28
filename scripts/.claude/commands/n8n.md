# n8n Workflow Assistant

Use the `mcp__n8n__*` tools (from the n8n MCP server configured in `.claude/settings.json`) to fulfill this request.

The n8n MCP server connects to the user's cloud instance at `https://galamo.app.n8n.cloud`.

Steps:
1. First call the appropriate MCP tool(s) to fetch the relevant n8n data (workflows, executions, credentials, etc.)
2. Present the results clearly to the user
3. If the user wants to create or modify a workflow, use the MCP tools to do so

$ARGUMENTS
