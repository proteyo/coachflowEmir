"""Keep query credentials and private query parameters out of Uvicorn logs."""
import logging
import re

SENSITIVE_QUERY = re.compile(r"([?&](?:token|media_token|code|password|key|api_key)=)[^&\s\"'<>]+", re.I)


def redact(value):
    if not isinstance(value, str):
        return value
    if value.startswith(("/", "https://", "http://", "ws://", "wss://")):
        return value.split("?", 1)[0]
    return SENSITIVE_QUERY.sub(r"\1[REDACTED]", value)


class RedactQueryCredentials(logging.Filter):
    def filter(self, record):
        record.msg = redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(redact(value) for value in record.args)
        elif isinstance(record.args, dict):
            record.args = {key: redact(value) for key, value in record.args.items()}
        return True


def install_log_redaction():
    for name in ("uvicorn.access", "uvicorn.error"):
        logger = logging.getLogger(name)
        if not any(isinstance(item, RedactQueryCredentials) for item in logger.filters):
            logger.addFilter(RedactQueryCredentials())
