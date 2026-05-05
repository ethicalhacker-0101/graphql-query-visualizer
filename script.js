// GraphQL Query Visualizer
class GraphQLVisualizer {
    constructor() {
        this.queryInput = document.getElementById('queryInput');
        this.visualizeBtn = document.getElementById('visualizeBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.highlightedCode = document.getElementById('highlightedCode');
        this.queryTree = document.getElementById('queryTree');
        this.fieldAnalysis = document.getElementById('fieldAnalysis');

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.visualizeBtn.addEventListener('click', () => this.visualize());
        this.clearBtn.addEventListener('click', () => this.clear());
        this.queryInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.visualize();
            }
        });
    }

    visualize() {
        const query = this.queryInput.value.trim();
        
        if (!query) {
            alert('Please enter a GraphQL query');
            return;
        }

        try {
            // Syntax highlight
            this.highlightedCode.textContent = query;
            hljs.highlightElement(this.highlightedCode);

            // Parse and analyze
            const analysis = this.analyzeQuery(query);

            // Build tree
            this.buildTree(analysis);

            // Update info
            this.updateInfo(analysis);

            // Update field analysis
            this.updateFieldAnalysis(analysis);
        } catch (error) {
            alert('Error parsing query: ' + error.message);
        }
    }

    analyzeQuery(query) {
        const lines = query.split('\n');
        const result = {
            type: 'unknown',
            name: 'Anonymous',
            fields: [],
            depth: 0,
            raw: query
        };

        let currentDepth = 0;
        let inQuery = false;

        lines.forEach((line, index) => {
            const trimmed = line.trim();

            // Detect query type
            if (trimmed.match(/^(query|mutation|subscription)/i)) {
                const match = trimmed.match(/^(query|mutation|subscription)\s+(\w+)?/i);
                result.type = match[1].toLowerCase();
                result.name = match[2] || 'Anonymous';
                inQuery = true;
                return;
            }

            if (!inQuery) return;

            // Count braces for depth
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;

            // Extract fields
            const fieldMatch = trimmed.match(/^(\w+)\s*(\([^)]*\))?/);
            if (fieldMatch && !trimmed.startsWith('{') && !trimmed.startsWith('}')) {
                result.fields.push({
                    name: fieldMatch[1],
                    args: fieldMatch[2] || '',
                    depth: currentDepth
                });
            }

            currentDepth += openBraces - closeBraces;
            result.depth = Math.max(result.depth, currentDepth);
        });

        return result;
    }

    buildTree(analysis) {
        this.queryTree.innerHTML = '';

        // Root node
        const rootNode = document.createElement('div');
        rootNode.className = 'tree-node root';
        rootNode.textContent = `${analysis.type.toUpperCase()} ${analysis.name}`;
        this.queryTree.appendChild(rootNode);

        // Field nodes
        analysis.fields.forEach(field => {
            const fieldNode = document.createElement('div');
            fieldNode.className = 'tree-node field';
            fieldNode.style.paddingLeft = (20 + field.depth * 20) + 'px';
            fieldNode.textContent = `${field.name}${field.args}`;
            this.queryTree.appendChild(fieldNode);
        });

        if (analysis.fields.length === 0) {
            const emptyNode = document.createElement('div');
            emptyNode.className = 'empty-state';
            emptyNode.textContent = 'No fields found in query';
            this.queryTree.appendChild(emptyNode);
        }
    }

    updateInfo(analysis) {
        document.getElementById('queryType').textContent = analysis.type.toUpperCase();
        document.getElementById('queryName').textContent = analysis.name;
        document.getElementById('fieldsCount').textContent = analysis.fields.length;
        document.getElementById('depthLevel').textContent = analysis.depth;
    }

    updateFieldAnalysis(analysis) {
        this.fieldAnalysis.innerHTML = '';

        if (analysis.fields.length === 0) {
            this.fieldAnalysis.innerHTML = '<p class="empty-state">No fields to analyze</p>';
            return;
        }

        analysis.fields.forEach((field, index) => {
            const fieldItem = document.createElement('div');
            fieldItem.className = 'field-item';
            fieldItem.innerHTML = `
                <div>
                    <div class="field-name">${field.name}</div>
                    ${field.args ? `<div class="field-type">Arguments: ${field.args}</div>` : ''}
                </div>
                <div class="field-depth">Depth: ${field.depth}</div>
            `;
            this.fieldAnalysis.appendChild(fieldItem);
        });
    }

    clear() {
        this.queryInput.value = '';
        this.highlightedCode.textContent = '';
        this.queryTree.innerHTML = '';
        this.fieldAnalysis.innerHTML = '';
        document.getElementById('queryType').textContent = '-';
        document.getElementById('queryName').textContent = '-';
        document.getElementById('fieldsCount').textContent = '-';
        document.getElementById('depthLevel').textContent = '-';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new GraphQLVisualizer();
});