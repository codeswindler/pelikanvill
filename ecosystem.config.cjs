module.exports = {
  apps: [
    {
      name: "pelikanvill",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        NEXT_PUBLIC_BASE_URL: "https://pelikan.theleasemaster.com",
      },
      max_memory_restart: "512M",
      merge_logs: true,
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
