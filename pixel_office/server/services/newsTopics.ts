/**
 * News Topic Service for Pixel Office Cooler Sessions
 * 
 * Fetches current news topics to spark interesting conversations
 * among the office agents.
 */

const NEWS_API_URL = process.env.NEWS_API_URL || "https://newsapi.org/v2/top-headlines";
const NEWS_API_KEY = process.env.NEWS_API_KEY || "";

interface NewsTopic {
  title: string;
  category: string;
  source: string;
}

const FALLBACK_TOPICS: NewsTopic[] = [
  { title: "Latest developments in artificial intelligence", category: "tech", source: "trending" },
  { title: "Climate change initiatives around the world", category: "science", source: "trending" },
  { title: "New space exploration missions", category: "science", source: "trending" },
  { title: "Remote work trends and office culture", category: "workplace", source: "office" },
  { title: "Sustainability in technology", category: "tech", source: "trending" },
  { title: "Health and wellness in the workplace", category: "wellness", source: "office" },
  { title: "Advances in renewable energy", category: "science", source: "trending" },
  { title: "Cybersecurity best practices", category: "tech", source: "trending" },
  { title: "Work-life balance strategies", category: "wellness", source: "office" },
  { title: "The future of collaboration tools", category: "tech", source: "office" },
  { title: "Quantum computing breakthroughs", category: "science", source: "trending" },
  { title: "Robot automation in everyday life", category: "tech", source: "trending" },
];

let cachedTopics: NewsTopic[] = [];
let lastFetchTime = 0;
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export async function fetchNewsTopics(): Promise<NewsTopic[]> {
  const now = Date.now();
  
  // Return cached topics if still fresh
  if (cachedTopics.length > 0 && now - lastFetchTime < CACHE_DURATION_MS) {
    return cachedTopics;
  }
  
  // Try to fetch from news API
  if (NEWS_API_KEY) {
    try {
      const response = await Promise.race([
        fetch(`${NEWS_API_URL}?country=us&apiKey=${NEWS_API_KEY}&pageSize=10`),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("timeout")), 5000)
        )
      ]) as Response;
      
      if (response.ok) {
        const data = await response.json() as { articles?: Array<{ title?: string; source?: { name?: string } }> };
        
        if (data.articles && data.articles.length > 0) {
          cachedTopics = data.articles
            .filter(a => a.title && a.title !== "[Removed]")
            .slice(0, 5)
            .map(a => ({
              title: a.title!.replace(/[^\w\s,.-]/g, "").trim(),
              category: "news",
              source: a.source?.name || "news"
            }));
          
          lastFetchTime = now;
          console.log(`[NewsTopics] Fetched ${cachedTopics.length} topics from API`);
          return cachedTopics;
        }
      }
    } catch (error) {
      console.log(`[NewsTopics] API fetch failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }
  
  // Use fallback topics with rotation
  const shuffled = [...FALLBACK_TOPICS].sort(() => Math.random() - 0.5);
  cachedTopics = shuffled.slice(0, 5);
  lastFetchTime = now;
  
  console.log(`[NewsTopics] Using fallback topics (cached)`);
  return cachedTopics;
}

export function getRandomTopic(): string {
  const topics = cachedTopics.length > 0 ? cachedTopics : FALLBACK_TOPICS;
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return topic.title;
}

export function getTopicForConversation(): string {
  const topic = getRandomTopic();
  console.log(`[NewsTopics] Selected topic: ${topic}`);
  return topic;
}

export async function getTopicsForSession(): Promise<string[]> {
  const topics = await fetchNewsTopics();
  return topics.map(t => t.title);
}
