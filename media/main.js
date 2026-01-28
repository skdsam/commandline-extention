(function () {
    const vscode = acquireVsCodeApi();

    const ICONS = [{
            label: 'Folder',
            icon: 'symbol-folder'
        },
        {
            label: 'Root',
            icon: 'root-folder'
        },
        {
            label: 'Repository',
            icon: 'repo'
        },
        {
            label: 'Star',
            icon: 'star'
        },
        {
            label: 'Personal',
            icon: 'heart'
        },
        {
            label: 'Launch',
            icon: 'rocket'
        },
        {
            label: 'Experimental',
            icon: 'beaker'
        },
        {
            label: 'Research',
            icon: 'flask'
        },
        {
            label: 'Debug',
            icon: 'bug'
        },
        {
            label: 'Tools',
            icon: 'tools'
        },
        {
            label: 'Gear',
            icon: 'gear'
        },
        {
            label: 'Terminal',
            icon: 'terminal'
        },
        {
            label: 'Code',
            icon: 'code'
        },
        {
            label: 'Function',
            icon: 'symbol-method'
        },
        {
            label: 'Class',
            icon: 'symbol-class'
        },
        {
            label: 'Ruby',
            icon: 'ruby'
        },
        {
            label: 'Package',
            icon: 'package'
        },
        {
            label: 'Globe',
            icon: 'globe'
        },
        {
            label: 'Server',
            icon: 'server'
        },
        {
            label: 'Database',
            icon: 'database'
        },
        {
            label: 'Cloud',
            icon: 'cloud'
        },
        {
            label: 'Mobile',
            icon: 'device-mobile'
        },
        {
            label: 'Installer',
            icon: 'desktop-download'
        },
        {
            label: 'Plugins',
            icon: 'extensions'
        },
        {
            label: 'License',
            icon: 'law'
        },
        {
            label: 'Documentation',
            icon: 'book'
        },
        {
            label: 'Library',
            icon: 'library'
        },
        {
            label: 'Lock',
            icon: 'lock'
        },
        {
            label: 'Secure',
            icon: 'shield'
        },
        {
            label: 'Fast',
            icon: 'zap'
        },
        {
            label: 'Hot',
            icon: 'flame'
        },
        {
            label: 'Archive',
            icon: 'archive'
        },
        {
            label: 'Deprecated',
            icon: 'trash'
        },
        {
            label: 'GitHub',
            icon: 'github'
        }
    ];

    const COLORS = [{
            label: 'Default',
            color: 'var(--vscode-button-background)'
        },
        {
            label: 'Blue',
            color: 'var(--vscode-charts-blue)'
        },
        {
            label: 'Red',
            color: 'var(--vscode-charts-red)'
        },
        {
            label: 'Green',
            color: 'var(--vscode-charts-green)'
        },
        {
            label: 'Yellow',
            color: 'var(--vscode-charts-yellow)'
        },
        {
            label: 'Orange',
            color: 'var(--vscode-charts-orange)'
        },
        {
            label: 'Purple',
            color: 'var(--vscode-charts-purple)'
        },
        {
            label: 'Cyan',
            color: 'var(--vscode-terminal-ansiCyan)'
        },
        {
            label: 'Magenta',
            color: 'var(--vscode-terminal-ansiMagenta)'
        },
        {
            label: 'Bright Red',
            color: 'var(--vscode-terminal-ansiBrightRed)'
        },
        {
            label: 'Bright Green',
            color: 'var(--vscode-terminal-ansiBrightGreen)'
        },
        {
            label: 'Gray',
            color: 'var(--vscode-charts-lines)'
        }
    ];

    let state = {
        activeTab: 'commands',
        entries: [],
        searchQuery: '',
        selectedIcon: ICONS[0],
        selectedColor: COLORS[0]
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

    // Pickers
    const iconTrigger = document.getElementById('icon-picker-trigger');
    const colorTrigger = document.getElementById('color-picker-trigger');
    const iconDropdown = document.getElementById('icon-picker-dropdown');
    const colorDropdown = document.getElementById('color-picker-dropdown');
    const iconSearch = document.getElementById('icon-search');
    const colorSearch = document.getElementById('color-search');
    const iconList = document.getElementById('icon-list');
    const colorList = document.getElementById('color-list');

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
        hideDropdowns();
    });

    saveModal.addEventListener('click', () => {
        const name = document.getElementById('entry-name').value;
        const content = document.getElementById('entry-content').value;

        if (name && content) {
            if (editingId) {
                const entry = state.entries.find(e => e.id === editingId);
                if (entry) {
                    entry.name = name;
                    entry.content = content;
                    entry.color = state.selectedColor.color;
                    entry.icon = state.selectedIcon.icon;
                }
            } else {
                const entry = {
                    id: Date.now().toString(),
                    type: state.activeTab,
                    name,
                    content,
                    color: state.selectedColor.color,
                    icon: state.selectedIcon.icon,
                    pinned: false
                };
                state.entries.push(entry);
            }
            save();
            render();
            modal.classList.add('hidden');
            hideDropdowns();
        }
    });

    function editEntry(id) {
        const entry = state.entries.find(e => e.id === id);
        if (entry) {
            editingId = id;
            document.getElementById('modal-title').textContent = 'Edit Entry';
            document.getElementById('entry-name').value = entry.name;
            document.getElementById('entry-content').value = entry.content;

            const savedIcon = ICONS.find(i => i.icon === entry.icon) || ICONS[0];
            const savedColor = COLORS.find(c => c.color === entry.color) || COLORS[0];

            updateIconSelection(savedIcon);
            updateColorSelection(savedColor);

            modal.classList.remove('hidden');
        }
    }

    // Picker Logic
    iconTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = iconTrigger.getBoundingClientRect();
        iconDropdown.style.top = `${rect.bottom + 4}px`;
        iconDropdown.style.left = `${rect.left}px`;
        iconDropdown.classList.toggle('hidden');
        colorDropdown.classList.add('hidden');
        iconSearch.focus();
        renderIconList();
    });

    colorTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = colorTrigger.getBoundingClientRect();
        colorDropdown.style.top = `${rect.bottom + 4}px`;
        colorDropdown.style.left = `${rect.left}px`;
        colorDropdown.classList.toggle('hidden');
        iconDropdown.classList.add('hidden');
        colorSearch.focus();
        renderColorList();
    });

    iconSearch.addEventListener('input', () => renderIconList());
    colorSearch.addEventListener('input', () => renderColorList());

    function renderIconList() {
        const query = iconSearch.value.toLowerCase();
        iconList.innerHTML = '';
        ICONS.filter(i => i.label.toLowerCase().includes(query)).forEach(icon => {
            const el = document.createElement('div');
            el.className = 'picker-item';
            el.innerHTML = `<span class="codicon codicon-${icon.icon}"></span> ${icon.label}`;
            el.addEventListener('click', () => {
                updateIconSelection(icon);
                iconDropdown.classList.add('hidden');
            });
            iconList.appendChild(el);
        });
    }

    function renderColorList() {
        const query = colorSearch.value.toLowerCase();
        colorList.innerHTML = '';
        COLORS.filter(c => c.label.toLowerCase().includes(query)).forEach(color => {
            const el = document.createElement('div');
            el.className = 'picker-item';
            el.innerHTML = `<div class="color-dot" style="background-color: ${color.color}"></div> ${color.label}`;
            el.addEventListener('click', () => {
                updateColorSelection(color);
                colorDropdown.classList.add('hidden');
            });
            colorList.appendChild(el);
        });
    }

    function updateIconSelection(icon) {
        state.selectedIcon = icon;
        document.getElementById('current-icon-display').className = `codicon codicon-${icon.icon}`;
        document.getElementById('current-icon-name').textContent = icon.label;
    }

    function updateColorSelection(color) {
        state.selectedColor = color;
        document.getElementById('current-color-display').style.backgroundColor = color.color;
        document.getElementById('current-color-name').textContent = color.label;
    }

    function hideDropdowns() {
        iconDropdown.classList.add('hidden');
        colorDropdown.classList.add('hidden');
    }

    document.addEventListener('click', () => hideDropdowns());
    iconDropdown.addEventListener('click', (e) => e.stopPropagation());
    colorDropdown.addEventListener('click', (e) => e.stopPropagation());

    syncBtn.addEventListener('click', () => {
        vscode.postMessage({
            type: 'sync'
        });
    });

    function clearModal() {
        document.getElementById('entry-name').value = '';
        document.getElementById('entry-content').value = '';
        updateIconSelection(ICONS[0]);
        updateColorSelection(COLORS[0]);
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
                addBtn.click();
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
                <div class="entry-icon">
                    <span class="codicon codicon-${entry.icon || 'symbol-folder'}" style="color: ${entry.color}"></span>
                </div>
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