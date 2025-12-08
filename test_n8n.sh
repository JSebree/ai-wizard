#!/bin/bash
echo "Testing n8n TTS Webhook..."
curl -v -X POST "https://n8n.simplifies.click/webhook/generate-voice-preview" \
-H "Content-Type: application/json" \
-d '{"text": "This is a test of the emergency broadcast system.", "voice_id": "en_us_001"}' \
> n8n_response.json 2>&1
echo "\nSaved response to n8n_response.json"
