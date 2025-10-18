# Deployment Instructions for Vdata App

## Deploy to Render.com

### Method 1: Deploy via GitHub (Recommended)

1. **Create a new GitHub repository**
   ```bash
   # Initialize git in the project directory
   cd /home/ubuntu/vdata-app
   git init
   git add .
   git commit -m "Initial commit: Minimal Vdata App"
   git branch -M main
   ```

2. **Create repository on GitHub**
   - Go to https://github.com/new
   - Repository name: `vdata-app`
   - Make it Public or Private (your choice)
   - Do NOT initialize with README (we already have one)
   - Click "Create repository"

3. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/vdata-app.git
   git push -u origin main
   ```

4. **Deploy on Render**
   - Go to https://render.com/dashboard
   - Click "New +" → "Web Service"
   - Click "Connect GitHub" (if not already connected)
   - Select your `vdata-app` repository
   - Configure the service:
     - **Name**: `vdata-app`
     - **Region**: Choose closest to you
     - **Branch**: `main`
     - **Runtime**: `Node`
     - **Build Command**: 
       ```
       cd web && npm install && npm run build && cd ../server && npm install && npm run build
       ```
     - **Start Command**: 
       ```
       cd server && node dist/index.js
       ```
     - **Plan**: **Free**
   - Click "Create Web Service"

5. **Wait for deployment**
   - Render will install dependencies and build your app
   - This takes about 2-3 minutes
   - Once deployed, you'll get a URL like: `https://vdata-app.onrender.com`

### Method 2: Deploy via Render Blueprint

1. Push your code to GitHub (steps 1-3 above)

2. In Render dashboard:
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will automatically detect `render.yaml`
   - Click "Apply"

### Method 3: Manual Deploy (No GitHub)

1. Install Render CLI:
   ```bash
   npm install -g render-cli
   ```

2. Login to Render:
   ```bash
   render login
   ```

3. Deploy:
   ```bash
   cd /home/ubuntu/vdata-app
   render deploy
   ```

## After Deployment

### 1. Test the Deployment

Once deployed, test your endpoints:

```bash
# Health check
curl https://vdata-app.onrender.com/health

# Server info
curl https://vdata-app.onrender.com/

# MCP endpoint (should return MCP protocol response)
curl https://vdata-app.onrender.com/mcp
```

### 2. Connect to ChatGPT

1. Open ChatGPT
2. Go to **Settings** → **Connectors**
3. Enable **Developer Mode** (if not already enabled)
4. Click **"Add Connector"**
5. Enter your MCP endpoint:
   ```
   https://vdata-app.onrender.com/mcp
   ```
6. Click **"Add"**

### 3. Test in ChatGPT

Once the connector is added, try these prompts:
- "Show me the Vdata app"
- "Display Vdata app"
- "Show Vdata app with message: Testing from ChatGPT"

You should see the purple gradient UI with the welcome message!

## Troubleshooting

### Build Fails

**Error**: `npm install` fails
- **Solution**: Check that all `package.json` files are correct
- **Solution**: Ensure `render.yaml` build command is correct

**Error**: TypeScript compilation fails
- **Solution**: Run `npm run build` locally first to catch errors
- **Solution**: Check TypeScript version compatibility

### Server Won't Start

**Error**: `Cannot find module`
- **Solution**: Ensure build command runs before start command
- **Solution**: Check that `dist/` folder is created during build

**Error**: Port already in use
- **Solution**: Render automatically assigns PORT env variable, don't hardcode it

### ChatGPT Connection Fails

**Error**: "Cannot connect to MCP server"
- **Solution**: Ensure your Render service is running (check dashboard)
- **Solution**: Test the `/mcp` endpoint with curl
- **Solution**: Wait 30 seconds for cold start (free tier spins down)

**Error**: "MCP endpoint not found"
- **Solution**: Make sure you're using `/mcp` at the end of the URL
- **Solution**: Check that the server is listening on the correct port

### UI Doesn't Load

**Error**: Blank screen in ChatGPT
- **Solution**: Check browser console for errors
- **Solution**: Ensure `web/dist/component.js` was built correctly
- **Solution**: Verify the resource registration in server code

## Render Free Tier Limits

- **750 hours/month** of runtime
- **512 MB RAM**
- **Spins down after 15 minutes** of inactivity
- **Cold start**: ~30 seconds to wake up

## Next Steps

Once this minimal app works in ChatGPT:
1. ✅ Verify the UI renders correctly
2. ✅ Test that data passes from server to UI
3. 🔄 Add PostgreSQL connection
4. 🔄 Implement database query tools
5. 🔄 Add rich data visualization
6. 🔄 Add loading animations

## Support

If you encounter issues:
1. Check Render logs in the dashboard
2. Test endpoints with curl
3. Review the build logs for errors
4. Ensure all dependencies are installed

