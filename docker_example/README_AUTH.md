# Langflow Authentication Setup

This setup configures Langflow to use its native authentication system without auto-login.

## Configuration

The setup uses the following environment variables in the `.env` file:

```bash
# Disable auto-login
LANGFLOW_AUTO_LOGIN=false

# Superuser credentials (for initial admin access)
LANGFLOW_SUPERUSER=admin
LANGFLOW_SUPERUSER_PASSWORD=adminpassword

# New users are active by default
LANGFLOW_NEW_USER_IS_ACTIVE=true

# Disable superuser CLI access
LANGFLOW_ENABLE_SUPERUSER_CLI=false

# Database configuration
LANGFLOW_DATABASE_URL=postgresql://langflow:langflow@postgres:5432/langflow

# Security (change in production)
LANGFLOW_SECRET_KEY=your-super-secret-key-change-this-in-production
```

## How It Works

1. **No Auto-Login**: Users must explicitly sign up and log in
2. **Native Authentication**: Uses Langflow's built-in JWT token system
3. **User Isolation**: Each user gets their own workspace automatically
4. **Standard APIs**: All Langflow APIs work as expected

## Getting Started

1. **Start the services**:
   ```bash
   docker-compose up -d
   ```

2. **Access Langflow**:
   Open your browser to `http://localhost:7860`

3. **Sign Up**:
   Click the "Sign Up" button to create a new account

4. **Log In**:
   Use your credentials to log in

## Testing the Setup

Run the test script to verify the configuration:
```bash
python test_auth_setup.py
```

## Authentication Flow

1. **Initial Access**: Visit `http://localhost:7860`
2. **Sign Up**: Create a new account (click "Sign Up")
3. **Log In**: Enter your credentials
4. **Use Langflow**: Access your isolated workspace

## API Authentication

For programmatic access, use standard authentication:

### Sign Up
```bash
curl -X POST http://localhost:7860/api/v1/users/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpassword"}'
```

### Log In
```bash
curl -X POST http://localhost:7860/api/v1/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=testuser&password=testpassword'
```

This returns JWT tokens for authenticated requests.

### Authenticated Requests
```bash
curl -X GET http://localhost:7860/api/v1/flows \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Security Notes

- Change the `LANGFLOW_SECRET_KEY` in production
- Use strong passwords for all accounts
- Consider setting up HTTPS for production deployments
- Review CORS settings for production use

## Troubleshooting

### Cannot Access Langflow
- Check if containers are running: `docker-compose ps`
- Check logs: `docker-compose logs langflow`
- Verify port 7860 is available

### Authentication Issues
- Ensure `LANGFLOW_AUTO_LOGIN=false`
- Verify database connectivity
- Check that the superuser account was created

### Database Issues
- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify database initialization