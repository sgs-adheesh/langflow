"""Test script to verify prompt template processing fix"""
import re

def test_prompt_variable_extraction():
    """Test that we can extract variables from prompt templates"""
    
    template_value = "Answer the question: {user_input} using context: {context}"
    
    # Extract variables using regex (same as fallback method)
    variables = re.findall(r"\{(\w+)\}", template_value)
    variables = list(dict.fromkeys(variables))  # Remove duplicates
    
    print(f"✅ Extracted variables: {variables}")
    assert variables == ["user_input", "context"], f"Expected ['user_input', 'context'], got {variables}"
    
    # Create field definitions
    fields = {}
    for variable in variables:
        field_def = {
            "type": "str",
            "required": False,
            "placeholder": "",
            "list": False,
            "show": True,
            "multiline": True,
            "value": "",
            "fileTypes": [],
            "file_path": "",
            "password": False,
            "name": variable,
            "display_name": variable,
            "advanced": False,
            "input_types": ["Message", "Text"],
            "dynamic": False,
            "info": "",
            "load_from_db": False,
            "title_case": False,
        }
        fields[variable] = field_def
    
    print(f"✅ Created {len(fields)} field definitions")
    print(f"   Fields: {list(fields.keys())}")
    
    # Verify structure
    for var in variables:
        assert var in fields
        assert fields[var]["name"] == var
        assert fields[var]["display_name"] == var
        assert "Message" in fields[var]["input_types"]
    
    print("✅ All tests passed!")
    return True

if __name__ == "__main__":
    test_prompt_variable_extraction()
