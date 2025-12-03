FROM langflowai/langflow:latest

# Copy AI workflow backend files with lazy imports
COPY langflow/agentic/utils/ai_workflow_processor.py /app/.venv/lib/python3.12/site-packages/langflow/agentic/utils/
COPY langflow/api/router.py /app/.venv/lib/python3.12/site-packages/langflow/api/
COPY langflow/api/v1/__init__.py /app/.venv/lib/python3.12/site-packages/langflow/api/v1/
COPY langflow/api/v1/ai_workflows.py /app/.venv/lib/python3.12/site-packages/langflow/api/v1/
COPY langflow/api/v1/ai_workflow_schemas.py /app/.venv/lib/python3.12/site-packages/langflow/api/v1/
COPY langflow/api/v1/ai_workflow_edit.py /app/.venv/lib/python3.12/site-packages/langflow/api/v1/

# Copy frontend build with your UI changes
COPY frontend_build/ /app/frontend/

CMD ["python", "-m", "langflow", "run", "--host", "0.0.0.0", "--port", "7860"]
