#!/usr/bin/env python3
"""Call Jev (typesafe/jev-1.13) through OpenRouter's Decisions route.

Usage: jev.py request.json      (or pipe the JSON on stdin)
Request JSON: {"state": <text or object>, "questions": {name: {type, instructions, criteria}}}
Reads the key from the OPENROUTER_API_KEY environment variable. Never prints it.
Prints a JSON object: {answers, seconds, cost, usage, id, model} or the exact HTTP error.
"""
import json, os, sys, time, urllib.request, urllib.error

URL = "https://openrouter.ai/api/alpha/decisions"
MODEL = "typesafe/jev-1.13"


def main():
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        sys.exit("OPENROUTER_API_KEY is not set")
    req = json.load(open(sys.argv[1]) if len(sys.argv) > 1 else sys.stdin)
    req.setdefault("model", MODEL)
    http = urllib.request.Request(
        URL, data=json.dumps(req).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
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
    print(json.dumps(body, indent=2))


if __name__ == "__main__":
    main()
