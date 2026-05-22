import './pre-start'; // Must be the first import

import http from 'http';
import EnvVars from '@src/constants/EnvVars';
import app, { setPool } from './server';
import { initTrackingSocket } from './socket/trackingSocket';
import { createPool } from './database/Database';

// **** Run **** //

const SERVER_START_MSG = ('Express server started on port: ' +
  EnvVars.Port.toString());

(async () => {
  const dbPool = await createPool();
  setPool(dbPool);

  const httpServer = http.createServer(app);
  initTrackingSocket(httpServer);
  httpServer.listen(EnvVars.Port, () => console.info(SERVER_START_MSG));
})();
