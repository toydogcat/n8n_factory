import httpx
import asyncio
import json

# Configuration
FACTORY_API = "http://localhost:8000"

async def trigger_via_factory(workflow_id: str, data: dict):
    """
    Trigger an n8n workflow through the local Factory backend.
    This will also show up in the Dashboard UI.
    """
    print(f"🚀 Triggering workflow {workflow_id} via Factory...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{FACTORY_API}/trigger/{workflow_id}",
                json=data,
                timeout=10.0
            )
            response.raise_for_status()
            print("✅ Success!")
            print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")

async def main():
    # Example data to send to n8n
    sample_payload = {
        "user": "Toby",
        "message": "Hello from Python script using toby conda environment!",
        "priority": "high",
        "tags": ["python", "n8n", "factory"]
    }
    
    # Replace 'W-001' with your actual n8n workflow ID
    await trigger_via_factory("W-001", sample_payload)

if __name__ == "__main__":
    asyncio.run(main())
