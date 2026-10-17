# Verification image for the complete reference checkpoints, not the student app.
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv
ENV UV_CACHE_DIR=/opt/uv-cache \
    UV_PYTHON_DOWNLOADS=never \
    PYDANTIC_AI_NO_BANNER=1
WORKDIR /course
COPY .github/scripts/check_examples.py .github/scripts/check_examples.py.lock .github/scripts/
COPY lectures/02-http-fastapi-pydantic.md lectures/03-persistence-and-first-pr.md lectures/06-pydantic-ai-agents.md lectures/09-failures-evals-costs.md lectures/
# Prepare pinned dependencies while networking is available; fail on broken text.
RUN uv run --locked .github/scripts/check_examples.py
RUN useradd --create-home --uid 10001 verifier \
    && chown -R verifier:verifier /opt/uv-cache
USER verifier
CMD ["uv", "run", "--offline", "--locked", ".github/scripts/check_examples.py"]
