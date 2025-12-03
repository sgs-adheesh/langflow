# Prompt Node Input Ports Fix - AI Workflow Creation

## Problem Summary

**Issue:** When using "Create Flow using AI", Prompt nodes don't show input ports for template variables (like `{user_input}`, `{context}`), preventing connections from Chat Input or Text Input components.

**Scope:** Only affects AI-generated workflows, NOT manual workflow creation.

## Root Cause

The AI workflow processor was attempting to auto-process prompt templates to create dynamic input fields, but:

1. **Silent Failures**: Errors were being silently swallowed by `asyncio.create_task()` in non-async context
2. **Import Issues**: The `lfx` module might not be available in all deployment environments
3. **No Fallback**: If the primary method failed, there was no backup mechanism

## Solution Implemented

### Changes Made to `ai_workflow_processor.py`

**File**: `src/backend/base/langflow/agentic/utils/ai_workflow_processor.py`

#### 1. Improved Error Logging
- Replaced silent `asyncio.create_task(logger.awarning(...))` with proper synchronous logging
- Added `logger.error()` with full exception tracing
- Added info-level logging for successful processing

#### 2. Import Error Handling  
- Wrapped the `process_prompt_template` import in a try-except
- Catches `ImportError` and falls back to manual processing
- Logs which method is being used

#### 3. Standalone Fallback Method
Created `_process_prompt_template_fallback()` that:
- Uses only Python standard library (regex)
- Manually extracts variables from template strings using `re.findall(r"\{(\w+)\}", template_value)`
- Creates field definitions without requiring lfx imports
- Matches the structure of `DefaultPromptField`

#### 4. Double-Fallback Safety
- If primary processing fails completely, tries fallback in outer exception handler
- Ensures prompt variables are ALWAYS processed, even if imports fail

### Key Features of the Fix

```python
# Primary Method (tries official API)
try:
    from lfx.base.prompts.api_utils import process_prompt_template
    input_variables = process_prompt_template(...)
    logger.info(f"Successfully processed with variables: {input_variables}")
except ImportError:
    # Fallback to manual extraction
    logger.warning("Using fallback method")
    self._process_prompt_template_fallback(component_data, template_value)
```

```python
# Standalone Fallback (no external dependencies)
def _process_prompt_template_fallback(self, component_data, template_value):
    import re
    variables = re.findall(r"\{(\w+)\}", template_value)
    # Creates field definitions manually
    for variable in variables:
        field_def = {
            "type": "str",
            "name": variable,
            "display_name": variable,
            "input_types": ["Message", "Text"],
            # ... other required fields
        }
        component_data["template"][variable] = field_def
```

## Testing the Fix

### Automated Test
Run the test script:
```bash
python test_prompt_fix.py
```

Expected output:
```
✅ Extracted variables: ['user_input', 'context']
✅ Created 2 field definitions
   Fields: ['user_input', 'context']
✅ All tests passed!
```

### Manual Testing

1. **Start Langflow** (restart if already running to load changes)

2. **Create AI Workflow** with a prompt:
   - Click "Create using AI" button
   - Enter: "Create a workflow with Chat Input, Prompt template that asks {user_input}, and OpenAI model"
   - The AI should generate a workflow

3. **Verify the created flow**:
   - Check that the Prompt node has visible input ports
   - You should see:
     - A port for `user_input` on the left side of the Prompt node
     - You can connect Chat Input → Prompt (`user_input` port)
     - You can connect Prompt → OpenAI Model

4. **Check the logs** for:
   ```
   INFO: Processing prompt template with value: Ask {user_input}...
   INFO: Successfully processed prompt template with variables: ['user_input']
   ```
   OR (if fallback is used):
   ```
   WARNING: Could not import process_prompt_template: ... Using fallback.
   INFO: Fallback: Extracted variables: ['user_input']
   INFO: Fallback: Created 1 input fields for prompt template
   ```

## Verification Checklist

- [ ] Prompt nodes created by AI show input ports for variables
- [ ] Can connect Chat Input to Prompt variable ports
- [ ] Can connect Text Input to Prompt variable ports
- [ ] No errors in backend logs about prompt processing
- [ ] Manual workflow creation still works (unchanged)
- [ ] Existing flows load without issues (backwards compatible)

## Debugging

If issues persist:

1. **Check Backend Logs**:
   ```bash
   # Look for these patterns:
   grep "Processing prompt template" logs/langflow.log
   grep "Fallback: Extracted variables" logs/langflow.log
   grep "Failed to auto-process" logs/langflow.log
   ```

2. **Verify Template Value**:
   - Ensure AI is providing templates with variables in `{variable}` format
   - Check the AI's JSON response includes `"parameters": {"template": "..."}`

3. **Test Fallback Directly**:
   ```python
   import re
   template = "Answer {question} using {context}"
   variables = re.findall(r"\{(\w+)\}", template)
   print(variables)  # Should print: ['question', 'context']
   ```

## Benefits

✅ **Robust**: Works even if lfx imports fail  
✅ **Debuggable**: Proper error logging shows exactly what's happening  
✅ **Backwards Compatible**: Doesn't affect existing workflows  
✅ **Self-Healing**: Falls back automatically if primary method fails  
✅ **Standards Compliant**: Uses standard Python regex, no exotic dependencies

## Related Files

- **Main Fix**: `src/backend/base/langflow/agentic/utils/ai_workflow_processor.py`
- **Test Script**: `test_prompt_fix.py`
- **Documentation**: This file

## Next Steps

1. Restart Langflow backend to load changes
2. Test AI workflow creation with prompts
3. Verify input ports are visible
4. Check logs for proper processing messages

## Rollback

If needed, the changes can be easily reverted as they're self-contained in the `_process_prompt_template_node()` and `_process_prompt_template_fallback()` methods. The old behavior can be restored by reverting the file to the previous version.
