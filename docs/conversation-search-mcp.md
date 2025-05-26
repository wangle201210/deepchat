# Conversation History Search MCP Server

## Overview

`deepchat-inmemory/conversation-search-server` is a built-in MCP server for searching and analyzing DeepChat's historical conversation records. It provides powerful search functionality that can find keywords in conversation titles and message contents, and also provides conversation statistics.

## Features

### 1. Conversation Search (`search_conversations`)
- Search conversation titles and message contents
- Support pagination queries
- Return matched conversation lists with search snippets
- Automatic merging and deduplication of results

### 2. Message Search (`search_messages`)
- Search keywords in message contents
- Support filtering by conversation ID
- Support filtering by message role (user/assistant/system/function)
- Return matched messages with their context information

### 3. Conversation History Retrieval (`get_conversation_history`)
- Get complete history of a specific conversation
- Optional inclusion of system messages
- Return conversation information and all message lists

### 4. Statistics Information (`get_conversation_stats`)
- Get conversation statistics for a specified time period
- Count total conversations and messages
- Statistics by message role distribution
- Display most active conversation lists

## Tool Details

### search_conversations
Search historical conversation records, supports title and content search

**Parameters:**
- `query` (string): Search keyword to search in conversation titles and message contents
- `limit` (number, optional): Result limit (1-50, default 10)
- `offset` (number, optional): Pagination offset (default 0)

**Return Example:**
```json
{
  "conversations": [
    {
      "id": "conv_123",
      "title": "Python Programming Questions",
      "createdAt": 1698765432000,
      "updatedAt": 1698765500000,
      "messageCount": 15,
      "snippet": "Title match: Python Programming Questions"
    }
  ],
  "total": 1
}
```

### search_messages
Search historical message records, supports filtering by conversation ID, role and other conditions

**Parameters:**
- `query` (string): Search keyword to search in message contents
- `conversationId` (string, optional): Optional conversation ID to limit search within specific conversation
- `role` (string, optional): Optional message role filter (user/assistant/system/function)
- `limit` (number, optional): Result limit (1-100, default 20)
- `offset` (number, optional): Pagination offset (default 0)

**Return Example:**
```json
{
  "messages": [
    {
      "id": "msg_456",
      "conversationId": "conv_123",
      "conversationTitle": "Python Programming Questions",
      "role": "user",
      "content": "How to use Python to process JSON data?",
      "createdAt": 1698765450000,
      "snippet": "How to use **Python** to process JSON data?"
    }
  ],
  "total": 1
}
```

### get_conversation_history
Get complete history of a specific conversation

**Parameters:**
- `conversationId` (string): Conversation ID
- `includeSystem` (boolean, optional): Whether to include system messages (default false)

**Return Example:**
```json
{
  "conversation": {
    "id": "conv_123",
    "title": "Python Programming Questions",
    "createdAt": 1698765432000,
    "updatedAt": 1698765500000,
    "settings": { ... }
  },
  "messages": [
    {
      "id": "msg_456",
      "role": "user",
      "content": "How to use Python to process JSON data?",
      "createdAt": 1698765450000,
      "tokenCount": 12,
      "status": "sent"
    }
  ]
}
```

### get_conversation_stats
Get conversation statistics including totals, recent activity and more

**Parameters:**
- `days` (number, optional): Statistics period in days (default 30 days)

**Return Example:**
```json
{
  "period": "30 days",
  "total": {
    "conversations": 150,
    "messages": 2500
  },
  "recent": {
    "conversations": 25,
    "messages": 380
  },
  "messagesByRole": {
    "user": 190,
    "assistant": 185,
    "system": 5
  },
  "activeConversations": [
    {
      "id": "conv_123",
      "title": "Python Programming Questions",
      "messageCount": 15,
      "lastActivity": "2023-10-31T10:30:00.000Z"
    }
  ]
}
```

## Use Cases

1. **Quick Find Historical Conversations**: Search for relevant conversation records through keywords
2. **Content Review**: Find discussion content for specific topics or technical issues
3. **Data Analysis**: Understand conversation activity statistics and usage patterns
4. **Conversation Management**: Get complete conversation history for backup or analysis

## Search Features

- **Smart Snippet Generation**: Automatically generate search snippets containing keywords, with keywords highlighted using `**` surrounding
- **Result Deduplication**: Automatically merge title matches and content matches to avoid duplicates
- **Pagination Support**: Support pagination queries for large result sets
- **Role Filtering**: Can search only specific role messages (e.g., only user input or assistant replies)
- **Time Range**: Statistics function supports custom time ranges

## Permission Configuration

This server is configured to auto-approve all tool calls (`autoApprove: ['all']`) because it only performs read-only operations and does not modify any data.

## Technical Implementation

- Uses SQLite database for efficient full-text search
- Fuzzy matching based on LIKE operators
- Supports JOIN queries to associate conversation and message tables
- Automatic handling of database connections and error recovery 