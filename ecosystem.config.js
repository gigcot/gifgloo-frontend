module.exports = {
  apps: [
    {
      name: "gifgloo-frontend",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "cluster",
      autorestart: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
