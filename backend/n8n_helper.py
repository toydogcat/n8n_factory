import httpx
import os
from dotenv import load_dotenv
from typing import Dict, Any, Optional

load_dotenv()

class N8NClient:
    def __init__(self):
        self.base_url = os.getenv("N8N_BASE_URL", "http://localhost:5678").rstrip("/")
        self.api_key = os.getenv("N8N_API_KEY")
        self.headers = {
            "X-N8N-API-KEY": self.api_key,
            "Content-Type": "application/json"
        }

    async def trigger_workflow(self, workflow_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Trigger an n8n workflow using its ID.
        Note: This usually requires the workflow to have a 'Webhook' or 'Execute' node.
        """
        url = f"{self.base_url}/api/v1/workflows/{workflow_id}/execute"
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, headers=self.headers)
            response.raise_for_status()
            return response.json()

    async def send_to_webhook(self, webhook_url: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send data to a specific n8n webhook URL.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=data)
            response.raise_for_status()
            return response.json()

    def get_auth_token(self):
        return os.getenv("WEBHOOK_AUTH_TOKEN", "default_secret")
