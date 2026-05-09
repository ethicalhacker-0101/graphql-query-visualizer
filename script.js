// GraphQL Query Visualizer — Dark Dashboard
class GraphQLVisualizer {
    constructor() {
        // DOM refs
        this.queryInput = document.getElementById('queryInput');
        this.visualizeBtn = document.getElementById('visualizeBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.sampleBtn = document.getElementById('sampleBtn');
        this.highlightedOutput = document.getElementById('highlightedOutput');
        this.queryTree = document.getElementById('queryTree');
        this.fieldAnalysis = document.getElementById('fieldAnalysis');
        this.fieldBadge = document.getElementById('fieldBadge');
        this.lineNumbers = document.getElementById('lineNumbers');
        this.menuToggle = document.getElementById('menuToggle');
        this.sidebar = document.getElementById('sidebar');

        // Graph
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.graphNodes = [];
        this.graphEdges = [];
        this.graphScale = 1;
        this.graphOffset = { x: 0, y: 0 };
        this.dragging = false;
        this.dragStart = { x: 0, y: 0 };

        this.lastAnalysis = null;
        this.setupEventListeners();
        this.updateLineNumbers();
        this.createParticles();
    }

    setupEventListeners() {
        this.visualizeBtn.addEventListener('click', () => this.visualize());
        this.clearBtn.addEventListener('click', () => this.clear());
        this.sampleBtn.addEventListener('click', () => this.loadSample());
        this.queryInput.addEventListener('input', () => this.updateLineNumbers());
        this.queryInput.addEventListener('scroll', () => {
            this.lineNumbers.scrollTop = this.queryInput.scrollTop;
        });
        this.queryInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this.visualize(); }
            if (e.key === 'Tab') {
                e.preventDefault();
                const s = this.queryInput.selectionStart;
                this.queryInput.value = this.queryInput.value.substring(0, s) + '  ' + this.queryInput.value.substring(this.queryInput.selectionEnd);
                this.queryInput.selectionStart = this.queryInput.selectionEnd = s + 2;
                this.updateLineNumbers();
            }
        });

        // Sidebar nav
        document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Mobile menu
        this.menuToggle.addEventListener('click', () => this.sidebar.classList.toggle('open'));

        // Graph controls
        document.getElementById('zoomIn')?.addEventListener('click', () => { this.graphScale *= 1.2; this.drawGraph(); });
        document.getElementById('zoomOut')?.addEventListener('click', () => { this.graphScale /= 1.2; this.drawGraph(); });
        document.getElementById('resetGraph')?.addEventListener('click', () => { this.graphScale = 1; this.graphOffset = { x: 0, y: 0 }; this.drawGraph(); });

        // Canvas drag
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => { this.dragging = true; this.dragStart = { x: e.clientX - this.graphOffset.x, y: e.clientY - this.graphOffset.y }; });
            window.addEventListener('mousemove', (e) => { if (this.dragging) { this.graphOffset.x = e.clientX - this.dragStart.x; this.graphOffset.y = e.clientY - this.dragStart.y; this.drawGraph(); } });
            window.addEventListener('mouseup', () => { this.dragging = false; });
            this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.graphScale *= e.deltaY < 0 ? 1.08 : 0.92; this.drawGraph(); });
        }

        // Resize canvas
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    switchTab(tab) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('panel' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (panel) panel.classList.add('active');
        if (tab === 'graph') { this.resizeCanvas(); this.drawGraph(); }
        this.sidebar.classList.remove('open');
    }

    updateLineNumbers() {
        const lines = this.queryInput.value.split('\n').length;
        this.lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
    }

    createParticles() {
        const container = document.getElementById('bgParticles');
        if (!container) return;
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 4 + 2;
            p.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100+100}%;background:${Math.random()>.5?'#a855f7':'#06b6d4'};animation-duration:${Math.random()*15+10}s;animation-delay:${Math.random()*10}s;`;
            container.appendChild(p);
        }
    }

    loadSample() {
        this.queryInput.value = `query GetUserDashboard {
  user(id: "usr_42") {
    id
    username
    email
    profile {
      avatar
      bio
      socialLinks {
        platform
        url
      }
    }
    posts(first: 10, orderBy: CREATED_AT) {
      edges {
        node {
          id
          title
          content
          createdAt
          comments(last: 5) {
            text
            author {
              username
            }
          }
          tags {
            name
            color
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;
        this.updateLineNumbers();
        this.visualize();
    }

    visualize() {
        const query = this.queryInput.value.trim();
        if (!query) return;

        const t0 = performance.now();
        try {
            const analysis = this.analyzeQuery(query);
            const parseTime = (performance.now() - t0).toFixed(1);
            this.lastAnalysis = analysis;

            document.getElementById('parseSpeed').textContent = parseTime + 'ms';
            this.renderHighlightedOutput(query, analysis);
            this.updateInfo(analysis);
            this.updateFieldAnalysis(analysis);
            this.buildTree(analysis);
            this.buildGraphData(analysis);
            this.resizeCanvas();
            this.drawGraph();
            this.updatePerformance(analysis, parseTime);
        } catch (err) {
            this.highlightedOutput.innerHTML = `<div class="empty-state"><p style="color:var(--accent-rose)">Parse error: ${err.message}</p></div>`;
        }
    }

    analyzeQuery(query) {
        const lines = query.split('\n');
        const result = { type: 'query', name: 'Anonymous', fields: [], depth: 0, args: 0, raw: query };
        let currentDepth = 0;
        let inQuery = false;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            if (trimmed.match(/^(query|mutation|subscription)\b/i)) {
                const m = trimmed.match(/^(query|mutation|subscription)\s+(\w+)?/i);
                if (m) { result.type = m[1].toLowerCase(); result.name = m[2] || 'Anonymous'; }
                inQuery = true;
            }

            // Handle shorthand query (starts with {)
            if (!inQuery && trimmed.startsWith('{')) inQuery = true;

            if (!inQuery) return;

            const opens = (line.match(/{/g) || []).length;
            const closes = (line.match(/}/g) || []).length;
            currentDepth += opens;

            const fieldMatch = trimmed.match(/^(\w+)\s*(\([^)]*\))?\s*{?$/);
            if (fieldMatch && !trimmed.match(/^(query|mutation|subscription)\b/i)) {
                const args = fieldMatch[2] || '';
                if (args) result.args++;
                result.fields.push({ name: fieldMatch[1], args, depth: currentDepth - 1 });
            } else if (trimmed.match(/^\w+$/) && !trimmed.match(/^(query|mutation|subscription)$/i)) {
                result.fields.push({ name: trimmed, args: '', depth: currentDepth - 1 });
            }

            currentDepth -= closes;
            result.depth = Math.max(result.depth, currentDepth);
        });

        return result;
    }

    renderHighlightedOutput(query, analysis) {
        const lines = query.split('\n');
        const maxDepth = analysis.depth;
        let depth = 0;
        const html = lines.map(line => {
            const opens = (line.match(/{/g) || []).length;
            const closes = (line.match(/}/g) || []).length;
            depth += opens - closes;
            let cls = 'highlight-line';
            if (depth >= maxDepth && maxDepth > 3) cls += ' depth-high';
            else if (depth >= maxDepth - 1 && maxDepth > 2) cls += ' depth-medium';

            let hl = this.escapeHtml(line);
            hl = hl.replace(/\b(query|mutation|subscription|fragment|on)\b/g, '<span class="token-keyword">$1</span>');
            hl = hl.replace(/(\w+)\s*(?=\()/g, '<span class="token-operation">$1</span>');
            hl = hl.replace(/#.*/g, m => `<span class="token-comment">${m}</span>`);
            hl = hl.replace(/"[^"]*"/g, m => `<span class="token-string">${m}</span>`);
            hl = hl.replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');
            hl = hl.replace(/\$\w+/g, m => `<span class="token-variable">${m}</span>`);
            hl = hl.replace(/@\w+/g, m => `<span class="token-directive">${m}</span>`);
            hl = hl.replace(/\.\.\./g, '<span class="token-spread">...</span>');
            hl = hl.replace(/[{}]/g, m => `<span class="token-brace">${m}</span>`);
            hl = hl.replace(/[()]/g, m => `<span class="token-paren">${m}</span>`);
            hl = hl.replace(/:/g, '<span class="token-colon">:</span>');
            return `<span class="${cls}">${hl}</span>`;
        }).join('\n');
        this.highlightedOutput.innerHTML = `<pre style="margin:0;white-space:pre-wrap;word-break:break-word;">${html}</pre>`;
    }

    escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    buildTree(analysis) {
        this.queryTree.innerHTML = '';
        const root = document.createElement('div');
        root.className = 'tree-node root';
        root.textContent = `${analysis.type.toUpperCase()} ${analysis.name}`;
        this.queryTree.appendChild(root);

        if (analysis.fields.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state small';
            empty.innerHTML = '<p>No fields found</p>';
            this.queryTree.appendChild(empty);
            return;
        }
        analysis.fields.forEach(f => {
            const node = document.createElement('div');
            node.className = 'tree-node field';
            node.style.paddingLeft = (16 + f.depth * 18) + 'px';
            node.textContent = f.name + (f.args ? ' ' + f.args : '');
            this.queryTree.appendChild(node);
        });
    }

    updateInfo(a) {
        document.getElementById('queryType').textContent = a.type.toUpperCase();
        document.getElementById('queryName').textContent = a.name;
        document.getElementById('fieldsCount').textContent = a.fields.length;
        document.getElementById('depthLevel').textContent = a.depth;
    }

    updateFieldAnalysis(a) {
        this.fieldAnalysis.innerHTML = '';
        this.fieldBadge.textContent = a.fields.length + ' fields';
        if (a.fields.length === 0) {
            this.fieldAnalysis.innerHTML = '<div class="empty-state small"><p>No fields to analyze</p></div>';
            return;
        }
        a.fields.forEach(f => {
            const el = document.createElement('div');
            el.className = 'field-item';
            el.innerHTML = `<div><div class="field-name">${f.name}</div>${f.args ? `<div class="field-type">Args: ${this.escapeHtml(f.args)}</div>` : ''}</div><div class="field-depth">Depth ${f.depth}</div>`;
            this.fieldAnalysis.appendChild(el);
        });
    }

    // ---- Node Graph ----
    buildGraphData(analysis) {
        this.graphNodes = [];
        this.graphEdges = [];
        const rootId = 0;
        this.graphNodes.push({ id: rootId, label: analysis.name || 'Query', depth: 0, x: 0, y: 0 });

        const depthBuckets = {};
        analysis.fields.forEach((f, i) => {
            const id = i + 1;
            const d = f.depth + 1;
            if (!depthBuckets[d]) depthBuckets[d] = [];
            depthBuckets[d].push(id);
            this.graphNodes.push({ id, label: f.name, depth: d, x: 0, y: 0 });
        });

        // Layout
        const spacingX = 160, spacingY = 90;
        this.graphNodes[0].x = 0;
        this.graphNodes[0].y = 0;

        Object.keys(depthBuckets).sort((a,b) => a - b).forEach(d => {
            const ids = depthBuckets[d];
            const totalWidth = (ids.length - 1) * spacingX;
            ids.forEach((id, idx) => {
                this.graphNodes[id].x = -totalWidth / 2 + idx * spacingX;
                this.graphNodes[id].y = d * spacingY;
            });
        });

        // Edges: connect each field to its nearest ancestor
        const parentStack = [0];
        let prevDepth = 0;
        analysis.fields.forEach((f, i) => {
            const d = f.depth + 1;
            while (parentStack.length > d) parentStack.pop();
            const parentId = parentStack[parentStack.length - 1];
            this.graphEdges.push({ from: parentId, to: i + 1 });
            parentStack.push(i + 1);
            prevDepth = d;
        });

        document.getElementById('graphEmpty')?.classList.add('hidden');
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height - 46;
    }

    drawGraph() {
        if (!this.ctx || this.graphNodes.length === 0) return;
        const ctx = this.ctx;
        const w = this.canvas.width, h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2 + this.graphOffset.x, 60 + this.graphOffset.y);
        ctx.scale(this.graphScale, this.graphScale);

        // Edges
        this.graphEdges.forEach(e => {
            const from = this.graphNodes[e.from];
            const to = this.graphNodes[e.to];
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            const cy = (from.y + to.y) / 2;
            ctx.bezierCurveTo(from.x, cy, to.x, cy, to.x, to.y);
            ctx.strokeStyle = 'rgba(168,85,247,0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        // Nodes
        this.graphNodes.forEach(n => {
            const r = n.depth === 0 ? 24 : 20;
            // Glow
            const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 1.5);
            if (n.depth === 0) {
                grad.addColorStop(0, 'rgba(168,85,247,0.3)');
            } else {
                grad.addColorStop(0, 'rgba(6,182,212,0.2)');
            }
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(n.x - r * 1.5, n.y - r * 1.5, r * 3, r * 3);

            // Circle
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = n.depth === 0 ? '#a855f7' : '#0e7490';
            ctx.fill();
            ctx.strokeStyle = n.depth === 0 ? '#c084fc' : '#22d3ee';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            ctx.fillStyle = '#fff';
            ctx.font = `${n.depth === 0 ? '600 12px' : '500 10px'} Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = n.label.length > 10 ? n.label.slice(0, 9) + '…' : n.label;
            ctx.fillText(label, n.x, n.y);
        });

        ctx.restore();
    }

    // ---- Performance ----
    updatePerformance(analysis, parseTime) {
        let score = 100;
        const suggestions = [];

        if (analysis.depth > 5) { score -= 25; suggestions.push({ type: 'danger', text: `Deep nesting (${analysis.depth} levels) — risk of N+1 queries and DoS.` }); }
        else if (analysis.depth > 3) { score -= 10; suggestions.push({ type: 'warn', text: `Moderate nesting (${analysis.depth} levels). Consider pagination.` }); }
        else { suggestions.push({ type: 'good', text: 'Query depth is within safe limits.' }); }

        if (analysis.fields.length > 20) { score -= 20; suggestions.push({ type: 'danger', text: `High field count (${analysis.fields.length}). Consider field selection.` }); }
        else if (analysis.fields.length > 10) { score -= 8; suggestions.push({ type: 'warn', text: `${analysis.fields.length} fields requested. Review if all are needed.` }); }
        else { suggestions.push({ type: 'good', text: 'Field count is reasonable.' }); }

        if (analysis.args === 0 && analysis.fields.length > 3) { score -= 10; suggestions.push({ type: 'warn', text: 'No arguments used — consider adding filters or pagination.' }); }
        else if (analysis.args > 0) { suggestions.push({ type: 'good', text: 'Arguments present — query is parameterized.' }); }

        score = Math.max(0, Math.min(100, score));

        document.getElementById('perfScore').textContent = score;
        const circ = 2 * Math.PI * 52;
        document.getElementById('perfRingFill').style.strokeDashoffset = circ - (score / 100) * circ;

        const summaryEl = document.getElementById('perfSummary');
        if (score >= 80) summaryEl.textContent = 'Excellent! This query is well-structured and performant.';
        else if (score >= 50) summaryEl.textContent = 'Acceptable, but there are optimization opportunities.';
        else summaryEl.textContent = 'This query has performance concerns. Review suggestions below.';

        document.getElementById('metricParseTime').textContent = parseTime + 'ms';
        document.getElementById('barDepth').style.width = Math.min(100, (analysis.depth / 8) * 100) + '%';
        document.getElementById('barFields').style.width = Math.min(100, (analysis.fields.length / 30) * 100) + '%';
        document.getElementById('barArgs').style.width = Math.min(100, (analysis.args / 5) * 100) + '%';

        const list = document.getElementById('suggestionsList');
        list.innerHTML = '';
        const icons = { good: '✅', warn: '⚠️', danger: '🔴' };
        suggestions.forEach(s => {
            const div = document.createElement('div');
            div.className = `suggestion-item ${s.type}`;
            div.innerHTML = `<span class="sug-icon">${icons[s.type]}</span><span>${s.text}</span>`;
            list.appendChild(div);
        });
    }

    clear() {
        this.queryInput.value = '';
        this.updateLineNumbers();
        this.highlightedOutput.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg><p>Enter a query and click <strong>Visualize</strong></p><span>or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd></span></div>';
        this.queryTree.innerHTML = '<div class="empty-state small"><p>No structure to display</p></div>';
        this.fieldAnalysis.innerHTML = '<div class="empty-state small"><p>No fields to analyze yet</p></div>';
        this.fieldBadge.textContent = '0 fields';
        document.getElementById('queryType').textContent = '—';
        document.getElementById('queryName').textContent = '—';
        document.getElementById('fieldsCount').textContent = '—';
        document.getElementById('depthLevel').textContent = '—';
        document.getElementById('perfScore').textContent = '—';
        document.getElementById('perfRingFill').style.strokeDashoffset = 326.73;
        document.getElementById('perfSummary').textContent = 'Visualize a query to see its performance analysis';
        document.getElementById('metricParseTime').textContent = '—';
        document.getElementById('barDepth').style.width = '0%';
        document.getElementById('barFields').style.width = '0%';
        document.getElementById('barArgs').style.width = '0%';
        document.getElementById('suggestionsList').innerHTML = '<div class="empty-state small"><p>Run a visualization to get suggestions</p></div>';
        this.graphNodes = [];
        this.graphEdges = [];
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        document.getElementById('graphEmpty')?.classList.remove('hidden');
        document.getElementById('parseSpeed').textContent = '0ms';
    }
}

document.addEventListener('DOMContentLoaded', () => { new GraphQLVisualizer(); });