import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      {
        name: 'api-fallback',
        configureServer(server) {
          server.middlewares.use('/api/feedback', (req, res) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { system, userPrompt } = JSON.parse(body);
                  const apiKey = env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY;
                  
                  const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-api-key': apiKey,
                      'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                      model: 'claude-4-6-sonnet',
                      max_tokens: 1000,
                      system,
                      messages: [{ role: 'user', content: userPrompt }],
                    }),
                  });
                  
                  const data = await response.json();
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = response.status;
                  res.end(JSON.stringify(data));
                } catch (e) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: e.message }));
                }
              });
            } else {
              res.statusCode = 405;
              res.end();
            }
          });
        }
      }
    ],
    server: {
      historyApiFallback: true,
      host: true, // 로컬 IP로 외부 기기 접근 허용
    },
  }
})
