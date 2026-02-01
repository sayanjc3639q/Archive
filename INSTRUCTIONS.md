# How to Update Your Vanilla Archive

This version of your archive is built with vanilla HTML, CSS, and JavaScript. It reads data directly from the `/data` folder.

## 📁 Directory Structure
- `index.html`: The main website shell.
- `style.css`: The "Wikipedia-like" visual design.
- `app.js`: The "brain" that loads and renders your JSON data.
- `/data`: Your content files (JSON).

## 📝 Adding Content

### 1. Daily Blogs
**File:** `/data/dailyBlogs.json`
Add a new object to the array:
```json
{
  "id": "2026-02-01-my-day",
  "title": "A Productive Sunday",
  "date": "2026-02-01",
  "time": "14:30",
  "content": [
    { "type": "paragraph", "text": "Your text here..." },
    { "type": "image", "url": "https://example.com/photo.jpg", "caption": "Optional caption" }
  ]
}
```

### 2. Thoughts
**File:** `/data/thoughts.json`
```json
{
  "id": "on-longevity",
  "title": "Thoughts on Digital Longevity",
  "date": "2026-02-01",
  "content": [
    { "type": "paragraph", "text": "Writing for the future..." }
  ]
}
```

### 3. Life Incidents
**File:** `/data/lifeIncidents.json`
Life incidents support multiple sections:
```json
{
  "id": "moving-to-the-city",
  "title": "Moving to the City",
  "date": "2024-05-12",
  "sections": [
    {
      "heading": "The Decision",
      "content": [{ "type": "paragraph", "text": "It started with a map..." }]
    },
    {
      "heading": "The Arrival",
      "content": [{ "type": "image", "url": "/images/city.jpg", "caption": "The first view." }]
    }
  ]
}
```

## 🌐 How to View
Since this site uses `fetch()` to load JSON files, it needs to be served by a local server (most browsers block local file fetching for security).

**Easiest methods:**
1. **VS Code:** Install "Live Server" extension and click "Go Live".
2. **Terminal (Python):** `python -m http.server 8000`
3. **Terminal (NPM):** `npx serve .`

## 💡 Pro Tips
- **URLs:** The site uses "Hash Routing". To share a link, use `index.html#/blog/your-id`.
- **Images:** Place local images in an `images` folder and reference them as `./images/photo.jpg`.
- **Longevity:** Because this is vanilla JS, it will work in any modern browser for decades without needing specialized build tools.
