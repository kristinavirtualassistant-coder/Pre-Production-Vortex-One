#!/usr/bin/env bash
set -euo pipefail

# Vortex One -> OpenAI Agents API (HTTP/curl only)
# Requires: curl, python3, OPENAI_API_KEY
# No OpenAI SDK is required.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${ROOT_DIR}/config/openai-agent.json"
STATE_DIR="${ROOT_DIR}/.openai"
AGENT_ID_FILE="${STATE_DIR}/agent-id"
SESSION_ID_FILE="${STATE_DIR}/session-id"
EVENT_LOG="${STATE_DIR}/last-session-events.log"
API_BASE="https://api.openai.com/v1"
PROJECT_ID="proj_mw8PSjcctbVnHmf5Ws7YEofK"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "ERROR: OPENAI_API_KEY is not set." >&2
  echo "Set it in your shell; never commit the key to this repository." >&2
  exit 1
fi

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: Missing agent configuration: $CONFIG_FILE" >&2
  exit 1
fi

request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local output_file="$4"

  local http_code
  if [[ -n "$body" ]]; then
    http_code=$(curl --silent --show-error --location \
      --request "$method" "$url" \
      --header "Authorization: Bearer ${OPENAI_API_KEY}" \
      --header "Content-Type: application/json" \
      --header "OpenAI-Beta: agents=v1" \
      --header "OpenAI-Project: ${PROJECT_ID}" \
      --data "$body" \
      --output "$output_file" \
      --write-out '%{http_code}')
  else
    http_code=$(curl --silent --show-error --location \
      --request "$method" "$url" \
      --header "Authorization: Bearer ${OPENAI_API_KEY}" \
      --header "OpenAI-Beta: agents=v1" \
      --header "OpenAI-Project: ${PROJECT_ID}" \
      --output "$output_file" \
      --write-out '%{http_code}')
  fi

  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "OpenAI API error (HTTP ${http_code}):" >&2
    cat "$output_file" >&2
    echo >&2
    exit 1
  fi
}

json_get() {
  python3 - "$1" "$2" <<'PY'
import json, sys
path, expression = sys.argv[1:]
with open(path, encoding="utf-8") as f:
    value = json.load(f)
for part in expression.split('.'):
    value = value[part]
if value is None:
    raise SystemExit(0)
print(value)
PY
}

create_agent() {
  local body
  body=$(cat "$CONFIG_FILE")
  local response="${STATE_DIR}/agent-response.json"

  echo "Creating reusable OpenAI agent: New agent"
  request POST "${API_BASE}/agents" "$body" "$response"

  local agent_id
  agent_id=$(json_get "$response" id)
  if [[ -z "$agent_id" ]]; then
    echo "ERROR: OpenAI did not return an agent ID." >&2
    cat "$response" >&2
    exit 1
  fi

  printf '%s\n' "$agent_id" > "$AGENT_ID_FILE"
  chmod 600 "$AGENT_ID_FILE"
  echo "Agent ID: $agent_id"
}

if [[ "${RECREATE_AGENT:-0}" == "1" || ! -s "$AGENT_ID_FILE" ]]; then
  create_agent
else
  echo "Using reusable agent ID: $(cat "$AGENT_ID_FILE")"
fi

AGENT_ID="$(cat "$AGENT_ID_FILE")"

INITIAL_MESSAGE="Connect to Vortex One and confirm that the OpenAI Agents API session is running. Respond with a concise status report."

SESSION_BODY=$(python3 - "$AGENT_ID" "$INITIAL_MESSAGE" <<'PY'
import json, sys
agent_id, message = sys.argv[1:]
print(json.dumps({
    "environment": {"type": "none"},
    "agent_id": agent_id,
    "input": message,
    "stream": True,
    "metadata": {
        "application": "vortex-one",
        "project_id": "proj_mw8PSjcctbVnHmf5Ws7YEofK"
    }
}))
PY
)

RAW_STREAM="${STATE_DIR}/last-session.raw"
: > "$RAW_STREAM"

# The session endpoint accepts the initial user input and streams SSE events.
# Keep curl unbuffered so events appear immediately in the terminal.
echo
echo "Starting managed agent session..."
set +e
curl --silent --show-error --no-buffer --location \
  --request POST "${API_BASE}/agents/sessions" \
  --header "Authorization: Bearer ${OPENAI_API_KEY}" \
  --header "Content-Type: application/json" \
  --header "OpenAI-Beta: agents=v1" \
  --header "OpenAI-Project: ${PROJECT_ID}" \
  --data "$SESSION_BODY" \
  | tee "$RAW_STREAM"
CURL_STATUS=${PIPESTATUS[0]}
set -e

if [[ "$CURL_STATUS" -ne 0 ]]; then
  echo "ERROR: Session request failed with curl status ${CURL_STATUS}." >&2
  exit "$CURL_STATUS"
fi

# Extract session ID from any JSON event payloads we received.
SESSION_ID=$(python3 - "$RAW_STREAM" <<'PY'
import json, re, sys
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
ids = []
for line in text.splitlines():
    if not line.startswith("data:"):
        continue
    payload = line[5:].strip()
    if not payload or payload == "[DONE]":
        continue
    try:
        obj = json.loads(payload)
    except Exception:
        continue
    if isinstance(obj, dict):
        if obj.get("session_id"):
            ids.append(obj["session_id"])
        if obj.get("id") and obj.get("object") == "agent.session":
            ids.append(obj["id"])
print(ids[-1] if ids else "")
PY
)

if [[ -n "$SESSION_ID" ]]; then
  printf '%s\n' "$SESSION_ID" > "$SESSION_ID_FILE"
  chmod 600 "$SESSION_ID_FILE"
  echo
echo "Session ID: $SESSION_ID"
else
  echo
echo "WARNING: The stream did not expose a session ID. Full stream saved to $RAW_STREAM." >&2
fi

# Keep a clean event-only log for inspection.
awk '/^data:/{sub(/^data:[[:space:]]*/, ""); print}' "$RAW_STREAM" > "$EVENT_LOG" || true

# Retrieve the final managed-session state so failures and required tool/environment
# actions are visible even if the streaming output did not include the final object.
if [[ -n "$SESSION_ID" ]]; then
  FINAL_RESPONSE="${STATE_DIR}/session-final.json"
  request GET "${API_BASE}/agents/sessions/${SESSION_ID}" "" "$FINAL_RESPONSE"

  STATUS=$(json_get "$FINAL_RESPONSE" status || true)
  echo "Final session status: ${STATUS:-unknown}"

  if [[ "$STATUS" == "failed" ]]; then
    echo "ERROR: Agent session failed:" >&2
    json_get "$FINAL_RESPONSE" error >&2 || true
    exit 1
  fi

  REQUIRED_COUNT=$(python3 - "$FINAL_RESPONSE" <<'PY'
import json, sys
obj=json.load(open(sys.argv[1], encoding="utf-8"))
print(len(obj.get("required_actions") or []))
PY
)

  if [[ "$REQUIRED_COUNT" -gt 0 ]]; then
    echo "Session requires action(s):"
    python3 - "$FINAL_RESPONSE" <<'PY'
import json, sys
obj=json.load(open(sys.argv[1], encoding="utf-8"))
for action in obj.get("required_actions") or []:
    print(json.dumps(action, indent=2))
PY
    echo "No custom tools are configured in New agent, so there are no local tool executors to invoke." >&2
    exit 2
  fi
fi

echo
echo "OpenAI Agents API run complete."
echo "Event log: $EVENT_LOG"
