/**
 * Living Archive - Main Application Logic
 * Vanilla JS Version
 */

const App = {
    // State
    data: {
        dailyBlogs: [],
        thoughts: [],
        lifeIncidents: []
    },

    // Auth & CMS States
    cmsState: {
        isEditing: false,
        editingId: null,
        editingType: 'blog',
        postData: null
    },

    // Dynamic SEO Management
    updateSEO(title, description, ogImage = null, itemType = 'website', date = null) {
        const fullTitle = `${title} | Sayan Maity Archive`;
        document.title = fullTitle;

        // 1. Standard Description Meta Tag
        let descMeta = document.querySelector('meta[name="description"]');
        if (!descMeta) {
            descMeta = document.createElement('meta');
            descMeta.name = "description";
            document.head.appendChild(descMeta);
        }
        descMeta.content = description;

        // 2. Canonical Link Tag
        const canonicalUrl = window.location.href.split('?')[0].split('#:~:text=')[0];
        let canonicalLink = document.getElementById('seo-canonical');
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.id = "seo-canonical";
            canonicalLink.rel = "canonical";
            document.head.appendChild(canonicalLink);
        }
        canonicalLink.href = canonicalUrl;

        // 3. Open Graph Tags
        const ogTags = {
            'og:title': fullTitle,
            'og:description': description,
            'og:type': itemType === 'article' ? 'article' : 'website',
            'og:url': canonicalUrl,
            'og:site_name': 'Sayan Maity Archive'
        };

        if (ogImage) {
            ogTags['og:image'] = ogImage;
        } else {
            // Default fallback image
            ogTags['og:image'] = 'https://images.unsplash.com/photo-1547082299-de196ea013d6';
        }

        for (const [property, content] of Object.entries(ogTags)) {
            let meta = document.querySelector(`meta[property="${property}"]`);
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('property', property);
                document.head.appendChild(meta);
            }
            meta.content = content;
        }

        // 4. Twitter Card Tags
        const twitterTags = {
            'twitter:card': 'summary_large_image',
            'twitter:title': fullTitle,
            'twitter:description': description,
            'twitter:image': ogTags['og:image']
        };

        for (const [name, content] of Object.entries(twitterTags)) {
            let meta = document.querySelector(`meta[name="${name}"]`);
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = name;
                document.head.appendChild(meta);
            }
            meta.content = content;
        }

        // 5. JSON-LD Dynamic Schema Markup
        let script = document.getElementById('seo-jsonld');
        if (script) {
            script.remove();
        }

        let schema = {
            "@context": "https://schema.org",
            "@type": itemType === 'article' ? "BlogPosting" : "WebSite",
            "name": fullTitle,
            "description": description,
            "url": canonicalUrl,
            "author": {
                "@type": "Person",
                "name": "Sayan Maity"
            }
        };

        if (itemType === 'article') {
            schema.headline = title;
            schema.datePublished = date || new Date().toISOString().split('T')[0];
            schema.mainEntityOfPage = {
                "@type": "WebPage",
                "@id": canonicalUrl
            };
            if (ogTags['og:image']) {
                schema.image = ogTags['og:image'];
            }
        } else if (itemType === 'collection') {
            schema = {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "name": fullTitle,
                "description": description,
                "url": canonicalUrl,
                "author": {
                    "@type": "Person",
                    "name": "Sayan Maity"
                }
            };
        }

        script = document.createElement('script');
        script.id = 'seo-jsonld';
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
    },

    // Initialization
    async init() {
        // Prevent browser from restoring scroll position
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }

        window.addEventListener('hashchange', () => this.router());

        // Theme init
        this.initTheme();

        // Context menu init
        this.initContextMenu();

        // Initialize Firebase bridge
        const fbInitialized = ArchiveDB.init();

        // Listen for authentication changes
        if (fbInitialized) {
            ArchiveDB.onAuthStateChanged(user => {
                this.updateAuthUI(user);
                // Refresh bookmark/cms view upon auth changes
                const hash = window.location.hash || '#/';
                if (hash === '#/bookmarks' || hash === '#/cms') {
                    this.router();
                }
            });
        }

        await this.loadAllData();
        this.router();

        // Init Icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    // Theme Logic
    initTheme() {
        // Toggle Buttons (Desktop & Mobile)
        const toggles = [
            document.getElementById('theme-toggle'),
            document.getElementById('mobile-theme-toggle')
        ];
        const root = document.documentElement;

        // Check saved preference
        const savedTheme = localStorage.getItem('theme') || 'light';
        root.setAttribute('data-theme', savedTheme);

        toggles.forEach(toggle => {
            if (toggle) {
                toggle.addEventListener('click', () => {
                    const current = root.getAttribute('data-theme');
                    const next = current === 'light' ? 'dark' : 'light';
                    root.setAttribute('data-theme', next);
                    localStorage.setItem('theme', next);
                });
            }
        });
    },


    // Custom Context Menu
    initContextMenu() {
        // Create Menu Element
        const menu = document.createElement('div');
        menu.className = 'custom-context-menu';
        document.body.appendChild(menu);

        // Hide menu on click outside
        document.addEventListener('click', () => {
            menu.classList.remove('visible');
        });

        // Hide menu on scroll
        window.addEventListener('scroll', () => {
            menu.classList.remove('visible');
        }, { passive: true });


        // Helper function for safe copying
        const safeCopy = (text, successMessage) => {
            // Try Modern API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => this.showToast(successMessage))
                    .catch(e => fallbackCopy(text, successMessage));
            } else {
                fallbackCopy(text, successMessage);
            }
        };

        const fallbackCopy = (text, successMessage) => {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;

                // Ensure it's not visible but part of DOM
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);

                textArea.focus();
                textArea.select();

                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (successful) {
                    this.showToast(successMessage);
                } else {
                    console.error('Fallback copy failed');
                }
            } catch (err) {
                console.error('Fallback copy error', err);
            }
        };


        // Handle Right Click
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            const selection = window.getSelection().toString();
            const hasSelection = selection.length > 0;

            let items = [];

            if (hasSelection) {
                // SELECTION MENU
                items = [
                    {
                        label: 'Copy Text',
                        icon: 'copy',
                        action: () => safeCopy(selection, 'Text copied to clipboard!')
                    },
                    {
                        label: 'Copy Link to Highlight',
                        icon: 'link',
                        action: () => {
                            const url = window.location.href.split('#:~:text=')[0];
                            const highlightParam = `#:~:text=${encodeURIComponent(selection)}`;
                            safeCopy(url + highlightParam, 'Link to highlight copied!');
                        }
                    }
                ];
            } else {
                // NORMAL MENU
                items = [
                    {
                        label: 'Share this post',
                        icon: 'share-2',
                        action: () => safeCopy(window.location.href, 'Post link copied!')
                    },
                    {
                        label: 'Print Page',
                        icon: 'printer',
                        action: () => {
                            // Nuclear Print: Clone content to a dedicated top-level container
                            const existing = document.getElementById('print-area');
                            if (existing) existing.remove();

                            const printArea = document.createElement('div');
                            printArea.id = 'print-area';

                            // Find the main article content (h1 is a good indicator)
                            // We look for 'article' tag which is used in renderArticle
                            const article = document.querySelector('article');

                            if (article) {
                                printArea.innerHTML = article.innerHTML;
                                document.body.appendChild(printArea);
                                window.print();
                                // Cleanup happens automatically when print dialog closes OR if user cancels
                                // But for safety we can leave it (it's hidden by CSS in normal view)
                                // or remove it after a delay
                                setTimeout(() => printArea.remove(), 1000);
                            } else {
                                // Fallback for pages without article tag (like home)
                                window.print();
                            }
                        }
                    },
                    {
                        label: 'Reload Page',
                        icon: 'refresh-cw',
                        action: () => window.location.reload()
                    },
                    {
                        label: 'Toggle Theme',
                        icon: 'moon',
                        action: () => {
                            const root = document.documentElement;
                            const current = root.getAttribute('data-theme');
                            const next = current === 'light' ? 'dark' : 'light';
                            root.setAttribute('data-theme', next);
                            localStorage.setItem('theme', next);
                        }
                    }
                ];
            }

            // Render Menu Items
            menu.innerHTML = '';
            items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'ctx-menu-item';
                el.innerHTML = `<i data-feather="${item.icon}"></i><span>${item.label}</span>`;
                el.onclick = () => {
                    item.action();
                    menu.classList.remove('visible');
                };
                menu.appendChild(el);
            });

            // Initialize Icons
            if (typeof feather !== 'undefined') feather.replace();

            // Position Menu
            const x = e.clientX;
            const y = e.clientY;

            // Boundary checks
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            const menuWidth = 200;
            const menuHeight = items.length * 45; // Approx

            menu.style.left = `${Math.min(x, winWidth - menuWidth)}px`;
            menu.style.top = `${Math.min(y, winHeight - menuHeight)}px`;

            // Show
            menu.classList.add('visible');
        });
    },

    // Toast Notification Helper
    showToast(message) {
        // Create toast if not exists
        let toast = document.querySelector('.toast-popup');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-popup';
            toast.innerHTML = `
                <div class="toast-icon">
                    <i data-feather="check"></i>
                </div>
                <div class="toast-message"></div>
            `;
            document.body.appendChild(toast);

            // Allow time for feather to replace icon
            if (typeof feather !== 'undefined') feather.replace();
        }

        // Update message
        toast.querySelector('.toast-message').textContent = message;

        // Reset icon in case it was modified
        if (typeof feather !== 'undefined') feather.replace();

        // Show
        setTimeout(() => toast.classList.add('visible'), 10);

        // Hide after 2 seconds
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('visible');
        }, 2000);
    },


    // Data Fetching
    async loadAllData() {
        try {
            // Load local JSON fallback data first
            const [localBlogs, localThoughts, localIncidents] = await Promise.all([
                fetch('./data/dailyBlogs.json').then(res => res.json()).catch(() => []),
                fetch('./data/thoughts.json').then(res => res.json()).catch(() => []),
                fetch('./data/lifeIncidents.json').then(res => res.json()).catch(() => [])
            ]);

            let blogs = [...localBlogs];
            let thoughts = [...localThoughts];
            let incidents = [...localIncidents];

            if (ArchiveDB.db) {
                // Proactively seed Firestore collections if empty
                await ArchiveDB.seedFirestoreIfEmpty('blog', localBlogs);
                await ArchiveDB.seedFirestoreIfEmpty('thoughts', localThoughts);
                await ArchiveDB.seedFirestoreIfEmpty('life', localIncidents);

                // Fetch live data from Firestore
                const [fbBlogs, fbThoughts, fbIncidents] = await Promise.all([
                    ArchiveDB.fetchEntries('blog').catch(() => []),
                    ArchiveDB.fetchEntries('thoughts').catch(() => []),
                    ArchiveDB.fetchEntries('life').catch(() => [])
                ]);

                if (fbBlogs.length > 0) blogs = fbBlogs;
                if (fbThoughts.length > 0) thoughts = fbThoughts;
                if (fbIncidents.length > 0) incidents = fbIncidents;
            }

            this.data.dailyBlogs = blogs.sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00')));
            this.data.thoughts = thoughts.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.data.lifeIncidents = incidents.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            console.error('Error loading archive data:', error);
            document.getElementById('app-root').innerHTML = '<p>Error loading content. Please check the JSON files or Firestore database.</p>';
        }
    },


    // Router
    router() {
        const hash = window.location.hash || '#/';
        const root = document.getElementById('app-root');

        // Update Nav Links

        // Update Nav Links (Desktop & Mobile)
        const updateLinks = (selector) => {
            document.querySelectorAll(selector).forEach(a => {
                const linkPath = a.getAttribute('href');
                let isActive = false;

                if (linkPath === '#/' && (hash === '#/' || hash === '')) {
                    isActive = true;
                } else if (linkPath !== '#/' && hash.startsWith(linkPath)) {
                    isActive = true;
                }

                if (isActive) {
                    a.classList.add('active');
                } else {
                    a.classList.remove('active');
                }
            });
        };

        updateLinks('.main-nav a');
        updateLinks('.mobile-link');


        // Content Transition - Fade out
        root.classList.add('fade-out');

        setTimeout(() => {
            // Update content
            if (hash === '#/' || hash === '') {
                this.renderHome(root);
            } else if (hash === '#/blog') {
                this.renderList(root, 'Daily Blogs', this.data.dailyBlogs, 'blog');
            } else if (hash.startsWith('#/blog/')) {
                const id = hash.replace('#/blog/', '');
                this.renderArticle(root, this.data.dailyBlogs.find(b => b.id === id), 'blog');
            } else if (hash === '#/thoughts') {
                this.renderList(root, 'Thoughts', this.data.thoughts, 'thoughts');
            } else if (hash.startsWith('#/thoughts/')) {
                const id = hash.replace('#/thoughts/', '');
                this.renderArticle(root, this.data.thoughts.find(t => t.id === id), 'thoughts');
            } else if (hash === '#/life') {
                this.renderList(root, 'Life Incidents', this.data.lifeIncidents, 'life');
            } else if (hash.startsWith('#/life/')) {
                const id = hash.replace('#/life/', '');
                this.renderLifeIncident(root, this.data.lifeIncidents.find(i => i.id === id));
            } else if (hash === '#/about') {
                this.renderAbout(root);
            } else if (hash === '#/login') {
                this.renderAuth(root);
            } else if (hash === '#/bookmarks') {
                this.renderBookmarks(root);
            } else if (hash === '#/cms') {
                this.renderCMS(root);
            } else {
                root.innerHTML = '<h1>404 Not Found</h1><p class="paragraph">The archive entry you are looking for does not exist.</p>';
            }


            // Scroll main area to top
            const scrollArea = document.getElementById('main-scroll-area');
            if (scrollArea) {
                scrollArea.scrollTop = 0;
            }

            // Re-mount Icons
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

            // Fade in
            setTimeout(() => {
                root.classList.remove('fade-out');
                root.classList.add('fade-in');

                // Force scroll to top again after fade-in (ensures it works on mobile)
                if (scrollArea) {
                    scrollArea.scrollTop = 0;
                    scrollArea.scrollTo(0, 0);
                }
            }, 50);
        }, 200);

    },


    // Renderers
    // Helper: text preview
    getPreviewText(item) {
        let text = '';
        if (item.content && Array.isArray(item.content)) {
            const para = item.content.find(b => b.type === 'paragraph');
            if (para) text = para.text;
        } else if (item.sections && Array.isArray(item.sections)) {
            // Check first section
            const section = item.sections[0];
            if (section && section.content) {
                const para = section.content.find(b => b.type === 'paragraph');
                if (para) text = para.text;
            }
        }
        return text; // Return full text, CSS will truncate
    },

    // Renderers
    renderHome(container) {
        this.updateSEO(
            "The Archive • Records of Mind, Time, and Narrative",
            "A personal digital repository of stories, daily journals, thoughts, and life timeline memories by Sayan Maity. Developed for longevity and clarity.",
            "https://images.unsplash.com/photo-1547082299-de196ea013d6",
            "website"
        );

        // Get featured entries (manually selected with featured: true flag)
        const allEntries = [
            ...this.data.dailyBlogs.map(b => ({ ...b, type: 'blog' })),
            ...this.data.thoughts.map(t => ({ ...t, type: 'thoughts' }))
        ];

        // Filter only featured entries
        const featured = allEntries.filter(entry => entry.featured === true);

        // Sort featured entries by date descending to highlight the newest
        featured.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Separate into Primary Hero and Subgrid
        const heroEntry = featured[0] || null;
        const subGridEntries = featured.slice(1);

        let html = `
            <div class="homepage-hero">
                <h1>The Archive.</h1>
                <div class="meta">RECORDS OF MIND, TIME, AND NARRATIVE • BY SAYAN MAITY</div>
            </div>
            
            ${heroEntry ? `
                <h2 style="margin-bottom: 1.5rem; font-size: 1.3rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-text); font-weight: 600; border: none; padding-bottom: 0;">
                    <i data-feather="star" style="width: 16px; height: 16px; fill: #f59e0b; stroke: #f59e0b; vertical-align: middle; margin-right: 0.4rem;"></i>
                    Featured Writing
                </h2>
                
                <!-- Primary Featured Hero Card -->
                ${(() => {
                    let imageUrl = null;
                    if (heroEntry.content && Array.isArray(heroEntry.content)) {
                        const imageBlock = heroEntry.content.find(b => b.type === 'image');
                        if (imageBlock) imageUrl = imageBlock.url;
                    }
                    const preview = this.getPreviewText(heroEntry);
                    return `
                        <a href="#/${heroEntry.type}/${heroEntry.id}" class="featured-hero-card">
                            <div class="hero-card-image" style="${!imageUrl ? 'display: none;' : ''}">
                                ${imageUrl ? `<img src="${imageUrl}" alt="${heroEntry.title}" loading="lazy">` : ''}
                            </div>
                            <div class="hero-card-content" style="${!imageUrl ? 'grid-column: span 2;' : ''}">
                                <p class="card-date" style="margin-bottom: 0.5rem; font-weight:600; color: var(--link-color);">${heroEntry.date} • ${heroEntry.type === 'blog' ? 'DAILY BLOG' : 'THOUGHT'}</p>
                                <h3>${heroEntry.title}</h3>
                                <p class="card-preview" style="font-family: var(--font-serif); opacity: 0.85; margin: 0; display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; font-size:1.05rem;">${preview}</p>
                            </div>
                        </a>
                    `;
                })()}
                
                <!-- Secondary Featured Subgrid -->
                ${subGridEntries.length > 0 ? `
                    <div class="featured-subgrid">
                        ${subGridEntries.map(entry => {
                            let imageUrl = null;
                            if (entry.content && Array.isArray(entry.content)) {
                                const imageBlock = entry.content.find(b => b.type === 'image');
                                if (imageBlock) imageUrl = imageBlock.url;
                            }
                            const preview = this.getPreviewText(entry);
                            return `
                                <a href="#/${entry.type}/${entry.id}" class="featured-subcard">
                                    <div class="subcard-image" style="${!imageUrl ? 'display: none;' : ''}">
                                        ${imageUrl ? `<img src="${imageUrl}" alt="${entry.title}" loading="lazy">` : ''}
                                    </div>
                                    <div class="subcard-content">
                                        <p class="card-date" style="margin-bottom: 0.3rem; font-weight:600; color: var(--link-color); font-size:0.75rem;">${entry.date} • ${entry.type === 'blog' ? 'BLOG' : 'THOUGHT'}</p>
                                        <h4>${entry.title}</h4>
                                        <p class="subcard-preview">${preview}</p>
                                    </div>
                                </a>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            ` : ''}

            <h2 style="margin-top: 3rem; margin-bottom: 1rem; font-size: 1.3rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-text); font-weight: 600; border: none; padding-bottom: 0;">Quick Access Portals</h2>
            <div class="quick-access-strip">
                <a href="#/blog" class="portal-link">
                    <span class="portal-num">${this.data.dailyBlogs.length}</span>
                    <div class="portal-label">
                        <span>Daily Blogs</span>
                        <i data-feather="arrow-right"></i>
                    </div>
                </a>
                <a href="#/thoughts" class="portal-link">
                    <span class="portal-num">${this.data.thoughts.length}</span>
                    <div class="portal-label">
                        <span>Thoughts</span>
                        <i data-feather="arrow-right"></i>
                    </div>
                </a>
                <a href="#/life" class="portal-link">
                    <span class="portal-num">${this.data.lifeIncidents.length}</span>
                    <div class="portal-label">
                        <span>Life Incidents</span>
                        <i data-feather="arrow-right"></i>
                    </div>
                </a>
            </div>

            <h2 style="margin-top: 3rem; margin-bottom: 1rem; font-size: 1.3rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-text); font-weight: 600; border: none; padding-bottom: 0;">About</h2>
            <p class="paragraph" style="text-align: justify; line-height: 1.6; font-size: 1.15rem;">This space is designed for longevity. It is simple, static, and focused entirely on the clarity of content. No trackers, no noise, just memories stored in structured JSON and secured dynamically using Cloud Firestore.</p>
        `;
        container.innerHTML = html;
        if (typeof feather !== 'undefined') feather.replace();
    },

    renderList(container, title, items, type) {
        this.updateSEO(
            title,
            `Discover ${items.length} total entries and records compiled in Sayan Maity's personal ${title.toLowerCase()} collection.`,
            null,
            "collection"
        );

        let html = `
            <h1>${title}</h1>
            <p class="meta">${items.length} total entries discovered in the archive.</p>
            <ul class="list-view">
                ${items.map(item => `
                    <li class="list-item">
                        <div class="list-header">
                            <h3><a href="#/${type}/${item.id}">${item.title}</a></h3>
                            <div class="date-time">${item.date}${item.time ? ' — ' + item.time : ''}</div>
                        </div>
                        <p class="list-preview">${this.getPreviewText(item)}</p>
                    </li>
                `).join('')}
            </ul>
        `;
        container.innerHTML = html;
    },


    renderArticle(container, entry, type) {
        if (!entry) return container.innerHTML = '<h1>Not Found</h1>';

        // Extract description preview and first image
        const preview = this.getPreviewText(entry) || "A writing entry in the personal archive of Sayan Maity.";
        let imageUrl = null;
        if (entry.content && Array.isArray(entry.content)) {
            const imageBlock = entry.content.find(b => b.type === 'image');
            if (imageBlock) imageUrl = imageBlock.url;
        }

        this.updateSEO(
            entry.title,
            preview,
            imageUrl,
            "article",
            entry.date
        );

        // Get suggestions (other entries from the same type)
        const allEntries = type === 'blog' ? this.data.dailyBlogs : this.data.thoughts;
        const suggestions = allEntries
            .filter(e => e.id !== entry.id)
            .slice(0, 3);

        let html = `
            <article>
                <h1>${entry.title}</h1>
                <div class="meta">ARCHIVED • ${entry.date}${entry.time ? ' • ' + entry.time : ''} • SAYAN MAITY</div>
                
                <div class="interaction-bar" id="interaction-${entry.id}">
                    <button class="interaction-btn" id="like-btn-${entry.id}" disabled onclick="App.handleLike('${entry.id}', '${type}')">
                        <i data-feather="heart"></i>
                        <span>Likes (<span id="like-count-${entry.id}">${entry.likesCount || 0}</span>)</span>
                    </button>
                    <button class="interaction-btn" id="save-btn-${entry.id}" disabled onclick="App.handleSave('${entry.id}', '${type}')">
                        <i data-feather="bookmark"></i>
                        <span>Save Entry</span>
                    </button>
                    ${ArchiveDB.isAdmin() ? `
                        <button class="inline-delete-btn" onclick="App.handleAdminDelete('${entry.id}', '${type}')">
                            <i data-feather="trash-2"></i>
                            Delete Entry
                        </button>
                    ` : ''}
                </div>

                ${this.renderBlocks(entry.content)}
                
                <!-- AI Facts Panel -->
                <div id="ai-facts-container-${entry.id}"></div>
                
                ${suggestions.length > 0 ? `
                    <div class="suggestions-section">
                        <h3>
                            <i data-feather="compass"></i>
                            Continue Reading
                        </h3>
                        <div class="suggestions-grid">
                            ${suggestions.map(item => `
                                <a href="#/${type}/${item.id}" class="suggestion-card">
                                    <h4>${item.title}</h4>
                                    <p class="suggestion-date">${item.date}</p>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="article-footer">
                    <a href="#/${type}">
                        <i data-feather="arrow-left"></i>
                        Return to ${type === 'blog' ? 'Daily Blogs' : 'Thoughts'}
                    </a>
                </div>
            </article>
        `;
        container.innerHTML = html;
        
        // Asynchronously load actual database interaction states
        this.loadInteractionStates(entry.id, type);
        
        // Asynchronously load AI insights and facts
        this.loadAIFactsState(entry, type);

        if (typeof feather !== 'undefined') feather.replace();
    },

    renderLifeIncident(container, entry) {
        if (!entry) return container.innerHTML = '<h1>Not Found</h1>';

        // Extract description preview and first image
        const preview = this.getPreviewText(entry) || "A timeline event entry in Sayan Maity's Life Incidents archive.";
        let imageUrl = null;
        if (entry.sections && Array.isArray(entry.sections)) {
            const section = entry.sections.find(s => s.content && Array.isArray(s.content));
            if (section) {
                const imageBlock = section.content.find(b => b.type === 'image');
                if (imageBlock) imageUrl = imageBlock.url;
            }
        }

        this.updateSEO(
            entry.title,
            preview,
            imageUrl,
            "article",
            entry.date
        );

        // Get suggestions (other life incidents)
        const suggestions = this.data.lifeIncidents
            .filter(e => e.id !== entry.id)
            .slice(0, 3);

        let html = `
            <article>
                <h1>${entry.title}</h1>
                <div class="meta">TIMELINE EVENT • ${entry.date} • SAYAN MAITY</div>
                
                <div class="interaction-bar" id="interaction-${entry.id}">
                    <button class="interaction-btn" id="like-btn-${entry.id}" disabled onclick="App.handleLike('${entry.id}', 'life')">
                        <i data-feather="heart"></i>
                        <span>Likes (<span id="like-count-${entry.id}">${entry.likesCount || 0}</span>)</span>
                    </button>
                    <button class="interaction-btn" id="save-btn-${entry.id}" disabled onclick="App.handleSave('${entry.id}', 'life')">
                        <i data-feather="bookmark"></i>
                        <span>Save Entry</span>
                    </button>
                    ${ArchiveDB.isAdmin() ? `
                        <button class="inline-delete-btn" onclick="App.handleAdminDelete('${entry.id}', 'life')">
                            <i data-feather="trash-2"></i>
                            Delete Entry
                        </button>
                    ` : ''}
                </div>

                ${entry.sections.map(section => `
                    <section>
                        <h2>${section.heading}</h2>
                        ${this.renderBlocks(section.content)}
                    </section>
                `).join('')}
                
                <!-- AI Facts Panel -->
                <div id="ai-facts-container-${entry.id}"></div>
                
                ${suggestions.length > 0 ? `
                    <div class="suggestions-section">
                        <h3>
                            <i data-feather="compass"></i>
                            More Life Incidents
                        </h3>
                        <div class="suggestions-grid">
                            ${suggestions.map(item => `
                                <a href="#/life/${item.id}" class="suggestion-card">
                                    <h4>${item.title}</h4>
                                    <p class="suggestion-date">${item.date}</p>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="article-footer">
                    <a href="#/life">
                        <i data-feather="arrow-left"></i>
                        Return to Life Incidents
                    </a>
                </div>
            </article>
        `;
        container.innerHTML = html;
        
        // Asynchronously load actual database interaction states
        this.loadInteractionStates(entry.id, 'life');
        
        // Asynchronously load AI insights and facts
        this.loadAIFactsState(entry, 'life');

        if (typeof feather !== 'undefined') feather.replace();
    },

    renderBlocks(blocks) {
        return blocks.map(block => {
            if (block.type === 'paragraph') {
                return `<p class="paragraph">${block.text}</p>`;
            } else if (block.type === 'image') {
                return `
                    <figure class="image-container">
                        <img src="${block.url}" alt="${block.caption || ''}" loading="lazy">
                        ${block.caption ? `<figcaption class="caption">${block.caption}</figcaption>` : ''}
                    </figure>
                `;
            } else if (block.type === 'equation') {
                return `
                    <div class="equation-block">
                        <code class="equation">${block.latex}</code>
                        ${block.caption ? `<p class="equation-caption">${block.caption}</p>` : ''}
                    </div>
                `;
            } else if (block.type === 'table') {
                return `
                    <div class="table-container">
                        <table class="data-table">
                            ${block.headers ? `
                                <thead>
                                    <tr>
                                        ${block.headers.map(h => `<th>${h}</th>`).join('')}
                                    </tr>
                                </thead>
                            ` : ''}
                            <tbody>
                                ${block.rows.map(row => `
                                    <tr>
                                        ${row.map(cell => `<td>${cell}</td>`).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${block.caption ? `<p class="table-caption">${block.caption}</p>` : ''}
                    </div>
                `;
            } else if (block.type === 'chart') {
                if (block.chartType === 'bar' || block.chartType === 'line') {
                    return this.renderBarChart(block);
                } else if (block.chartType === 'pie') {
                    return this.renderPieChart(block);
                }
            }
            return '';
        }).join('');
    },

    renderBarChart(block) {
        const maxValue = Math.max(...block.data.map(d => d.value));
        return `
            <div class="chart-container">
                <div class="chart ${block.chartType}-chart">
                    ${block.data.map(item => `
                        <div class="chart-bar">
                            <div class="bar-fill" style="height: ${(item.value / maxValue) * 100}%">
                                <span class="bar-value">${item.value}</span>
                            </div>
                            <span class="bar-label">${item.label}</span>
                        </div>
                    `).join('')}
                </div>
                ${block.caption ? `<p class="chart-caption">${block.caption}</p>` : ''}
            </div>
        `;
    },

    renderPieChart(block) {
        const total = block.data.reduce((sum, d) => sum + d.value, 0);
        let currentAngle = 0;
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

        const segments = block.data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (item.value / total) * 360;
            const startAngle = currentAngle;
            currentAngle += angle;

            return {
                ...item,
                percentage: percentage.toFixed(1),
                color: colors[index % colors.length],
                startAngle,
                angle
            };
        });

        return `
            <div class="chart-container">
                <div class="pie-chart-wrapper">
                    <svg class="pie-chart" viewBox="0 0 200 200">
                        ${segments.map(seg => {
            const x1 = 100 + 90 * Math.cos((seg.startAngle - 90) * Math.PI / 180);
            const y1 = 100 + 90 * Math.sin((seg.startAngle - 90) * Math.PI / 180);
            const x2 = 100 + 90 * Math.cos((seg.startAngle + seg.angle - 90) * Math.PI / 180);
            const y2 = 100 + 90 * Math.sin((seg.startAngle + seg.angle - 90) * Math.PI / 180);
            const largeArc = seg.angle > 180 ? 1 : 0;

            return `
                                <path d="M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z"
                                      fill="${seg.color}" stroke="var(--bg-color)" stroke-width="2"/>
                            `;
        }).join('')}
                    </svg>
                    <div class="pie-legend">
                        ${segments.map(seg => `
                            <div class="legend-item">
                                <span class="legend-color" style="background-color: ${seg.color}"></span>
                                <span class="legend-label">${seg.label}: ${seg.percentage}%</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ${block.caption ? `<p class="chart-caption">${block.caption}</p>` : ''}
            </div>
        `;
    },

    renderAbout(container) {
        this.updateSEO(
            "About Sayan Maity • Philosophy & Biography",
            "Learn about the philosophy behind the Living Archive, digital preservation, memory storage, and the personal journey of developer Sayan Maity.",
            "https://images.unsplash.com/photo-1547082299-de196ea013d6",
            "website"
        );

        container.innerHTML = `
            <article>
                <h1>About Me & This Space</h1>
                
                <h2>Why I Write</h2>
                <p class="paragraph">I started this archive because I was tired of shouting into the void. Social media felt like a performance—every post carefully curated, every thought filtered through the lens of "what will people think?" I wanted a place that was just <em>mine</em>. A quiet corner of the internet where I could think out loud without algorithms deciding who gets to see it.</p>
                
                <p class="paragraph">Writing helps me make sense of the chaos. Some days, it's just mundane observations about coffee and code. Other days, it's deeper—questions about life, purpose, the things that keep me up at night. This archive is my way of capturing those moments before they slip away.</p>
                
                <h2>What You'll Find Here</h2>
                <p class="paragraph">This isn't a polished portfolio or a carefully branded blog. It's messy, honest, and human. You'll find:</p>
                <ul class="paragraph" style="margin-left: 2rem; margin-top: 1rem;">
                    <li><strong>Daily Blogs</strong> — Small moments, random thoughts, the texture of everyday life</li>
                    <li><strong>Thoughts</strong> — Longer reflections on ideas that won't leave me alone</li>
                    <li><strong>Life Incidents</strong> — The big moments, the turning points, the stories I want to remember</li>
                </ul>
                
                <h2>A Little About Me</h2>
                <p class="paragraph">I'm someone who thinks too much and feels even more. I love the quiet hours of the morning when the world is still asleep. I believe in the power of simple things—a good cup of coffee, a well-written sentence, a conversation that makes you see the world differently.</p>
                
                <p class="paragraph">I'm not trying to build an audience or go viral. I'm just trying to be present. To notice. To remember. Because life moves fast, and if we don't write it down, it disappears.</p>
                
                <h2>Why It Looks Like This</h2>
                <p class="paragraph">This site is intentionally simple. No ads, no tracking, no distractions. Just words on a page. I wanted something that would last—something I could still read 20 years from now without worrying about broken plugins or deprecated frameworks.</p>
                
                <p class="paragraph">It's built with plain HTML, CSS, and JSON files. No database, no server-side complexity. Just files on a computer. The way the web used to be.</p>
                
                <h2>If You're Reading This</h2>
                <p class="paragraph">Thank you. Whether you stumbled here by accident or came looking for something specific, I'm glad you're here. Feel free to explore, read what resonates, and leave what doesn't.</p>
                
                <p class="paragraph">And if something I wrote made you think, made you feel, or just made you pause for a moment—that's enough. That's everything.</p>
                
                <p class="paragraph" style="margin-top: 3rem; font-style: italic; opacity: 0.7;">— Written with intention, archived with care.</p>
            </article>
        `;
    },

    // --- AUTH DYNAMIC UI & METHODS ---
    updateAuthUI(user) {
        const bookmarksLi = document.getElementById('nav-bookmarks-li');
        const cmsLi = document.getElementById('nav-cms-li');
        const authBtn = document.getElementById('nav-auth-btn');

        const mBookmarksBtn = document.getElementById('mobile-bookmarks-btn');
        const mCmsBtn = document.getElementById('mobile-cms-btn');
        const mAuthBtn = document.getElementById('mobile-auth-btn');

        if (user) {
            if (bookmarksLi) bookmarksLi.classList.remove('hidden');
            if (mBookmarksBtn) mBookmarksBtn.classList.remove('hidden');

            if (ArchiveDB.isAdmin()) {
                if (cmsLi) cmsLi.classList.remove('hidden');
                if (mCmsBtn) mCmsBtn.classList.remove('hidden');
            } else {
                if (cmsLi) cmsLi.classList.add('hidden');
                if (mCmsBtn) mCmsBtn.classList.add('hidden');
            }

            if (authBtn) {
                authBtn.innerHTML = `<i data-feather="user"></i><span>Profile</span>`;
            }
            if (mAuthBtn) {
                mAuthBtn.innerHTML = `
                    <span class="m-icon"><i data-feather="user"></i></span>
                    <span class="m-label">Profile</span>
                `;
            }
        } else {
            if (bookmarksLi) bookmarksLi.classList.add('hidden');
            if (cmsLi) cmsLi.classList.add('hidden');
            if (mBookmarksBtn) mBookmarksBtn.classList.add('hidden');
            if (mCmsBtn) mCmsBtn.classList.add('hidden');

            if (authBtn) {
                authBtn.innerHTML = `<i data-feather="user"></i><span>Login</span>`;
            }
            if (mAuthBtn) {
                mAuthBtn.innerHTML = `
                    <span class="m-icon"><i data-feather="user"></i></span>
                    <span class="m-label">Login</span>
                `;
            }
        }

        if (typeof feather !== 'undefined') feather.replace();
    },

    renderSkeleton(container) {
        container.innerHTML = `
            <div class="skeleton-container">
                <div class="skeleton-title"></div>
                <div class="skeleton-meta"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
                <div class="skeleton-image"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
            </div>
        `;
    },

    renderAuth(container) {
        this.updateSEO(
            "Portal Sign In / Reader Profile",
            "Access the secure administrative portal or sign in to your reader account to view bookmarks and interactive logs.",
            null,
            "website"
        );

        const user = ArchiveDB.getCurrentUser();
        if (user) {
            const isAdmin = ArchiveDB.isAdmin();
            const creationTime = user.metadata.creationTime 
                ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) 
                : 'N/A';
            
            container.innerHTML = `
                <article class="profile-page">
                    <h1>My Profile</h1>
                    <div class="meta">ARCHIVE IDENTITY CARD • SECURED IDENTITY PORTAL</div>
                    
                    <div class="profile-card-premium">
                        <div class="profile-avatar">
                            <i data-feather="user"></i>
                        </div>
                        <div class="profile-info-block">
                            <div class="profile-detail">
                                <span class="detail-label">Email Address</span>
                                <span class="detail-value" style="font-family: var(--font-sans); font-weight:500;">${user.email}</span>
                            </div>
                            <div class="profile-detail">
                                <span class="detail-label">Privilege Level</span>
                                <span class="detail-value ${isAdmin ? 'status-admin' : 'status-reader'}">
                                    ${isAdmin ? 'Administrator' : 'Verified Reader'}
                                </span>
                            </div>
                            <div class="profile-detail">
                                <span class="detail-label">User ID (UID)</span>
                                <span class="detail-value" style="font-size:0.85rem; opacity:0.8; font-family:monospace; word-break:break-all;">${user.uid}</span>
                            </div>
                            <div class="profile-detail">
                                <span class="detail-label">Account Created</span>
                                <span class="detail-value" style="font-size:0.95rem; opacity:0.8;">${creationTime}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 3rem; display: flex; gap: 1.2rem; flex-wrap: wrap;">
                        <button class="cms-btn cms-btn-danger" onclick="App.handleLogout()" style="padding: 0.8rem 2.2rem; font-size: 0.95rem;">
                            <i data-feather="log-out"></i>
                            Sign Out / End Session
                        </button>
                        ${isAdmin ? `
                            <button class="cms-btn cms-btn-primary" onclick="window.location.hash = '#/cms'" style="padding: 0.8rem 2.2rem; font-size: 0.95rem;">
                                <i data-feather="settings"></i>
                                Open CMS Dashboard
                            </button>
                        ` : `
                            <button class="cms-btn cms-btn-secondary" onclick="window.location.hash = '#/bookmarks'" style="padding: 0.8rem 2.2rem; font-size: 0.95rem;">
                                <i data-feather="bookmark"></i>
                                View My Bookmarks
                            </button>
                        `}
                    </div>
                </article>
            `;
            if (typeof feather !== 'undefined') feather.replace();
            return;
        }

        const isSignUp = this.cmsState.authSignUpMode || false;

        container.innerHTML = `
            <div class="auth-container">
                <div class="auth-header">
                    <h2>Living Archive Auth</h2>
                    <p>${isSignUp ? 'Create a reader account to save & like blogs' : 'Sign in to save and like your favorite posts'}</p>
                </div>
                <div class="auth-error" id="auth-error-msg"></div>
                <form id="auth-form" onsubmit="App.handleEmailAuth(event)">
                    <div class="auth-form-group">
                        <label for="auth-email">Email Address</label>
                        <input type="email" id="auth-email" class="auth-input" placeholder="you@example.com" required>
                    </div>
                    <div class="auth-form-group">
                        <label for="auth-password">Password</label>
                        <input type="password" id="auth-password" class="auth-input" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="auth-btn" id="auth-submit-btn">${isSignUp ? 'Sign Up' : 'Sign In'}</button>
                </form>
                
                <div class="auth-divider">or</div>
                
                <button class="auth-btn-google" onclick="App.handleGoogleAuth()">
                    <svg viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                </button>
                
                <div class="auth-toggle-link">
                    <span id="auth-toggle-text">${isSignUp ? 'Already have an account?' : "Don't have an account?"}</span>
                    <a href="javascript:void(0)" onclick="App.toggleAuthMode()" id="auth-toggle-btn">${isSignUp ? 'Sign In' : 'Sign Up'}</a>
                </div>
            </div>
        `;
    },

    toggleAuthMode() {
        this.cmsState.authSignUpMode = !(this.cmsState.authSignUpMode || false);
        this.renderAuth(document.getElementById('app-root'));
    },

    async handleLogout() {
        try {
            await ArchiveDB.signOut();
            this.showToast("Signed out successfully.");
            window.location.hash = '#/';
        } catch (error) {
            console.error("Signout error:", error);
            this.showToast("Signout failed.");
        }
    },

    async handleGoogleAuth() {
        try {
            await ArchiveDB.signInWithGoogle();
            this.showToast("Signed in with Google.");
            window.location.hash = '#/';
        } catch (error) {
            console.error("Google Auth error:", error);
            this.showToast("Google Authentication failed.");
        }
    },

    async handleEmailAuth(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const errDiv = document.getElementById('auth-error-msg');
        const submitBtn = document.getElementById('auth-submit-btn');

        if (errDiv) errDiv.style.display = 'none';
        submitBtn.disabled = true;

        const isSignUp = this.cmsState.authSignUpMode || false;

        try {
            if (isSignUp) {
                await ArchiveDB.signUpWithEmail(email, password);
                this.showToast("Account created successfully!");
            } else {
                await ArchiveDB.signInWithEmail(email, password);
                this.showToast("Signed in successfully!");
            }
            window.location.hash = '#/';
        } catch (error) {
            console.error("Auth error:", error);
            if (errDiv) {
                errDiv.textContent = error.message;
                errDiv.style.display = 'block';
            }
        } finally {
            submitBtn.disabled = false;
        }
    },

    // --- BOOKMARKS VIEW ---
    async renderBookmarks(container) {
        this.updateSEO(
            "My Saved Bookmarks",
            "View and browse all your saved journals, articles, and incident entries in one place.",
            null,
            "website"
        );

        if (!ArchiveDB.currentUser) {
            container.innerHTML = `
                <div class="auth-container" style="text-align: center;">
                    <h2>Sign In Required</h2>
                    <p style="margin-bottom: 2rem; color: var(--muted-text);">Please authenticate to view your bookmarks.</p>
                    <button class="auth-btn" onclick="window.location.hash = '#/login'">Sign In</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <h1>Saved Bookmarks</h1>
            <p class="meta">Entries saved by you for quick reference.</p>
            <div id="bookmarks-list-area">
                <div class="skeleton-container">
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                </div>
            </div>
        `;

        try {
            const saved = await ArchiveDB.fetchSavedEntries();
            const listArea = document.getElementById('bookmarks-list-area');
            if (!listArea) return;

            if (saved.length === 0) {
                listArea.outerHTML = `
                    <div class="bookmarks-empty">
                        <i data-feather="bookmark"></i>
                        <p style="font-size: 1.1rem; font-weight: 500; margin-bottom: 0.5rem;">No Bookmarks Saved Yet</p>
                        <p style="font-size: 0.9rem;">Click the bookmark button on any article to save it here.</p>
                    </div>
                `;
                if (typeof feather !== 'undefined') feather.replace();
                return;
            }

            let html = `
                <ul class="list-view">
                    ${saved.map(item => `
                        <li class="list-item">
                            <div class="list-header">
                                <h3><a href="#/${item.entryType}/${item.id}">${item.title}</a></h3>
                                <div class="date-time">
                                    <span style="font-weight: 600; text-transform: uppercase; font-size: 0.75rem; color: var(--link-color); margin-right: 0.8rem;">
                                        ${item.entryType === 'blog' ? 'Blog' : (item.entryType === 'thoughts' ? 'Thought' : 'Incident')}
                                    </span>
                                    ${item.date}${item.time ? ' — ' + item.time : ''}
                                </div>
                            </div>
                            <p class="list-preview">${this.getPreviewText(item)}</p>
                        </li>
                    `).join('')}
                </ul>
            `;
            listArea.outerHTML = html;
        } catch (error) {
            console.error("Error loading bookmarks list:", error);
            const listArea = document.getElementById('bookmarks-list-area');
            if (listArea) listArea.innerHTML = '<p>Error loading saved articles.</p>';
        }
    },

    // --- CMS BACKEND VIEW ---
    renderCMS(container) {
        this.updateSEO(
            "Admin CMS Dashboard",
            "Administrative interface for Sayan Maity to create, edit, delete, and feature posts.",
            null,
            "website"
        );

        if (!ArchiveDB.isAdmin()) {
            container.innerHTML = `
                <div class="auth-container" style="text-align: center;">
                    <h2>Access Denied</h2>
                    <p style="margin-bottom: 2rem; color: var(--muted-text);">CMS access is strictly restricted to the administrator.</p>
                    <button class="auth-btn" onclick="window.location.hash = '#/'">Return Home</button>
                </div>
            `;
            return;
        }

        if (this.cmsState && this.cmsState.isEditing) {
            this.renderCMSForm(container);
            return;
        }

        container.innerHTML = `
            <div class="cms-layout">
                <div class="cms-header">
                    <h2>Admin CMS Dashboard</h2>
                    <button class="cms-btn cms-btn-primary" onclick="App.handleCMSNewPost()">
                        <i data-feather="plus"></i>
                        New Entry
                    </button>
                </div>
                
                <div class="cms-post-list">
                    <h3 style="font-size: 0.9rem; text-transform: uppercase; color: var(--muted-text); margin-bottom: 0.5rem; letter-spacing: 0.05em;">All Entries</h3>
                    <div id="cms-entries-container">
                        <div class="loading-state">Loading dashboard entries...</div>
                    </div>
                </div>
            </div>
        `;

        this.loadCMSList();
    },

    loadCMSList() {
        const container = document.getElementById('cms-entries-container');
        if (!container) return;

        const all = [
            ...this.data.dailyBlogs.map(i => ({ ...i, type: 'blog' })),
            ...this.data.thoughts.map(i => ({ ...i, type: 'thoughts' })),
            ...this.data.lifeIncidents.map(i => ({ ...i, type: 'life' }))
        ];

        all.sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00')));

        if (all.length === 0) {
            container.innerHTML = '<p>No entries found in database.</p>';
            return;
        }

        container.innerHTML = all.map(item => `
            <div class="cms-post-item">
                <div class="cms-post-info">
                    <h3 style="display: flex; align-items: center; gap: 0.6rem;">
                        ${item.title}
                        <i data-feather="star" 
                           style="width: 16px; height: 16px; cursor: pointer; transition: all 0.2s ease; ${item.featured ? 'fill: #f59e0b; stroke: #f59e0b;' : 'opacity: 0.35;'}" 
                           title="${item.featured ? 'Featured on Homepage (Click to Unfeature)' : 'Click to Feature on Homepage'}"
                           onclick="App.handleCMSToggleFeatured('${item.id}', '${item.type}')">
                        </i>
                    </h3>
                    <div class="cms-post-meta">
                        <span style="font-weight: 600; color: var(--link-color); margin-right: 0.8rem;">
                            ${item.type === 'blog' ? 'Blog' : (item.type === 'thoughts' ? 'Thought' : 'Incident')}
                        </span>
                        ${item.date}${item.time ? ' — ' + item.time : ''}
                    </div>
                </div>
                <div class="cms-post-actions">
                    <button class="cms-btn cms-btn-secondary" onclick="App.handleCMSEditPost('${item.id}', '${item.type}')">
                        <i data-feather="edit-2" style="width:14px; height:14px;"></i>
                        Edit
                    </button>
                    <button class="cms-btn cms-btn-danger" onclick="App.handleAdminDelete('${item.id}', '${item.type}')">
                        <i data-feather="trash-2" style="width:14px; height:14px;"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');

        if (typeof feather !== 'undefined') feather.replace();
    },

    async handleCMSToggleFeatured(id, type) {
        const all = type === 'blog' ? this.data.dailyBlogs : (type === 'thoughts' ? this.data.thoughts : this.data.lifeIncidents);
        const item = all.find(e => e.id === id);
        if (!item) return;

        const newFeatured = !item.featured;
        this.showToast(newFeatured ? "Featured on Homepage" : "Removed from Homepage");

        try {
            // Update dynamic database
            await ArchiveDB.updateEntry(type, id, { featured: newFeatured });

            // Sync cache
            item.featured = newFeatured;

            // Refresh the server data and redraw CMS lists
            await this.loadAllData();
            this.loadCMSList();
        } catch (error) {
            console.error("Error toggling featured status:", error);
            this.showToast("Failed to update homepage status.");
        }
    },

    handleCMSNewPost() {
        this.cmsState.isEditing = true;
        this.cmsState.editingId = null;
        this.cmsState.editingType = 'blog';
        this.cmsState.postData = {
            id: '',
            title: '',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().split(' ')[0].substring(0, 5),
            featured: false,
            content: [],
            sections: []
        };
        this.renderCMS(document.getElementById('app-root'));
    },

    handleCMSEditPost(id, type) {
        const all = type === 'blog' ? this.data.dailyBlogs : (type === 'thoughts' ? this.data.thoughts : this.data.lifeIncidents);
        const item = all.find(e => e.id === id);
        
        if (!item) {
            this.showToast("Post not found.");
            return;
        }

        // Safe clone preserving Firestore Timestamp objects
        this.cmsState.isEditing = true;
        this.cmsState.editingId = id;
        this.cmsState.editingType = type;
        this.cmsState.postData = {
            ...item,
            content: item.content ? JSON.parse(JSON.stringify(item.content)) : [],
            sections: item.sections ? JSON.parse(JSON.stringify(item.sections)) : []
        };

        // Format CSV representations for editing Tables and Charts
        if (type !== 'life') {
            this.cmsState.postData.content.forEach(block => this.preprocessRawBlocks(block));
        } else {
            this.cmsState.postData.sections.forEach(section => {
                if (section.content) {
                    section.content.forEach(block => this.preprocessRawBlocks(block));
                }
            });
        }

        this.renderCMS(document.getElementById('app-root'));
    },

    preprocessRawBlocks(block) {
        if (block.type === 'table') {
            if (block.headers) block.tableHeadersRaw = block.headers.join(', ');
            if (block.rows) block.tableRowsRaw = block.rows.map(r => r.join(', ')).join('\n');
        } else if (block.type === 'chart' && block.data) {
            block.chartDataRaw = block.data.map(d => `${d.label}, ${d.value}`).join('\n');
        }
    },

    // --- CMS BLOCK BUILDER FORM ---
    renderCMSForm(container) {
        const post = this.cmsState.postData;
        const type = this.cmsState.editingType;

        container.innerHTML = `
            <div class="editor-container">
                <div class="cms-header" style="margin-bottom: 2rem;">
                    <h2>${this.cmsState.editingId ? 'Edit Entry' : 'Create New Entry'}</h2>
                    <button class="cms-btn cms-btn-secondary" onclick="App.handleCMSCancel()"><i data-feather="x"></i>Cancel</button>
                </div>
                
                <form class="editor-form" onsubmit="App.handleCMSSavePost(event)">
                    <div class="editor-row">
                        <div class="editor-form-group">
                            <label>Category Type</label>
                            <select class="editor-select" onchange="App.handleCMSChangeCategory(this.value)" ${this.cmsState.editingId ? 'disabled' : ''}>
                                <option value="blog" ${type === 'blog' ? 'selected' : ''}>Daily Blog</option>
                                <option value="thoughts" ${type === 'thoughts' ? 'selected' : ''}>Thought</option>
                                <option value="life" ${type === 'life' ? 'selected' : ''}>Life Incident</option>
                            </select>
                        </div>
                        <div class="editor-form-group">
                            <label>URL Slug ID (lowercase, hyphens)</label>
                            <input type="text" class="editor-input" id="post-id" placeholder="my-awesome-post" value="${post.id}" required oninput="App.handleCMSUpdatePostMeta('id', this.value)" ${this.cmsState.editingId ? 'disabled' : ''}>
                        </div>
                    </div>
                    
                    <div class="editor-form-group">
                        <label>Entry Title</label>
                        <input type="text" class="editor-input" placeholder="Enter title" value="${post.title}" required oninput="App.handleCMSUpdatePostMeta('title', this.value)">
                    </div>
                    
                    <div class="editor-row">
                        <div class="editor-form-group">
                            <label>Date</label>
                            <input type="date" class="editor-input" value="${post.date}" required oninput="App.handleCMSUpdatePostMeta('date', this.value)">
                        </div>
                        <div class="editor-form-group" id="editor-time-group" style="${type === 'life' ? 'display:none' : ''}">
                            <label>Time</label>
                            <input type="time" class="editor-input" value="${post.time || ''}" oninput="App.handleCMSUpdatePostMeta('time', this.value)">
                        </div>
                        <div class="editor-form-group" style="justify-content: center; padding-top: 1.5rem;">
                            <label class="editor-toggle">
                                <input type="checkbox" ${post.featured ? 'checked' : ''} onchange="App.handleCMSUpdatePostMeta('featured', this.checked)">
                                <span>Feature this entry on homepage</span>
                            </label>
                        </div>
                    </div>

                    <!-- Dynamic Body Content -->
                    <div class="blocks-panel">
                        <h3>Content Layout Blocks</h3>
                        
                        ${type !== 'life' ? `
                            <div id="editor-blocks-list" class="blocks-list">
                                ${this.renderEditorBlocks(post.content)}
                            </div>
                            
                            <div class="block-adder-bar">
                                <span>Add Block Element</span>
                                <button type="button" class="cms-btn cms-btn-secondary" onclick="App.handleCMSAddBlock('paragraph')"><i data-feather="plus"></i>Paragraph</button>
                                <button type="button" class="cms-btn cms-btn-secondary" onclick="App.handleCMSAddBlock('image')"><i data-feather="plus"></i>Image</button>
                                <button type="button" class="cms-btn cms-btn-secondary" onclick="App.handleCMSAddBlock('equation')"><i data-feather="plus"></i>Equation (LaTeX)</button>
                                <button type="button" class="cms-btn cms-btn-secondary" onclick="App.handleCMSAddBlock('table')"><i data-feather="plus"></i>Table</button>
                                <button type="button" class="cms-btn cms-btn-secondary" onclick="App.handleCMSAddBlock('chart')"><i data-feather="plus"></i>Chart</button>
                            </div>
                        ` : `
                            <!-- Life Incident Section Builders -->
                            <div id="editor-sections-list" class="blocks-list">
                                ${this.renderEditorSections(post.sections)}
                            </div>
                            
                            <div style="text-align: center; margin-bottom: 2rem;">
                                <button type="button" class="cms-btn cms-btn-secondary" onclick="App.handleCMSAddSection()" style="margin: 0 auto;"><i data-feather="plus"></i>Add Section Container</button>
                            </div>
                        `}
                    </div>
                    
                    <div class="editor-actions">
                        <button type="submit" class="cms-btn cms-btn-primary" style="padding: 0.8rem 2rem; font-size: 1rem;"><i data-feather="check"></i>Publish to Archive</button>
                    </div>
                </form>
            </div>
        `;

        if (typeof feather !== 'undefined') feather.replace();
    },

    getBlockTemplate(blockType) {
        switch (blockType) {
            case 'paragraph': return { type: 'paragraph', text: '' };
            case 'image': return { type: 'image', url: '', caption: '' };
            case 'equation': return { type: 'equation', latex: '', caption: '' };
            case 'table': return { type: 'table', tableHeadersRaw: '', tableRowsRaw: '', caption: '' };
            case 'chart': return { type: 'chart', chartType: 'bar', chartDataRaw: '', caption: '' };
        }
    },

    renderEditorBlocks(blocks, secIndex = null) {
        if (!blocks || blocks.length === 0) {
            return `<div style="text-align:center; padding: 2rem; color: var(--muted-text); font-size: 0.9rem;">No blocks added. Use the buttons below to build your entry layout.</div>`;
        }

        return blocks.map((block, index) => {
            let fieldsHtml = '';
            
            if (block.type === 'paragraph') {
                fieldsHtml = `
                    <textarea class="block-textarea" placeholder="Write paragraphs... Bold elements can be written as <strong>Text</strong>. Blockquotes can be wrapped in <blockquote>Quote</blockquote>." required oninput="App.handleCMSUpdateBlockValue(${index}, 'text', this.value, ${secIndex})">${block.text || ''}</textarea>
                `;
            } else if (block.type === 'image') {
                fieldsHtml = `
                    <div class="editor-row">
                        <div class="editor-form-group">
                            <label>Image URL</label>
                            <input type="text" class="editor-input" placeholder="https://example.com/photo.jpg or ./images/photo.jpg" value="${block.url || ''}" required oninput="App.handleCMSUpdateBlockValue(${index}, 'url', this.value, ${secIndex})">
                        </div>
                        <div class="editor-form-group">
                            <label>Caption (Optional)</label>
                            <input type="text" class="editor-input" placeholder="Image description" value="${block.caption || ''}" oninput="App.handleCMSUpdateBlockValue(${index}, 'caption', this.value, ${secIndex})">
                        </div>
                    </div>
                `;
            } else if (block.type === 'equation') {
                fieldsHtml = `
                    <div class="editor-row">
                        <div class="editor-form-group">
                            <label>LaTeX Equation</label>
                            <input type="text" class="editor-input" placeholder="e.g. E = mc^2" value="${block.latex || ''}" required oninput="App.handleCMSUpdateBlockValue(${index}, 'latex', this.value, ${secIndex})">
                        </div>
                        <div class="editor-form-group">
                            <label>Caption (Optional)</label>
                            <input type="text" class="editor-input" placeholder="Equation description" value="${block.caption || ''}" oninput="App.handleCMSUpdateBlockValue(${index}, 'caption', this.value, ${secIndex})">
                        </div>
                    </div>
                `;
            } else if (block.type === 'table') {
                fieldsHtml = `
                    <div class="editor-form-group">
                        <label>Table Headers (Comma Separated)</label>
                        <input type="text" class="editor-input" placeholder="Year, Revenue, Profit" value="${block.tableHeadersRaw || ''}" required oninput="App.handleCMSUpdateBlockValue(${index}, 'tableHeadersRaw', this.value, ${secIndex})">
                    </div>
                    <div class="editor-form-group">
                        <label>Table Rows (Comma Separated values, one row per line)</label>
                        <textarea class="block-textarea" placeholder="2024, $10k, $2k&#10;2025, $15k, $4k" required oninput="App.handleCMSUpdateBlockValue(${index}, 'tableRowsRaw', this.value, ${secIndex})">${block.tableRowsRaw || ''}</textarea>
                    </div>
                    <div class="editor-form-group">
                        <label>Table Caption (Optional)</label>
                        <input type="text" class="editor-input" placeholder="Table title" value="${block.caption || ''}" oninput="App.handleCMSUpdateBlockValue(${index}, 'caption', this.value, ${secIndex})">
                    </div>
                `;
            } else if (block.type === 'chart') {
                fieldsHtml = `
                    <div class="editor-row">
                        <div class="editor-form-group">
                            <label>Chart Display Type</label>
                            <select class="editor-select" onchange="App.handleCMSUpdateBlockValue(${index}, 'chartType', this.value, ${secIndex})">
                                <option value="bar" ${block.chartType === 'bar' ? 'selected' : ''}>Bar Chart</option>
                                <option value="line" ${block.chartType === 'line' ? 'selected' : ''}>Line Chart</option>
                                <option value="pie" ${block.chartType === 'pie' ? 'selected' : ''}>Pie Chart</option>
                            </select>
                        </div>
                        <div class="editor-form-group">
                            <label>Chart Data (Label, Value - one pair per line)</label>
                            <textarea class="block-textarea" placeholder="Apple, 45&#10;Banana, 20&#10;Orange, 35" required oninput="App.handleCMSUpdateBlockValue(${index}, 'chartDataRaw', this.value, ${secIndex})">${block.chartDataRaw || ''}</textarea>
                        </div>
                    </div>
                    <div class="editor-form-group" style="margin-top: 1rem;">
                        <label>Chart Caption (Optional)</label>
                        <input type="text" class="editor-input" placeholder="Chart title" value="${block.caption || ''}" oninput="App.handleCMSUpdateBlockValue(${index}, 'caption', this.value, ${secIndex})">
                    </div>
                `;
            }

            return `
                <div class="block-item">
                    <div class="block-header">
                        <span class="block-type-badge">${block.type}</span>
                        <div class="block-controls">
                            <button type="button" class="block-btn-icon" title="Move Up" onclick="App.handleCMSMoveBlock(${index}, -1, ${secIndex})"><i data-feather="arrow-up"></i></button>
                            <button type="button" class="block-btn-icon" title="Move Down" onclick="App.handleCMSMoveBlock(${index}, 1, ${secIndex})"><i data-feather="arrow-down"></i></button>
                            <button type="button" class="block-btn-icon delete" title="Delete Block" onclick="App.handleCMSRemoveBlock(${index}, ${secIndex})"><i data-feather="trash-2"></i></button>
                        </div>
                    </div>
                    <div class="block-fields">
                        ${fieldsHtml}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderEditorSections(sections) {
        if (!sections || sections.length === 0) {
            return `<div style="text-align:center; padding: 2rem; color: var(--muted-text); font-size: 0.9rem;">No section containers created. Use the button below to add your first chapter.</div>`;
        }

        return sections.map((section, secIndex) => `
            <div class="block-item" style="border: 2px solid var(--border-color); background-color: var(--sidebar-bg);">
                <div class="block-header">
                    <span class="block-type-badge" style="background-color:rgba(16,185,129,0.08); color:#10b981;">Section container ${secIndex + 1}</span>
                    <div class="block-controls">
                        <button type="button" class="block-btn-icon" title="Move Section Up" onclick="App.handleCMSMoveSection(${secIndex}, -1)"><i data-feather="arrow-up"></i></button>
                        <button type="button" class="block-btn-icon" title="Move Section Down" onclick="App.handleCMSMoveSection(${secIndex}, 1)"><i data-feather="arrow-down"></i></button>
                        <button type="button" class="block-btn-icon delete" title="Delete Section" onclick="App.handleCMSRemoveSection(${secIndex})"><i data-feather="trash-2"></i></button>
                    </div>
                </div>
                
                <div class="editor-form-group" style="margin-bottom: 1.5rem;">
                    <label>Section Title/Heading</label>
                    <input type="text" class="editor-input" placeholder="e.g. Chapter 1: The Decision" value="${section.heading || ''}" required oninput="App.handleCMSUpdateSectionHeading(${secIndex}, this.value)">
                </div>
                
                <div class="blocks-panel" style="background-color: var(--bg-color); padding: 1.5rem; border-radius: 8px; border: 1px dashed var(--border-color)">
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--muted-text); margin-bottom: 1rem;">Section Content Blocks</h4>
                    <div class="blocks-list">
                        ${this.renderEditorBlocks(section.content, secIndex)}
                    </div>
                    
                    <div class="block-adder-bar" style="margin-bottom:0; background-color: var(--sidebar-bg)">
                        <span>Add Section Block Element</span>
                        <button type="button" class="cms-btn cms-btn-secondary" onclick="App.handleCMSAddBlock('paragraph', ${secIndex})"><i data-feather="plus"></i>Paragraph</button>
                        <button type="button" class="cms-btn cms-btn-secondary" onclick="App.handleCMSAddBlock('image', ${secIndex})"><i data-feather="plus"></i>Image</button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    // --- EDITOR DATA-BINDING & HANDLERS ---
    handleCMSUpdatePostMeta(field, val) {
        this.cmsState.postData[field] = val;
    },

    handleCMSUpdateBlockValue(idx, field, val, secIndex = null) {
        if (secIndex === null) {
            this.cmsState.postData.content[idx][field] = val;
        } else {
            this.cmsState.postData.sections[secIndex].content[idx][field] = val;
        }
    },

    handleCMSUpdateSectionHeading(secIndex, val) {
        this.cmsState.postData.sections[secIndex].heading = val;
    },

    handleCMSChangeCategory(val) {
        this.cmsState.editingType = val;
        document.getElementById('editor-time-group').style.display = (val === 'life') ? 'none' : '';
        this.renderCMSForm(document.getElementById('app-root'));
    },

    handleCMSAddBlock(blockType, secIndex = null) {
        const newBlock = this.getBlockTemplate(blockType);
        if (secIndex === null) {
            this.cmsState.postData.content.push(newBlock);
        } else {
            if (!this.cmsState.postData.sections[secIndex].content) {
                this.cmsState.postData.sections[secIndex].content = [];
            }
            this.cmsState.postData.sections[secIndex].content.push(newBlock);
        }
        this.renderCMSForm(document.getElementById('app-root'));
    },

    handleCMSRemoveBlock(idx, secIndex = null) {
        if (secIndex === null) {
            this.cmsState.postData.content.splice(idx, 1);
        } else {
            this.cmsState.postData.sections[secIndex].content.splice(idx, 1);
        }
        this.renderCMSForm(document.getElementById('app-root'));
    },

    handleCMSMoveBlock(idx, dir, secIndex = null) {
        const list = (secIndex === null) ? this.cmsState.postData.content : this.cmsState.postData.sections[secIndex].content;
        const targetIdx = idx + dir;
        
        if (targetIdx < 0 || targetIdx >= list.length) return;
        
        const temp = list[idx];
        list[idx] = list[targetIdx];
        list[targetIdx] = temp;
        
        this.renderCMSForm(document.getElementById('app-root'));
    },

    handleCMSAddSection() {
        if (!this.cmsState.postData.sections) this.cmsState.postData.sections = [];
        this.cmsState.postData.sections.push({ heading: '', content: [] });
        this.renderCMSForm(document.getElementById('app-root'));
    },

    handleCMSRemoveSection(secIndex) {
        this.cmsState.postData.sections.splice(secIndex, 1);
        this.renderCMSForm(document.getElementById('app-root'));
    },

    handleCMSMoveSection(secIndex, dir) {
        const list = this.cmsState.postData.sections;
        const targetIdx = secIndex + dir;
        
        if (targetIdx < 0 || targetIdx >= list.length) return;
        
        const temp = list[secIndex];
        list[secIndex] = list[targetIdx];
        list[targetIdx] = temp;
        
        this.renderCMSForm(document.getElementById('app-root'));
    },

    handleCMSCancel() {
        this.cmsState.isEditing = false;
        this.cmsState.editingId = null;
        this.cmsState.postData = null;
        this.renderCMS(document.getElementById('app-root'));
    },

    async handleCMSSavePost(e) {
        e.preventDefault();
        const post = this.cmsState.postData;
        const type = this.cmsState.editingType;

        // Perform final post validation and parse tables/charts CSV fields
        try {
            if (type !== 'life') {
                post.content.forEach(block => this.postprocessRawBlocks(block));
            } else {
                if (!post.sections || post.sections.length === 0) {
                    alert("Please add at least one section for a Life Incident entry.");
                    return;
                }
                post.sections.forEach(section => {
                    if (section.content) {
                        section.content.forEach(block => this.postprocessRawBlocks(block));
                    }
                });
            }

            // Cleanup local UI-only variables before writing to Firestore
            delete post.docId;

            this.showToast("Publishing to Firestore database...");

            if (this.cmsState.editingId) {
                // Update existing
                await ArchiveDB.updateEntry(type, post.id, post);
                
                // Update cache
                const all = type === 'blog' ? this.data.dailyBlogs : (type === 'thoughts' ? this.data.thoughts : this.data.lifeIncidents);
                const idx = all.findIndex(e => e.id === post.id);
                if (idx !== -1) all[idx] = post;
                
                this.showToast("Entry updated successfully!");
            } else {
                // Create new
                // Check duplicate ID
                const all = type === 'blog' ? this.data.dailyBlogs : (type === 'thoughts' ? this.data.thoughts : this.data.lifeIncidents);
                if (all.some(item => item.id === post.id)) {
                    alert("A post with this URL slug ID already exists. Please choose a unique slug.");
                    return;
                }

                await ArchiveDB.addEntry(type, post);
                
                // Update cache
                all.push(post);
                
                this.showToast("Entry added successfully!");
            }

            // Reload all data
            await this.loadAllData();
            
            this.cmsState.isEditing = false;
            this.cmsState.editingId = null;
            this.cmsState.postData = null;
            
            // Navigate to category page
            window.location.hash = `#/${type}`;
        } catch (error) {
            console.error("Publishing error:", error);
            alert(`Publishing failed: ${error.message}`);
        }
    },

    postprocessRawBlocks(block) {
        if (block.type === 'table') {
            block.headers = block.tableHeadersRaw ? block.tableHeadersRaw.split(',').map(s => s.trim()) : [];
            block.rows = block.tableRowsRaw ? block.tableRowsRaw.split('\n').filter(l => l.trim() !== '').map(line => line.split(',').map(s => s.trim())) : [];
            
            // Cleanup editing fields
            delete block.tableHeadersRaw;
            delete block.tableRowsRaw;
        } else if (block.type === 'chart') {
            block.data = block.chartDataRaw ? block.chartDataRaw.split('\n').filter(l => l.trim() !== '').map(line => {
                const parts = line.split(',');
                return {
                    label: parts[0] ? parts[0].trim() : 'Label',
                    value: parts[1] ? parseFloat(parts[1].trim()) || 0 : 0
                };
            }) : [];
            
            // Cleanup editing fields
            delete block.chartDataRaw;
        }
    },

    // --- LIKE & SAVE CLIENT OPERATIONS ---
    async loadInteractionStates(entryId, entryType) {
        if (!ArchiveDB.db) {
            const bar = document.getElementById(`interaction-${entryId}`);
            if (bar) bar.style.display = 'none';
            return;
        }

        try {
            const likesState = await ArchiveDB.getLikesState(entryId);
            const isSaved = await ArchiveDB.isSaved(entryId);

            const likeBtn = document.getElementById(`like-btn-${entryId}`);
            const saveBtn = document.getElementById(`save-btn-${entryId}`);
            const likeCountSpan = document.getElementById(`like-count-${entryId}`);

            if (likeBtn) {
                if (likesState.isLiked) likeBtn.classList.add('liked');
                likeBtn.disabled = false;
            }
            if (likeCountSpan) {
                likeCountSpan.textContent = likesState.count;
            }
            if (saveBtn) {
                if (isSaved) saveBtn.classList.add('saved');
                saveBtn.disabled = false;
            }
        } catch (err) {
            console.error("Error loading interaction states:", err);
        }
    },

    async handleLike(entryId, entryType) {
        if (!ArchiveDB.currentUser) {
            this.showToast("Please log in to like entries.");
            window.location.hash = '#/login';
            return;
        }

        const likeBtn = document.getElementById(`like-btn-${entryId}`);
        const likeCountSpan = document.getElementById(`like-count-${entryId}`);
        if (!likeBtn) return;

        likeBtn.disabled = true;

        try {
            const isLikedNow = await ArchiveDB.toggleLike(entryId, entryType);
            const likesState = await ArchiveDB.getLikesState(entryId);

            if (isLikedNow) {
                likeBtn.classList.add('liked');
                this.showToast("Liked entry.");
            } else {
                likeBtn.classList.remove('liked');
                this.showToast("Unliked entry.");
            }

            if (likeCountSpan) {
                likeCountSpan.textContent = likesState.count;
            }

            // Sync cache count
            const all = entryType === 'blog' ? this.data.dailyBlogs : (entryType === 'thoughts' ? this.data.thoughts : this.data.lifeIncidents);
            const item = all.find(e => e.id === entryId);
            if (item) item.likesCount = likesState.count;

        } catch (error) {
            console.error("Like error:", error);
            this.showToast("Error updating likes count.");
        } finally {
            likeBtn.disabled = false;
            if (typeof feather !== 'undefined') feather.replace();
        }
    },

    async handleSave(entryId, entryType) {
        if (!ArchiveDB.currentUser) {
            this.showToast("Please log in to save entries.");
            window.location.hash = '#/login';
            return;
        }

        const saveBtn = document.getElementById(`save-btn-${entryId}`);
        if (!saveBtn) return;

        saveBtn.disabled = true;

        try {
            const isSavedNow = await ArchiveDB.toggleSave(entryId, entryType);
            if (isSavedNow) {
                saveBtn.classList.add('saved');
                this.showToast("Saved to Bookmarks.");
            } else {
                saveBtn.classList.remove('saved');
                this.showToast("Removed from Bookmarks.");
            }
        } catch (error) {
            console.error("Save error:", error);
            this.showToast("Error saving bookmark status.");
        } finally {
            saveBtn.disabled = false;
            if (typeof feather !== 'undefined') feather.replace();
        }
    },

    async handleAdminDelete(entryId, entryType) {
        if (!confirm("Are you sure you want to delete this entry from the archive? This action is permanent!")) return;
        
        try {
            this.showToast("Deleting entry from server...");
            await ArchiveDB.deleteEntry(entryType, entryId);
            
            // Remove from local cache
            if (entryType === 'blog') {
                this.data.dailyBlogs = this.data.dailyBlogs.filter(b => b.id !== entryId);
            } else if (entryType === 'thoughts') {
                this.data.thoughts = this.data.thoughts.filter(t => t.id !== entryId);
            } else if (entryType === 'life') {
                this.data.lifeIncidents = this.data.lifeIncidents.filter(i => i.id !== entryId);
            }

            this.showToast("Entry deleted successfully.");
            
            // Navigate away if on details, or refresh if on CMS
            if (window.location.hash === '#/cms') {
                this.renderCMS(document.getElementById('app-root'));
            } else {
                window.location.hash = `#/${entryType}`;
            }
        } catch (error) {
            console.error("Delete error:", error);
            this.showToast("Deletion failed. Access denied or server error.");
        }
    },

    // --- AI FACTS METHODS ---
    loadAIFactsState(entry, type) {
        const container = document.getElementById(`ai-facts-container-${entry.id}`);
        if (!container) return;

        let facts = null;
        try {
            const localData = localStorage.getItem(`ai_facts_${entry.id}`);
            if (localData) {
                facts = JSON.parse(localData);
            }
        } catch (e) {
            console.error("Error reading local AI facts:", e);
        }

        // Fallback to entry.aiFacts if local storage doesn't have it
        if (!facts && entry.aiFacts && Array.isArray(entry.aiFacts) && entry.aiFacts.length > 0) {
            facts = entry.aiFacts;
        }

        if (facts && Array.isArray(facts) && facts.length > 0) {
            container.innerHTML = `
                <div class="ai-facts-section">
                    <h3>
                        <i data-feather="cpu" style="width:18px; height:18px; color: var(--link-color);"></i>
                        Archival AI Insights & Facts
                    </h3>
                    <ul class="ai-facts-list">
                        ${facts.map(fact => `
                            <li>
                                <i data-feather="check-square"></i>
                                <span>${fact}</span>
                            </li>
                        `).join('')}
                    </ul>
                    <button class="cms-btn cms-btn-secondary" style="margin-top: 1.5rem; width: fit-content; gap: 0.4rem; padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="App.handleGenerateAIFacts('${entry.id}', '${type}')">
                        <i data-feather="refresh-cw" style="width: 12px; height: 12px;"></i>
                        Regenerate Facts
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="ai-facts-section missing">
                    <h3>
                        <i data-feather="cpu" style="width:18px; height:18px;"></i>
                        AI Archival Facts
                    </h3>
                    <p style="font-size: 0.95rem; color: var(--muted-text); margin-bottom: 1.2rem;">No AI facts have been compiled for this entry yet.</p>
                    <button class="cms-btn cms-btn-primary" id="ai-facts-btn-${entry.id}" onclick="App.handleGenerateAIFacts('${entry.id}', '${type}')">
                        <i data-feather="zap" style="width:14px; height:14px;"></i>
                        Generate AI Facts
                    </button>
                </div>
            `;
        }

        if (typeof feather !== 'undefined') feather.replace();
    },

    async handleGenerateAIFacts(entryId, entryType) {
        // Find the entry in cached data
        const all = entryType === 'blog' ? this.data.dailyBlogs : (entryType === 'thoughts' ? this.data.thoughts : this.data.lifeIncidents);
        const entry = all.find(e => e.id === entryId);
        if (!entry) return;

        const container = document.getElementById(`ai-facts-container-${entryId}`);
        if (!container) return;

        // Instantly replace facts section with high-fidelity visual pulsing loader
        container.innerHTML = `
            <div class="ai-facts-section">
                <div class="ai-loader-container">
                    <div class="ai-loader-spinner"></div>
                    <span class="ai-loader-text">Compiling Archival Insights</span>
                    <span class="ai-loader-subtext">Consulting OpenRouter AI Portal...</span>
                </div>
            </div>
        `;

        // Extract raw paragraph texts for AI context
        let blogText = '';
        if (entry.content && Array.isArray(entry.content)) {
            blogText = entry.content
                .filter(b => b.type === 'paragraph')
                .map(b => b.text.replace(/<[^>]*>/g, ''))
                .join('\n\n');
        } else if (entry.sections && Array.isArray(entry.sections)) {
            blogText = entry.sections.map(sec => {
                const secText = sec.content
                    ? sec.content
                        .filter(b => b.type === 'paragraph')
                        .map(b => b.text.replace(/<[^>]*>/g, ''))
                        .join('\n')
                    : '';
                return `Section: ${sec.heading}\n${secText}`;
            }).join('\n\n');
        }

        try {
            if (!window.openRouterApiKey) {
                throw new Error("OpenRouter API key is not configured");
            }

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${window.openRouterApiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "Living Archive"
                },
                body: JSON.stringify({
                    "model": "openrouter/free",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a professional research AI integrated into Sayan Maity's personal blog. Read the provided article and extract exactly 3 to 4 interesting, factual, and analytical insights or facts based directly on the blog context. Keep them brief, engaging, and objective. Output strictly as a JSON array of strings. Do not include markdown code fence formatting or other conversational text, just the raw JSON array of strings (e.g., [\"Fact 1\", \"Fact 2\"])."
                        },
                        {
                            "role": "user",
                            "content": `Article Title: ${entry.title}\n\n${blogText}`
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`OpenRouter HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            const responseText = result.choices[0].message.content.trim();

            // Robust regex extraction of the JSON array block
            const arrayMatch = responseText.match(/\[\s*([\s\S]*?)\s*\]/);
            if (!arrayMatch) {
                console.error("Raw AI response was:", responseText);
                throw new Error("AI did not return a structured JSON array of facts");
            }
            
            const jsonString = arrayMatch[0];
            const parsedFacts = JSON.parse(jsonString);

            if (!Array.isArray(parsedFacts)) {
                throw new Error("AI did not return a valid array of facts");
            }

            // Save to local storage instantly
            localStorage.setItem("ai_facts_" + entryId, JSON.stringify(parsedFacts));

            // Sync local cache
            entry.aiFacts = parsedFacts;

            // Re-render the facts section instantly
            this.loadAIFactsState(entry, entryType);
            this.showToast("AI Facts successfully compiled.");
        } catch (error) {
            console.error("AI Facts generation failed:", error);
            this.showToast(`AI generation failed: ${error.message}`);
            
            // Re-render initial state on error to restore button
            this.loadAIFactsState(entry, entryType);
        }
    }
};

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
