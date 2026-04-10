import httpx
from bs4 import BeautifulSoup
import asyncio
import logging
import models
from models import SessionLocal, AutomatonTask, InteractionLog
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("n8n-scraper")

class Scraper:
    async def fetch_page(self, url: str):
        """Fetch page content with httpx."""
        print(f"🔍 Scraping: {url}")
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            return response.text

    def parse_content(self, html: str):
        """Simple parse using BeautifulSoup."""
        soup = BeautifulSoup(html, 'html.parser')
        title = soup.title.string if soup.title else "No Title"
        # Extract main text (e.g., from paragraphs)
        paragraphs = soup.find_all('p', limit=5)
        snippet = " ".join([p.get_text()[:100] for p in paragraphs])
        return {"title": title, "snippet": snippet}

    async def run_task(self, url: str, task_id: int):
        """Main scraper task that updates the database."""
        db = SessionLocal()
        try:
            # 1. Fetch & Parse
            html = await self.fetch_page(url)
            data = self.parse_content(html)
            
            # 2. Update Task Status
            task = db.query(AutomatonTask).filter(AutomatonTask.id == task_id).first()
            if task:
                task.last_run = datetime.utcnow()
                task.last_result = f"Captured: {data['title'][:50]}"
            
            # 3. Log Event
            log = InteractionLog(
                entity_id=task_id,
                event_type="SCRAPE_SUCCESS",
                content=str(data),
                timestamp=datetime.utcnow()
            )
            db.add(log)
            db.commit()
            print(f"✅ Scrape Success: {data['title']}")
            return data
            
        except Exception as e:
            logger.error(f"❌ Scrape Error: {e}")
            # Update error in DB if task exists
            task = db.query(AutomatonTask).filter(AutomatonTask.id == task_id).first()
            if task:
                task.last_result = f"Error: {str(e)[:50]}"
            db.commit()
            raise e
        finally:
            db.close()

if __name__ == "__main__":
    # Test script run
    scraper = Scraper()
    asyncio.run(scraper.run_task("https://example.com", 1))
