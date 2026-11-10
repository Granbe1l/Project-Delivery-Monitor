import json
import logging
from datetime import UTC, datetime

logger = logging.getLogger("pdm")


def event(name: str, **fields):
    logger.info(json.dumps({"event": name, "at": datetime.now(UTC).isoformat(), **fields}))
