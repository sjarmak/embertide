"""Thin ComfyUI REST client for embertide art scripts.

Drop-in replacement for the fal.ai path in gen-altar-frames-v2.py and
other asset scripts. Loads a JSON workflow template, substitutes
`<<PLACEHOLDERS>>`, POSTs to the ComfyUI queue, polls /history for
completion, and returns the raw PNG bytes of the first output image —
same contract as `regen_via_fal`.

ComfyUI is assumed to be running at COMFYUI_URL (default
http://127.0.0.1:8188). Start it manually before running any script
that imports this module:

    cd ~/tools/ComfyUI
    source .venv/bin/activate
    python main.py --listen 127.0.0.1 --port 8188 &

Workflow templates live alongside this file under comfyui_workflows/
and use `<<PLACEHOLDER>>` tokens that are replaced via JSON re-encoding
(so placeholders can stand in for strings OR numbers without needing
separate quoting rules).
"""

from __future__ import annotations

import json
import logging
import os
import random
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Mapping

log = logging.getLogger("comfyui-client")

COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFYUI_DIR = Path(os.environ.get("COMFYUI_DIR", Path.home() / "tools" / "ComfyUI"))
CLIENT_ID = "embertide-art-pipeline"

WORKFLOWS_DIR = Path(__file__).resolve().parent / "comfyui_workflows"

POLL_INTERVAL_SEC = 1.0
POLL_TIMEOUT_SEC = 600.0  # 10 min ceiling per job


class ComfyUIError(RuntimeError):
    """ComfyUI refused a request or a job failed / timed out."""


def _http_request(
    path: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: Mapping[str, str] | None = None,
    timeout: float = 30.0,
) -> bytes:
    url = f"{COMFYUI_URL.rstrip('/')}{path}"
    req_headers = dict(headers or {})
    if body is not None and "Content-Type" not in req_headers:
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception as exc:  # urllib raises a zoo of types; normalize.
        raise ComfyUIError(f"{method} {url} failed: {exc}") from exc


def ensure_reachable() -> None:
    """Smoke-test ComfyUI is listening. Raises ComfyUIError if not."""
    try:
        _http_request("/system_stats", timeout=3.0)
    except ComfyUIError as exc:
        raise ComfyUIError(
            f"ComfyUI not reachable at {COMFYUI_URL}. "
            "Start it: `cd ~/tools/ComfyUI && source .venv/bin/activate && "
            "python main.py --listen 127.0.0.1 --port 8188 &`"
        ) from exc


def _load_workflow(name: str, substitutions: Mapping[str, Any]) -> dict[str, Any]:
    """Load a JSON workflow template and substitute `<<KEY>>` tokens.

    Substitution is done by re-encoding: placeholder strings in the raw
    JSON are replaced with the JSON encoding of each substitution
    value, then the text is parsed back. This supports numeric, bool,
    and string values without caring about the placeholder's quoting
    context in the template.
    """
    path = WORKFLOWS_DIR / f"{name}.json"
    raw = path.read_text(encoding="utf-8")
    for key, value in substitutions.items():
        # Strings replacing a STRING placeholder -> just swap the token
        # inside the quoted placeholder. Numbers/bools replacing a
        # STRING placeholder -> swap the whole "<<KEY>>" string
        # (quotes included) with the JSON-encoded literal so the
        # result is still valid JSON.
        token_quoted = f'"<<{key}>>"'
        if isinstance(value, str):
            # Preserve the enclosing quotes; just substitute the inner
            # token. Escape for JSON (backslashes + quotes).
            encoded_inner = json.dumps(value)[1:-1]
            raw = raw.replace(f"<<{key}>>", encoded_inner)
        else:
            encoded = json.dumps(value)
            raw = raw.replace(token_quoted, encoded)

    try:
        workflow = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ComfyUIError(
            f"Workflow template {name!r} produced invalid JSON after "
            f"substitutions {dict(substitutions)!r}: {exc}"
        ) from exc

    # Strip the _comment top-level key (it's for humans only; ComfyUI
    # tolerates unknown keys but dropping keeps the queue payload lean).
    workflow.pop("_comment", None)
    return workflow


def _queue(workflow: Mapping[str, Any]) -> str:
    body = json.dumps({"prompt": workflow, "client_id": CLIENT_ID}).encode("utf-8")
    raw = _http_request("/prompt", method="POST", body=body, timeout=30.0)
    resp = json.loads(raw)
    prompt_id = resp.get("prompt_id")
    if not isinstance(prompt_id, str):
        raise ComfyUIError(f"/prompt did not return a prompt_id: {resp!r}")
    return prompt_id


def _wait_for(prompt_id: str) -> dict[str, Any]:
    """Poll /history/{id} until the job completes. Returns the history entry."""
    deadline = time.monotonic() + POLL_TIMEOUT_SEC
    encoded_id = urllib.parse.quote(prompt_id)
    while time.monotonic() < deadline:
        raw = _http_request(f"/history/{encoded_id}", timeout=10.0)
        history = json.loads(raw)
        entry = history.get(prompt_id)
        if entry is not None and entry.get("status", {}).get("completed"):
            return entry
        time.sleep(POLL_INTERVAL_SEC)
    raise ComfyUIError(
        f"ComfyUI job {prompt_id} did not finish within {POLL_TIMEOUT_SEC:.0f}s"
    )


def _download_output(image: Mapping[str, Any]) -> bytes:
    params = urllib.parse.urlencode(
        {
            "filename": image["filename"],
            "subfolder": image.get("subfolder", ""),
            "type": image.get("type", "output"),
        }
    )
    return _http_request(f"/view?{params}", timeout=60.0)


def run_workflow(
    workflow_name: str,
    substitutions: Mapping[str, Any],
) -> bytes:
    """Run a workflow template, return the first SaveImage output's bytes.

    Parameters
    ----------
    workflow_name: stem of a file under comfyui_workflows/ (no extension).
    substitutions: mapping of `<<PLACEHOLDER>>` names (without the <<>>)
                   to their concrete values (string / number / bool).

    Returns
    -------
    Raw image bytes (PNG by default — SaveImage writes PNG).
    """
    ensure_reachable()
    workflow = _load_workflow(workflow_name, substitutions)
    log.info("→ dispatching workflow %s (%d nodes)", workflow_name, len(workflow))
    prompt_id = _queue(workflow)
    log.info("  queued as %s; polling /history", prompt_id)
    entry = _wait_for(prompt_id)

    outputs = entry.get("outputs", {}) or {}
    for node_outputs in outputs.values():
        images = node_outputs.get("images") if isinstance(node_outputs, dict) else None
        if images:
            first = images[0]
            log.info("  fetching %s (subfolder=%r type=%r)", first["filename"], first.get("subfolder", ""), first.get("type", "output"))
            return _download_output(first)

    raise ComfyUIError(
        f"ComfyUI job {prompt_id} produced no SaveImage output: {entry!r}"
    )


def generate_flux_t2i(
    prompt: str,
    *,
    width: int = 1024,
    height: int = 1536,
    steps: int = 20,
    guidance: float = 3.5,
    seed: int | None = None,
) -> bytes:
    """Text-to-image via Flux.1-dev. Returns PNG bytes."""
    return run_workflow(
        "flux_t2i",
        {
            "PROMPT": prompt,
            "WIDTH": width,
            "HEIGHT": height,
            "STEPS": steps,
            "GUIDANCE": guidance,
            "SEED": seed if seed is not None else random.randint(1, 2**31 - 1),
        },
    )


def _stage_reference(ref_path: Path) -> str:
    """Copy a local reference image into ComfyUI's input/ dir and return
    the basename. LoadImage nodes read from that directory, so the
    workflow only sees the filename, not a full path.
    """
    input_dir = COMFYUI_DIR / "input"
    input_dir.mkdir(parents=True, exist_ok=True)
    # Use a stable basename so repeated runs with the same reference
    # don't litter the input/ dir. Prefix with `zs_ref_` so our staged
    # references are easy to spot / prune.
    basename = f"zs_ref_{ref_path.stem}{ref_path.suffix}"
    dest = input_dir / basename
    shutil.copyfile(ref_path, dest)
    return basename


def generate_flux_kontext_edit(
    prompt: str,
    reference_image: Path | str,
    *,
    steps: int = 20,
    guidance: float = 2.5,
    seed: int | None = None,
) -> bytes:
    """Flux.1-Kontext-dev image edit. Returns PNG bytes.

    Kontext preserves the reference image's visual characteristics
    (style, palette, composition) while applying the prompt's
    instructions. Ideal for:
      - Style-locked regeneration (subject change, style held fixed)
      - Background cleanup on existing rasters (e.g. chroma-key)
      - Iterating an existing asset without losing its identity

    The reference is resized by the workflow's FluxKontextImageScale
    node to a supported Kontext resolution (1024-ish); the OUTPUT
    inherits those dimensions, so callers that need a specific output
    aspect should pre-scale the reference to that aspect themselves.

    Parameters
    ----------
    prompt: what to change about the reference. Be specific about what
            should be PRESERVED (style, palette, composition) and what
            should be CHANGED (subject, pose, contents).
    reference_image: path to a local image file (PNG / JPG / WEBP).
                     Will be staged into ComfyUI's input/ dir.
    steps: diffusion steps (20 is the dev-model sweet spot).
    guidance: classifier-free guidance. Kontext is tuned for ~2.5;
              higher values push harder toward the prompt and may
              drift from the reference's style.
    seed: deterministic seed; omitted → random.
    """
    ref_basename = _stage_reference(Path(reference_image))
    return run_workflow(
        "flux_kontext_edit",
        {
            "PROMPT": prompt,
            "REF_IMAGE": ref_basename,
            "STEPS": steps,
            "GUIDANCE": guidance,
            "SEED": seed if seed is not None else random.randint(1, 2**31 - 1),
        },
    )


def generate_flux_lora_t2i(
    prompt: str,
    lora_name: str,
    *,
    strength: float = 1.0,
    width: int = 1024,
    height: int = 1536,
    steps: int = 24,
    guidance: float = 3.5,
    seed: int | None = None,
) -> bytes:
    """Text-to-image via Flux.1-dev with a LoRA applied. Returns PNG bytes.

    The LoRA file must live at `~/tools/ComfyUI/models/loras/<lora_name>`.
    `strength` is the standard 0.0-1.0-ish LoRA scale; 1.0 applies the
    LoRA at full trained strength, <1 blends with the base model.
    """
    return run_workflow(
        "flux_lora_t2i",
        {
            "PROMPT": prompt,
            "LORA_NAME": lora_name,
            "LORA_STRENGTH": strength,
            "WIDTH": width,
            "HEIGHT": height,
            "STEPS": steps,
            "GUIDANCE": guidance,
            "SEED": seed if seed is not None else random.randint(1, 2**31 - 1),
        },
    )


def generate_sdxl_t2i(
    prompt: str,
    *,
    negative: str = "",
    width: int = 1024,
    height: int = 1024,
    steps: int = 30,
    cfg: float = 7.0,
    seed: int | None = None,
) -> bytes:
    """Text-to-image via SDXL base. Returns PNG bytes.

    Kept primarily as a smoke-test path for the client itself — SDXL
    is faster to load than Flux, so this is the cheapest way to verify
    the /prompt → /history → /view round-trip before committing to a
    30-second Flux run.
    """
    return run_workflow(
        "sdxl_t2i",
        {
            "PROMPT": prompt,
            "NEGATIVE": negative,
            "WIDTH": width,
            "HEIGHT": height,
            "STEPS": steps,
            "CFG": cfg,
            "SEED": seed if seed is not None else random.randint(1, 2**31 - 1),
        },
    )
