#!/usr/bin/env bash
# Start ComfyUI in the background on 127.0.0.1:8188 for use by the
# embertide art scripts. Idempotent — no-ops if already running.
#
# Usage:
#   scripts/start-comfyui.sh         # starts server, returns when reachable
#   scripts/start-comfyui.sh --stop  # kills any running instance
#   scripts/start-comfyui.sh --logs  # tails the log

set -euo pipefail

COMFYUI_DIR="${COMFYUI_DIR:-$HOME/tools/ComfyUI}"
COMFYUI_HOST="${COMFYUI_HOST:-127.0.0.1}"
COMFYUI_PORT="${COMFYUI_PORT:-8188}"
LOG_FILE="${COMFYUI_LOG:-/tmp/comfyui.log}"
PID_FILE="${COMFYUI_PID:-/tmp/comfyui.pid}"

reachable() {
  curl -sSf -o /dev/null --max-time 2 \
    "http://${COMFYUI_HOST}:${COMFYUI_PORT}/system_stats" 2>/dev/null
}

case "${1:-start}" in
  --stop|stop)
    if [[ -f "$PID_FILE" ]]; then
      pid=$(cat "$PID_FILE")
      if kill -0 "$pid" 2>/dev/null; then
        echo "stopping ComfyUI pid=$pid"
        kill "$pid"
        rm -f "$PID_FILE"
      else
        echo "stale pid file; cleaning up"
        rm -f "$PID_FILE"
      fi
    else
      echo "no ComfyUI pid file at $PID_FILE"
    fi
    ;;
  --logs|logs)
    exec tail -f "$LOG_FILE"
    ;;
  --status|status)
    if reachable; then
      echo "ComfyUI reachable at http://${COMFYUI_HOST}:${COMFYUI_PORT}"
    else
      echo "ComfyUI NOT reachable"
      exit 1
    fi
    ;;
  start|"")
    if reachable; then
      echo "ComfyUI already running at http://${COMFYUI_HOST}:${COMFYUI_PORT}"
      exit 0
    fi
    if [[ ! -d "$COMFYUI_DIR" ]]; then
      echo "COMFYUI_DIR not found: $COMFYUI_DIR" >&2
      exit 1
    fi
    echo "starting ComfyUI at http://${COMFYUI_HOST}:${COMFYUI_PORT} (log: $LOG_FILE)"
    cd "$COMFYUI_DIR"
    # shellcheck disable=SC1091
    source .venv/bin/activate
    nohup python main.py --listen "$COMFYUI_HOST" --port "$COMFYUI_PORT" \
      >"$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    # Wait until reachable or timeout. Startup can take 30-90s on a
    # cold boot (dynamic-vram scan + custom-node imports); first real
    # generation request pays the VAE+UNet load separately.
    for _ in $(seq 1 120); do
      if reachable; then
        echo "ready"
        exit 0
      fi
      sleep 1
    done
    echo "ComfyUI did not become reachable within 120s — check $LOG_FILE" >&2
    exit 1
    ;;
  *)
    echo "usage: $0 [start|stop|logs|status]" >&2
    exit 2
    ;;
esac
