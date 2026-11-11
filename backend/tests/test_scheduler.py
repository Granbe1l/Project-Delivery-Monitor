import asyncio
import time

import pytest

from app.jobs.scheduler import serve


@pytest.mark.asyncio
async def test_real_short_interval_serial_and_survives_error(caplog):
    times = []
    active = 0

    async def run():
        nonlocal active
        active += 1
        assert active == 1
        times.append(time.monotonic())
        await asyncio.sleep(0.02)
        active -= 1
        if len(times) == 1:
            raise RuntimeError("credential-not-to-be-logged")
        return 1

    await serve(0.02, asyncio.Event(), run=run, max_cycles=3)
    assert len(times) == 3
    assert all(b - a >= 0.035 for a, b in zip(times, times[1:]))
    assert 'credential-not-to-be-logged' not in caplog.text


@pytest.mark.asyncio
async def test_stop_interrupts_interval():
    stop = asyncio.Event()

    async def run():
        stop.set()
        return 0

    await asyncio.wait_for(serve(21600, stop, run=run), timeout=1)


@pytest.mark.asyncio
@pytest.mark.parametrize('interval', [0, -1, float('nan'), float('inf')])
async def test_invalid_interval(interval):
    with pytest.raises(ValueError):
        await serve(interval, asyncio.Event())
