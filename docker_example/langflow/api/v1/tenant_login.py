"""
Tenant-based login endpoint for multi-tenant applications.

This allows your main application to authenticate users and pass their session
to Langflow without requiring users to log in again to Langflow.

Usage:
  Your Main App calls: POST /api/v1/tenant-login
  {
    "tenant_id": "tenant-123",
    "user_id": "user-456",
    "session_token": "xyz123token",
    "username": "john_doe"  # Optional: used for user creation
  }

  Response: Langflow JWT tokens (same as /login)
  Headers: Set-Cookie with access_token_lf and refresh_token_lf
"""

from __future__ import annotations

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

from langflow.api.utils import DbSession
from langflow.api.v1.schemas import Token
from langflow.services.auth.utils import (
    create_user_tokens,
    get_password_hash,
)
from langflow.services.database.models.user.crud import get_user_by_id, get_user_by_username
from langflow.services.database.models.user.model import User
from langflow.services.deps import get_settings_service, get_variable_service

router = APIRouter(tags=["Tenant Login"])


class TenantLoginRequest(BaseModel):
    """Request body for tenant-based login."""

    tenant_id: str  # Your application's tenant ID
    user_id: str  # Your application's user ID (e.g., UUID or any string)
    session_token: str  # Token from your main app (validate this server-side)
    username: str | None = None  # Optional: Langflow username (defaults to user_id)


class TenantLoginResponse(Token):
    """Response with Langflow JWT tokens."""

    user_id: str  # Your application's user ID
    tenant_id: str  # Your application's tenant ID


@router.post("/tenant/login", response_model=TenantLoginResponse)
async def tenant_login(
    request: TenantLoginRequest,
    response: Response,
    db: DbSession,
) -> TenantLoginResponse:
    """
    Multi-tenant login endpoint for embedded Langflow.

    This endpoint allows your main application to provide tenant context
    and receive Langflow JWT tokens without users needing to log in again.

    Args:
        request: Contains tenant_id, user_id, session_token from your app
        response: FastAPI Response object to set cookies
        db: Database session

    Returns:
        Langflow JWT tokens with tenant context

    Security:
        1. Validate session_token against your main app's session store
        2. Verify tenant_id matches the authenticated user's tenant
        3. Store tenant context in request state for API endpoints
    """

    auth_settings = get_settings_service().auth_settings

    # IMPORTANT: You must validate the session_token from your main app
    # This is a stub - implement YOUR validation logic here
    is_valid_session = await validate_tenant_session(
        tenant_id=request.tenant_id,
        user_id=request.user_id,
        session_token=request.session_token,
    )

    if not is_valid_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid tenant session token",
        )

    # Use username if provided, otherwise use tenant_id as prefix
    langflow_username = request.username or f"tenant_{request.tenant_id}_{request.user_id}"

    # Get or create Langflow user
    langflow_user = await get_or_create_tenant_user(
        username=langflow_username,
        db=db,
        tenant_id=request.tenant_id,
        external_user_id=request.user_id,
    )

    # Create JWT tokens for Langflow
    tokens = await create_user_tokens(user_id=langflow_user.id, db=db, update_last_login=True)

    # Set JWT cookies (same as standard login)
    response.set_cookie(
        "refresh_token_lf",
        tokens["refresh_token"],
        httponly=auth_settings.REFRESH_HTTPONLY,
        samesite=auth_settings.REFRESH_SAME_SITE,
        secure=auth_settings.REFRESH_SECURE,
        expires=auth_settings.REFRESH_TOKEN_EXPIRE_SECONDS,
        domain=auth_settings.COOKIE_DOMAIN,
    )
    response.set_cookie(
        "access_token_lf",
        tokens["access_token"],
        httponly=auth_settings.ACCESS_HTTPONLY,
        samesite=auth_settings.ACCESS_SAME_SITE,
        secure=auth_settings.ACCESS_SECURE,
        expires=auth_settings.ACCESS_TOKEN_EXPIRE_SECONDS,
        domain=auth_settings.COOKIE_DOMAIN,
    )
    response.set_cookie(
        "apikey_tkn_lflw",
        str(langflow_user.store_api_key) if langflow_user.store_api_key else "",
        httponly=auth_settings.ACCESS_HTTPONLY,
        samesite=auth_settings.ACCESS_SAME_SITE,
        secure=auth_settings.ACCESS_SECURE,
        expires=None,
        domain=auth_settings.COOKIE_DOMAIN,
    )

    # Initialize user workspace
    await get_variable_service().initialize_user_variables(langflow_user.id, db)

    return TenantLoginResponse(
        **tokens,
        user_id=request.user_id,
        tenant_id=request.tenant_id,
    )


async def validate_tenant_session(
    tenant_id: str,
    user_id: str,
    session_token: str,
) -> bool:
    """
    Validate the session token from your main application.

    IMPLEMENT THIS WITH YOUR OWN LOGIC!

    This stub function should:
    1. Call your main app's session validation API
    2. Verify the session_token is valid
    3. Verify it belongs to the given tenant_id and user_id
    4. Check if the session is not expired

    Args:
        tenant_id: Your app's tenant ID
        user_id: Your app's user ID
        session_token: Token from your app's login

    Returns:
        True if valid, False otherwise
    """

    # TODO: Replace this with your actual validation logic
    # Example implementation:
    #
    # try:
    #     response = httpx.post(
    #         "https://your-app.com/api/validate-session",
    #         json={
    #             "tenant_id": tenant_id,
    #             "user_id": user_id,
    #             "session_token": session_token,
    #         },
    #         timeout=5.0,
    #     )
    #     return response.status_code == 200
    # except Exception:
    #     return False

    # For now, accept any session token (development only!)
    # Remove this in production!
    return bool(session_token)


async def get_or_create_tenant_user(
    username: str,
    db: DbSession,
    tenant_id: str,
    external_user_id: str,
) -> User:
    """
    Get or create a Langflow user from tenant context.

    Each tenant/user combination gets a unique Langflow user account.
    This allows data isolation per tenant.

    Args:
        username: Langflow username to use/create
        db: Database session
        tenant_id: Your application's tenant ID
        external_user_id: Your application's user ID

    Returns:
        Langflow User object
    """

    # Try to find existing user by username
    user = await get_user_by_username(db, username)

    if user:
        return user

    # Create new Langflow user for this tenant+user combination
    new_user = User(
        id=uuid4(),
        username=username,
        password=get_password_hash(external_user_id),  # Hash external user ID as placeholder
        is_active=True,
        is_superuser=False,
        # Store tenant context for later filtering
        # You might want to add tenant_id to User model for better data isolation
    )

    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
    except Exception as e:
        await db.rollback()
        # User might have been created by another worker, try to fetch again
        user = await get_user_by_username(db, username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create user: {str(e)}",
            ) from e
        return user

    return new_user
