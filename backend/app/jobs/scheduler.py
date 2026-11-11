"""Explicit opt-in worker. Never started by the API or a frontend request."""
import asyncio
import logging
import math
import os
import signal

from app.jobs.sync import run_repositories

log = logging.getLogger(__name__)


async def serve(interval, stop, run=run_repositories, max_cycles=None):
    if not math.isfinite(interval) or interval <= 0:
        raise ValueError("SYNC_INTERVAL_SECONDS must be finite and positive")
    count = 0
    while not stop.is_set():
        try:
            result = await run()
            log.info("sync_cycle_finished exit_code=%s", result)
        except Exception as exc:
            # Never log connection strings or token-bearing exception messages.
            log.error("sync_cycle_failed error_type=%s", type(exc).__name__)
        count += 1
        if max_cycles is not None and count >= max_cycles:
            return
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except TimeoutError:
            pass


async def main():
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    await serve(float(os.getenv("SYNC_INTERVAL_SECONDS", "21600")), stop)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
