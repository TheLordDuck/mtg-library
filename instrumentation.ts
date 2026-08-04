export async function register() {
  // Only run on the Node.js runtime (not edge), and only on the server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("./lib/backup");
    // Set the hour (0–23) and minute (0–59) for the daily backup
    startBackupScheduler(3, 0); // runs at 23:13 every day
  }
}
