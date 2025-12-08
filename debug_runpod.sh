#!/bin/bash
# Source .env
export $(grep -v '^#' .env | xargs)

echo "Testing TTS Endpoint with Key: ${VITE_RUNPOD_API_KEY:0:5}..." >> debug_output.txt

curl -v -X POST "https://api.runpod.ai/v2/vms8w05ymko04a/run" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ${VITE_RUNPOD_API_KEY}" \
-d '{"input": {"text": "Hello World", "voice_id": "en_us_001", "speed": 1.0}}' \
2>> debug_output.txt >> debug_output.txt

echo "\nDone." >> debug_output.txt
