import { env } from './config/env';
import { connectDb } from './config/db';
import { createApp } from './app';
import { User } from './models/User';
import { runSeed } from './seed';
import { attachRealtime } from './realtime';

async function main() {
  const inMemory = await connectDb();
  // In-memory DB starts empty each run → seed automatically so the app is usable immediately
  if (inMemory || (await User.countDocuments()) === 0) await runSeed();
  const server = createApp().listen(env.PORT, () => console.log(`[api] VSR API listening on http://localhost:${env.PORT}/api/v1`));
  attachRealtime(server);
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[api] Port ${env.PORT} is already in use by another program.`);
      console.error('      Stop that program, or set a different PORT in backend/.env (and update the frontend proxy + mobile API_URL).');
      process.exit(1);
    }
    throw err;
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
