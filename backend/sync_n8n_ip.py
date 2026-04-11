import os
import re
import socket
import json
import httpx
from dotenv import load_dotenv

# --- Configuration ---
# Load env from root folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

FRONTEND_ENV_PATH = os.path.join(os.path.dirname(BASE_DIR), "frontend", ".env")
N8N_BASE_URL = os.getenv("N8N_BASE_URL", "http://localhost:5678").rstrip("/")
N8N_API_KEY = os.getenv("N8N_API_KEY")

def get_local_ip():
    """Detect the primary local IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't need to be reachable, just triggers OS to pick correct interface
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def update_frontend_env(new_ip):
    """Update VITE_API_HOST in frontend/.env."""
    if not os.path.exists(FRONTEND_ENV_PATH):
        print(f"⚠️ Frontend .env not found at {FRONTEND_ENV_PATH}")
        return

    with open(FRONTEND_ENV_PATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    updated = False
    for i, line in enumerate(lines):
        if line.startswith("VITE_API_HOST="):
            lines[i] = f"VITE_API_HOST={new_ip}\n"
            updated = True
            break
    
    if not updated:
        lines.append(f"VITE_API_HOST={new_ip}\n")

    with open(FRONTEND_ENV_PATH, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"✅ Updated frontend/.env with IP: {new_ip}")

async def sync_n8n_workflows(new_ip):
    """Update n8n workflows via API."""
    if not N8N_API_KEY:
        print("⚠️ N8N_API_KEY not set. Skipping n8n workflow sync.")
        return

    headers = {
        "X-N8N-API-KEY": N8N_API_KEY,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        try:
            # 1. Fetch all workflows
            print(f"🔍 Fetching workflows from n8n ({N8N_BASE_URL})...")
            response = await client.get(f"{N8N_BASE_URL}/api/v1/workflows", headers=headers)
            response.raise_for_status()
            workflows_data = response.json()
            workflows = workflows_data.get("data", [])

            print(f"📊 Found {len(workflows)} workflows.")

            # Regex to find backend URLs and specific paths (Update IP and migration from /api/gmail/webhook -> /bot/gmail)
            ip_pattern = r'(https?://)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:8000)(/api/gmail/webhook|/bot/gmail|/bot/command)?'
            
            def replace_url(match):
                base = match.group(1) + new_ip + match.group(2)
                path = match.group(3)
                if path == "/api/gmail/webhook":
                    return base + "/bot/gmail"
                return base + (path if path else "")

            # We'll use a functional replacement in the loop below

            for wf_info in workflows:
                wf_id = wf_info["id"]
                wf_name = wf_info["name"]
                
                # 2. Get detailed workflow
                wf_detail_res = await client.get(f"{N8N_BASE_URL}/api/v1/workflows/{wf_id}", headers=headers)
                wf_detail = wf_detail_res.json()
                
                # Convert to string to perform replacement
                wf_str = json.dumps(wf_detail)
                
                if re.search(ip_pattern, wf_str):
                    print(f"🔄 Updating IP in workflow: {wf_name} (ID: {wf_id})")
                    # 2. Update the workflow JSON
                    new_wf_str = re.sub(ip_pattern, replace_url, wf_str)
                    new_wf_data = json.loads(new_wf_str)
                    
                    # 2.1 Specifically fix the "Post to Backend" node to send ALL data
                    # This avoids the "undefined" mapping issues
                    for node in new_wf_data.get("nodes", []):
                        if node.get("name") == "Post to Backend":
                            node["parameters"]["sendBody"] = True
                            node["parameters"]["specifyBody"] = "jsonPayload"
                            # Use stringify to be absolutely sure it's valid JSON
                            node["parameters"]["jsonPayload"] = "={{ JSON.stringify($json) }}"
                            print(f"🛠️  Upgraded 'Post to Backend' node with JSON.stringify in workflow: {wf_name}")

                    # 3. Push update back to n8n
                    # Use a skeletal payload with an EMPTY settings object 
                    # to satisfy both "required" and "no additional properties" constraints.
                    update_payload = {
                        "name": new_wf_data.get("name"),
                        "nodes": new_wf_data.get("nodes"),
                        "connections": new_wf_data.get("connections"),
                        "settings": {} 
                    }
                    
                    update_res = await client.put(f"{N8N_BASE_URL}/api/v1/workflows/{wf_id}", json=update_payload, headers=headers)
                    if update_res.status_code != 200:
                        print(f"❌ Error Detail: {update_res.text}")
                    update_res.raise_for_status()
                    print(f"✅ Successfully updated workflow: {wf_name}")
                else:
                    # print(f"⏭️ No IP match found in workflow: {wf_name}")
                    pass

        except Exception as e:
            print(f"❌ Error syncing with n8n: {e}")

if __name__ == "__main__":
    import asyncio
    
    current_ip = get_local_ip()
    print(f"🌐 Detected Local IP: {current_ip}")
    
    # 1. Update Frontend env
    update_frontend_env(current_ip)
    
    # 2. Sync n8n Workflows
    asyncio.run(sync_n8n_workflows(current_ip))
    
    print("🚀 IP Sync process completed.")
