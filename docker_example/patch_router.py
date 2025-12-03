#!/usr/bin/env python3
"""Patch router.py to add tenant_login_router and ai_workflows_router support."""

import sys
import os

router_path = "/app/.venv/lib/python3.12/site-packages/langflow/api/router.py"

print(f"Checking if {router_path} exists...")
if not os.path.exists(router_path):
    print(f"ERROR: {router_path} not found!")
    sys.exit(1)

print(f"Reading {router_path}...")
with open(router_path, 'r') as f:
    content = f.read()

print(f"File size: {len(content)} bytes")

# Check if already patched
if 'tenant_login_router' in content and 'ai_workflows_router' in content:
    print("Router already patched with tenant_login_router and ai_workflows_router")
    sys.exit(0)

# Find and replace the import section
import_start = content.find("from langflow.api.v1 import (")
if import_start == -1:
    print("ERROR: Could not find import section")
    sys.exit(1)

import_end = content.find(")", import_start)
if import_end == -1:
    print("ERROR: Could not find end of import section")
    sys.exit(1)

# Extract the import block
import_block = content[import_start:import_end+1]
print(f"Found import block: {import_block}")

# Add tenant_login_router if not present
if "tenant_login_router" not in import_block:
    # Find the position to insert tenant_login_router (after store_router)
    store_pos = import_block.find("store_router,")
    if store_pos != -1:
        insert_pos = store_pos + len("store_router,")
        new_import_block = import_block[:insert_pos] + "\n    tenant_login_router," + import_block[insert_pos:]
        import_block = new_import_block
        print("Added tenant_login_router to import block")

# Add ai_workflows_router if not present
if "ai_workflows_router" not in import_block:
    # Find the position to insert ai_workflows_router (after tenant_login_router or store_router)
    tenant_pos = import_block.find("tenant_login_router,")
    store_pos = import_block.find("store_router,")
    
    if tenant_pos != -1:
        # Insert after tenant_login_router
        insert_pos = tenant_pos + len("tenant_login_router,")
        new_import_block = import_block[:insert_pos] + "\n    ai_workflows_router," + import_block[insert_pos:]
    elif store_pos != -1:
        # Insert after store_router if tenant_login_router wasn't found
        insert_pos = store_pos + len("store_router,")
        new_import_block = import_block[:insert_pos] + "\n    tenant_login_router,\n    ai_workflows_router," + import_block[insert_pos:]
    else:
        print("ERROR: Could not find appropriate position to insert routers")
        sys.exit(1)
    
    import_block = new_import_block
    print("Added ai_workflows_router to import block")

# Replace the import block in the content
content = content[:import_start] + import_block + content[import_end+1:]

# Add router registrations
router_registration_section = "router_v1.include_router(login_router)"

if router_registration_section in content:
    print("Adding router registrations...")
    # Add tenant_login_router registration
    if "router_v1.include_router(tenant_login_router)" not in content:
        content = content.replace(
            router_registration_section,
            router_registration_section + "\nrouter_v1.include_router(tenant_login_router)"
        )
        print("Added tenant_login_router registration")
    
    # Add ai_workflows_router registration
    if "router_v1.include_router(ai_workflows_router)" not in content:
        content = content.replace(
            "router_v1.include_router(tenant_login_router)",
            "router_v1.include_router(tenant_login_router)\nrouter_v1.include_router(ai_workflows_router)"
        )
        print("Added ai_workflows_router registration")
else:
    print("ERROR: Could not find router registration section")
    sys.exit(1)

print(f"Writing patched router back to {router_path}...")
with open(router_path, 'w') as f:
    f.write(content)

print("Successfully patched router.py with tenant_login_router and ai_workflows_router")