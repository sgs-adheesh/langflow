import json

def custom_stringify(obj):
    """Custom JSON stringify that matches frontend implementation."""
    # Handle None/undefined values
    if obj is None:
        return "null"
        
    # Handle non-object types using json.dumps like frontend
    if not isinstance(obj, (dict, list)):
        if isinstance(obj, bool):
            return "true" if obj else "false"
        # Use json.dumps for all other types to match frontend behavior exactly
        return json.dumps(obj)
        
    # Handle arrays
    if isinstance(obj, list):
        array_items = [custom_stringify(item) for item in obj]
        return f"[{','.join(array_items)}]"
        
    # Handle objects (dictionaries) - sort keys like frontend
    keys = sorted(obj.keys())
    key_value_pairs = []
    for key in keys:
        # Use json.dumps to properly escape the key like frontend does
        key_str = json.dumps(str(key))
        value_str = custom_stringify(obj[key])
        key_value_pairs.append(f"{key_str}:{value_str}")
    return "{" + ",".join(key_value_pairs) + "}"

def scaped_json_stringify(obj):
    """Serialize JSON object with 'œ' replacing quotes to match frontend."""
    json_str = custom_stringify(obj)
    return json_str.replace('"', 'œ')

# Test with a sample handle object
test_handle = {
    "dataType": "OpenAIModel",
    "id": "node-1",
    "name": "output",
    "output_types": ["Message"]
}

print("Original object:", test_handle)
print("Custom stringify:", custom_stringify(test_handle))
print("Scaped stringify:", scaped_json_stringify(test_handle))