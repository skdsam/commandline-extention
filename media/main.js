(function () {
    const vscode = acquireVsCodeApi();

    let state = {
        activeTab: 'commands',
        entries: [],
        searchQuery: ''
    };

    // Load initial data
    vscode.postMessage({
        type: 'loadData'
    });

    // UI Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const listContainer = document.getElementById('list-container');
    const searchInput = document.getElementById('search');
    const addBtn = document.getElementById('add-btn');
    const syncBtn = document.getElementById('sync-btn');
    const modal = document.getElementById('modal');
    const cancelModal = document.getElementById('cancel-modal');
    const saveModal = document.getElementById('save-modal');

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeTab = btn.dataset.tab;
            render();
        });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        render();
    });

    let editingId = null;

    // Modal logic
    addBtn.addEventListener('click', () => {
        editingId = null;
        document.getElementById('modal-title').textContent = 'Add Entry';
        clearModal();
        modal.classList.remove('hidden');
    });

    cancelModal.addEventListener('click', () => {
        modal.classList.add('hidden');
        clearModal();
    });

    saveModal.addEventListener('click', () => {
        const name = document.getElementById('entry-name').value;
        const content = document.getElementById('entry-content').value;
        const color = document.getElementById('entry-color').value;
        const icon = document.getElementById('entry-icon').value;

        if (name && content) {
            if (editingId) {
                const entry = state.entries.find(e => e.id === editingId);
                if (entry) {
                    entry.name = name;
                    entry.content = content;
                    entry.color = color;
                    entry.icon = icon;
                }
            } else {
                const entry = {
                    id: Date.now().toString(),
                    type: state.activeTab,
                    name,
                    content,
                    color,
                    icon,
                    pinned: false
                };
                state.entries.push(entry);
            }
            save();
            render();
            modal.classList.add('hidden');
            clearModal();
        }
    });

    function editEntry(id) {
        const entry = state.entries.find(e => e.id === id);
        if (entry) {
            editingId = id;
            document.getElementById('modal-title').textContent = 'Edit Entry';
            document.getElementById('entry-name').value = entry.name;
            document.getElementById('entry-content').value = entry.content;
            document.getElementById('entry-color').value = entry.color;
            document.getElementById('entry-icon').value = entry.icon || '';
            modal.classList.remove('hidden');
        }
    }

    syncBtn.addEventListener('click', () => {
        vscode.postMessage({
            type: 'sync'
        });
    });

    function clearModal() {
        document.getElementById('entry-name').value = '';
        document.getElementById('entry-content').value = '';
        document.getElementById('entry-color').value = '#007acc';
        document.getElementById('entry-icon').value = '';
    }

    function save() {
        vscode.postMessage({
            type: 'saveData',
            value: state.entries
        });
    }

    // Message handling
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'dataLoaded':
                state.entries = message.value || [];
                render();
                break;
            case 'triggerAdd':
                modal.classList.remove('hidden');
                break;
        }
    });

    function render() {
        listContainer.innerHTML = '';

        const filtered = state.entries
            .filter(e => e.type === state.activeTab)
            .filter(e => e.name.toLowerCase().includes(state.searchQuery) || e.content.toLowerCase().includes(state.searchQuery))
            .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        filtered.forEach(entry => {
            const el = document.createElement('div');
            el.className = 'entry-item';
            el.innerHTML = `
                <div class="entry-color-dot" style="background-color: ${entry.color}"></div>
                <div class="entry-info">
                    <div class="entry-name">${entry.name}</div>
                </div>
                <div class="entry-actions">
                    <button class="action-btn copy-btn" title="Copy">📋</button>
                    <button class="action-btn edit-btn" title="Edit">✏️</button>
                    <button class="action-btn pin-btn" title="Pin">${entry.pinned ? '📍' : '📌'}</button>
                    <button class="action-btn delete-btn" title="Delete">🗑️</button>
                </div>
            `;

            el.addEventListener('click', () => {
                vscode.postMessage({
                    type: 'copyToClipboard',
                    value: entry.content
                });
            });

            el.querySelector('.copy-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                vscode.postMessage({
                    type: 'copyToClipboard',
                    value: entry.content
                });
            });

            el.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                editEntry(entry.id);
            });

            el.querySelector('.pin-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                entry.pinned = !entry.pinned;
                save();
                render();
            });

            el.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                state.entries = state.entries.filter(e => e.id !== entry.id);
                save();
                render();
            });

            listContainer.appendChild(el);
        });
    }
})();