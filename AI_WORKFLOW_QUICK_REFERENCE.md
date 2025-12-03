# AI Workflow Component Matching Quick Reference

## How Component Matching Works

The AI workflow processor uses a 3-tier matching strategy to find the right component template:

### Tier 1: Exact Match (Highest Priority)
```python
AI says: "ChatInput"
System finds: input_output.ChatInput ✓
```

### Tier 2: Name Mapping
```python
AI says: "LLM" or "Model"
Mapping says: → "OpenAI"
System finds: openai.OpenAI ✓
```

### Tier 3: Fuzzy Match (Display Name)
```python
AI says: "chat input" or "Chat Input" or "CHATINPUT"
System compares (lowercase, no spaces): "chatinput"
Finds: display_name="Chat Input" → "chatinput" ✓
```

## Common AI Component Names → Actual Names

| AI Says | System Uses | Category |
|---------|-------------|----------|
| `ChatInput` | `Chat Input` | input_output |
| `ChatOutput` | `Chat Output` | input_output |
| `TextInput` | `Text Input` | input_output |
| `TextOutput` | `Text Output` | input_output |
| `OpenAIModel` | `OpenAIModel` | openai |
| `LLM` | `OpenAI` | openai |
| `Model` | `OpenAI` | openai |
| `PromptTemplate` | `Prompt` | prompts |
| `Prompt` | `Prompt` | prompts |

## Component Template Structure

### Full Template Example (Chat Input)
```json
{
  "template": {
    "input_value": {
      "type": "str",
      "input_types": [],
      "value": "",
      "display_name": "Text"
    },
    "sender": {
      "type": "str",
      "value": "User",
      "options": ["User", "Machine"]
    }
  },
  "description": "Chat input component",
  "display_name": "Chat Input",
  "base_classes": ["Message"],
  "outputs": [
    {
      "types": ["Message"],
      "selected": "Message",
      "name": "message",
      "display_name": "Chat Message",
      "method": "message_response"
    }
  ]
}
```

### What Gets Used Where

**For Node Creation**:
- ✅ `template` → Full field definitions
- ✅ `display_name` → Node label
- ✅ `description` → Node description
- ✅ `base_classes` → Fallback output types
- ✅ `outputs` → Output handle definitions

**For Source Handle** (Node Output):
```python
{
  "id": "node-uuid",
  "name": "message",              # From outputs[0].name
  "output_types": ["Message"],     # From outputs[0].types
  "dataType": "Chat Input"         # From node type
}
```

**For Target Handle** (Node Input):
```python
{
  "id": "node-uuid",
  "fieldName": "input_value",      # From template field name
  "type": "str",                   # From template field.type
  "inputTypes": ["Message"]        # From template field.input_types
}
```

## Type Compatibility Rules

### Universal Types
- `Message` → Compatible with everything
- Empty `input_types` → Accepts anything
- Empty `output_types` → Sends to anything

### Compatibility Matrix

| Source Output | Target Input | Compatible? |
|---------------|--------------|-------------|
| `Message` | `Message` | ✅ Yes |
| `Message` | `Data` | ✅ Yes (Message is universal) |
| `Data` | `Message` | ✅ Yes (Message is universal) |
| `Data` | `Data` | ✅ Yes |
| `DataFrame` | `Data` | ❌ No (but still connected with warning) |
| `Embeddings` | `Message` | ✅ Yes (Message is universal) |

### Type Validation Logic
```python
def _are_types_compatible(source_types, target_types):
    # 1. Empty = permissive
    if not source_types or not target_types:
        return True
    
    # 2. Message = universal
    if "Message" in source_types or "Message" in target_types:
        return True
    
    # 3. Check overlap (case-insensitive)
    return any(s.lower() in [t.lower() for t in target_types] 
               for s in source_types)
```

## Edge Creation Flow

```
1. AI provides connection:
   {"from_component": "input-1", "to_component": "model-1"}

2. Map component IDs to node IDs:
   "input-1" → "uuid-abc123"
   "model-1" → "uuid-def456"

3. Get source node and create handle:
   Node: Chat Input
   Output: {"types": ["Message"], "name": "message"}
   Handle: {id, name: "message", output_types: ["Message"]}

4. Get target node and create handle:
   Node: OpenAI
   Template field: "input_value": {"input_types": ["Message"]}
   Handle: {id, fieldName: "input_value", inputTypes: ["Message"]}

5. Validate types:
   Source: ["Message"] ∩ Target: ["Message"] = ✅ Compatible

6. Create edge:
   {
     id: "reactflow__edge-{source_id}{source_handle}-{target_id}{target_handle}",
     source: "uuid-abc123",
     target: "uuid-def456",
     sourceHandle: "œidœ:œuuid-abc123œ,œnameœ:œmessageœ,...",
     targetHandle: "œidœ:œuuid-def456œ,œfieldNameœ:œinput_valueœ,...",
     data: {sourceHandle: {...}, targetHandle: {...}}
   }
```

## Handle Serialization

### Custom Stringify
```python
# Object:
{"id": "abc", "name": "message"}

# JSON:
"{"id":"abc","name":"message"}"

# Escaped (œ replaces "):
"œidœ:œabcœ,œnameœ:œmessageœ"
```

This matches the frontend's `customStringify` function exactly.

## Debugging Tips

### Enable Detailed Logging
The processor logs:
- ✅ Component matching attempts
- ✅ Node creation with template name
- ✅ Connection mapping
- ⚠️ Type mismatches
- ❌ Component not found errors

### Check Component Template Loading
```python
component_templates = await get_and_cache_all_types_dict(settings_service)
# Returns: {"category": {"ComponentName": {...}}}
```

### Verify Node Structure
```python
node = {
  "id": "uuid",
  "data": {
    "type": "Chat Input",  # Actual component name
    "node": {
      "template": {...},    # Full template
      "outputs": [...]      # Output definitions
    }
  }
}
```

### Check Edge Handles
```python
source_handle = {
  "data": {
    "output_types": ["Message"]  # From component.outputs[].types
  },
  "serialized": "œ...œ"
}

target_handle = {
  "data": {
    "inputTypes": ["Message"]    # From template.field.input_types
  },
  "serialized": "œ...œ"
}
```

## Testing Scenarios

### ✅ Should Work
1. Standard workflow: `ChatInput → OpenAI → ChatOutput`
2. AI name variations: `"Chat Input"`, `"ChatInput"`, `"chat input"`
3. Common aliases: `"LLM"` → `"OpenAI"`, `"Model"` → `"OpenAI"`
4. Multiple outputs: AI specifies which output to use via `from_handle`

### ⚠️ Should Warn
1. Type mismatch: `FileLoader(Data) → ChatOutput(Message)`
   - Still creates connection
   - Logs warning about type incompatibility

### ❌ Should Skip
1. Self-connection: `component-1 → component-1`
2. Missing component: `component-1 → component-999` (999 doesn't exist)
3. Invalid component types not in registry

## Performance Notes

- Component templates loaded **once** per request
- Cached by `get_and_cache_all_types_dict`
- Fuzzy matching iterates all components (worst case: O(n))
- Edge creation: O(n) where n = number of connections

## Summary Checklist

When creating AI workflows:
- ✅ Component templates are loaded from `/api/v1/all`
- ✅ AI component names are intelligently matched
- ✅ Nodes get full template structure
- ✅ Handles use actual output/input types
- ✅ Type compatibility is validated
- ✅ Detailed logging for debugging
- ✅ Graceful fallbacks for edge cases
