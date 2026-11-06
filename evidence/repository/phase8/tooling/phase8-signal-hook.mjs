// Windows-only test transport: dispatch the real executable's installed handler via IPC.
if (process.platform === "win32" && process.send) {
  const signal = value => {
    if (value !== "SIGTERM") return;
    process.emit("SIGTERM"); process.removeListener("message", signal); process.disconnect();
  };
  process.on("message", signal);
}
