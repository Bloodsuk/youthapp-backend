import EnvVars from "@src/constants/EnvVars";
import mysql from "mysql2/promise";

export async function createPool() {
  return await new Promise<mysql.Pool>((resolve) => {
    const pool = mysql.createPool({
      // user: "admin",
      // password: "9CZH6WubM3ksm9k2",
      // host: "93.114.185.78",
      // database: "prac_staging",
      user: EnvVars.MySQL.User,
      password: EnvVars.MySQL.Password,
      host: EnvVars.MySQL.Host,
      database: EnvVars.MySQL.Database,
      port: 3306,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
      idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    console.log("Db ========", {
      user: EnvVars.MySQL.User,
      password: EnvVars.MySQL.Password,
      host: EnvVars.MySQL.Host,
      database: EnvVars.MySQL.Database,
    });
    
    pool.getConnection()
      .then((connection) => {
        console.log('Database connection successful');
        connection.release();
      })
      .catch((error) => {
        console.error('Database connection failed:', error.message);
      });
    resolve(pool);
  });
}
