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
            const [blogs, thoughts, incidents] = await Promise.all([
                fetch('./data/dailyBlogs.json').then(res => res.json()),
                fetch('./data/thoughts.json').then(res => res.json()),
                fetch('./data/lifeIncidents.json').then(res => res.json())
            ]);

            this.data.dailyBlogs = blogs.sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00')));
            this.data.thoughts = thoughts.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.data.lifeIncidents = incidents.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            console.error('Error loading archive data:', error);
            document.getElementById('app-root').innerHTML = '<p>Error loading content. Please check the JSON files.</p>';
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

        // Update Sidebar Widget
        this.renderSidebarWidget();
    },

    // Sidebar Widget (Recent Entries)
    renderSidebarWidget() {
        const list = document.getElementById('sidebar-latest');
        if (!list) return;

        // Combine all items with a type
        const all = [
            ...this.data.dailyBlogs.map(i => ({ ...i, type: 'blog' })),
            ...this.data.thoughts.map(i => ({ ...i, type: 'thoughts' })),
            ...this.data.lifeIncidents.map(i => ({ ...i, type: 'life' }))
        ];

        // Sort by date desc
        all.sort((a, b) => new Date(b.date) - new Date(a.date));


        // Take top 1
        const recent = all.slice(0, 1);

        list.innerHTML = recent.map(item => `
            <li>
                <a href="#/${item.type}/${item.id}">
                    <span style="display:block; font-weight:500;">${item.title}</span>
                    <span style="font-size:0.75rem; color:#999;">${item.date}</span>
                </a>
            </li>
        `).join('');
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
        // Get featured entries (manually selected with featured: true flag)
        const allEntries = [
            ...this.data.dailyBlogs.map(b => ({ ...b, type: 'blog' })),
            ...this.data.thoughts.map(t => ({ ...t, type: 'thoughts' }))
        ];

        // Filter only featured entries
        const featured = allEntries.filter(entry => entry.featured === true);

        let html = `
            <h1 style="border:none; margin-bottom: 1rem;">The Archive.</h1>
            <p class="paragraph" style="margin-bottom: 3rem;">A living repository of daily moments, focused thoughts, and life narratives.</p>
            
            ${featured.length > 0 ? `
                <h2 style="margin-bottom: 1.5rem;">
                    <i data-feather="star"></i>
                    Featured Entries
                </h2>
                
                <div class="masonry-grid">
                    ${featured.map(entry => {
            // Extract first image if exists
            let imageUrl = null;
            if (entry.content && Array.isArray(entry.content)) {
                const imageBlock = entry.content.find(b => b.type === 'image');
                if (imageBlock) imageUrl = imageBlock.url;
            }

            const preview = this.getPreviewText(entry);

            return `
                            <a href="#/${entry.type}/${entry.id}" class="masonry-card ${imageUrl ? 'has-image' : ''}">
                                ${imageUrl ? `
                                    <div class="card-image">
                                        <img src="${imageUrl}" alt="${entry.title}" loading="lazy">
                                    </div>
                                ` : ''}
                                <div class="card-content">
                                    <h3>${entry.title}</h3>
                                    <p class="card-date">${entry.date}</p>
                                    <p class="card-preview">${preview}</p>
                                </div>
                            </a>
                        `;
        }).join('')}
                </div>
            ` : ''}

            <h2 style="margin-top: 4rem; margin-bottom: 1.5rem;">Quick Access</h2>
            <div class="quick-links">
                <a href="#/blog" class="quick-link-card">
                    <i data-feather="edit-3"></i>
                    <h3>Daily Blogs</h3>
                    <p>${this.data.dailyBlogs.length} entries</p>
                </a>
                <a href="#/thoughts" class="quick-link-card">
                    <i data-feather="wind"></i>
                    <h3>Thoughts</h3>
                    <p>${this.data.thoughts.length} entries</p>
                </a>
                <a href="#/life" class="quick-link-card">
                    <i data-feather="clock"></i>
                    <h3>Life Incidents</h3>
                    <p>${this.data.lifeIncidents.length} entries</p>
                </a>
            </div>

            <h2 style="margin-top: 4rem;">About</h2>
            <p class="paragraph">This space is designed for longevity. It is simple, static, and focused entirely on the clarity of content. No trackers, no noise, just memories stored in structured JSON.</p>
        `;
        container.innerHTML = html;
        if (typeof feather !== 'undefined') feather.replace();
    },

    renderList(container, title, items, type) {
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

        // Get suggestions (other entries from the same type)
        const allEntries = type === 'blog' ? this.data.dailyBlogs : this.data.thoughts;
        const suggestions = allEntries
            .filter(e => e.id !== entry.id)
            .slice(0, 3);

        let html = `
            <article>
                <h1>${entry.title}</h1>
                <div class="meta">ARCHIVED • ${entry.date}${entry.time ? ' • ' + entry.time : ''} • SAYAN MAITY</div>
                ${this.renderBlocks(entry.content)}
                
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
        if (typeof feather !== 'undefined') feather.replace();
    },

    renderLifeIncident(container, entry) {
        if (!entry) return container.innerHTML = '<h1>Not Found</h1>';

        // Get suggestions (other life incidents)
        const suggestions = this.data.lifeIncidents
            .filter(e => e.id !== entry.id)
            .slice(0, 3);

        let html = `
            <article>
                <h1>${entry.title}</h1>
                <div class="meta">TIMELINE EVENT • ${entry.date} • SAYAN MAITY</div>
                ${entry.sections.map(section => `
                    <section>
                        <h2>${section.heading}</h2>
                        ${this.renderBlocks(section.content)}
                    </section>
                `).join('')}
                
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
    }
};

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
