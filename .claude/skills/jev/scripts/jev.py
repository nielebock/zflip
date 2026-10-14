#!/usr/bin/env python3
"""Call Jev (typesafe-ai/jev) through Vercel AI Gateway's TypeSafe-compatible API.

Usage: jev.py request.json      (or pipe the JSON on stdin)
Request JSON: {"state": <text or object>, "questions": {name: {type, instructions, criteria}}}
Auth: this workspace stores AI_GATEWAY_API_KEY as a cloud "network secret" for ai-gateway.vercel.sh, so the
sandbox proxy adds the Authorization header itself. If AI_GATEWAY_API_KEY is also set as a plain env var it is
sent as a Bearer token. The key is never printed.
Prints the full response plus "seconds" (wall clock) and "cost_usd", or the exact HTTP error.
"""
import json, os, sys, time, urllib.request, urllib.error

URL = "https://ai-gateway.vercel.sh/typesafe/v1/systemone"
MODEL = "typesafe-ai/jev"


def main():
    key = os.environ.get("AI_GATEWAY_API_KEY")
    req = json.load(open(sys.argv[1]) if len(sys.argv) > 1 else sys.stdin)
    req.setdefault("model", MODEL)
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    http = urllib.request.Request(URL, data=json.dumps(req).encode(), headers=headers)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(http, timeout=60) as r:
            body = json.load(r)
    except urllib.error.HTTPError as e:
        print(json.dumps({"error": True, "http_status": e.code, "body": e.read().decode()}, indent=2))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": True, "exception": repr(e)}, indent=2))
        sys.exit(1)
    body["seconds"] = round(time.perf_counter() - t0, 3)
    cost = body.get("provider_metadata", {}).get("gateway", {}).get("cost")
    body["cost_usd"] = float(cost) if cost is not None else None
    print(json.dumps(body, indent=2))


if __name__ == "__main__":
    main()
