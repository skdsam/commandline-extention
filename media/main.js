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
            label: 'Bookmark',
            icon: 'bookmark'
        },
        {
            label: 'Lightbulb',
            icon: 'lightbulb'
        },
        {
            label: 'Archive',
            icon: 'archive'
        },
        {
            label: 'Dashboard',
            icon: 'dashboard'
        },
        {
            label: 'Link',
            icon: 'link'
        },
        {
            label: 'Lock',
            icon: 'lock'
        },
        {
            label: 'Key',
            icon: 'key'
        },
        {
            label: 'Tag',
            icon: 'tag'
        },
        {
            label: 'Workspace',
            icon: 'layers'
        },
        {
            label: 'Checklist',
            icon: 'checklist'
        },
        {
            label: 'Quote',
            icon: 'quote'
        },
        {
            label: 'Note',
            icon: 'note'
        },
        {
            label: 'Megaphone',
            icon: 'megaphone'
        },
        {
            label: 'Verified',
            icon: 'verified'
        },
        {
            label: 'Sparkle',
            icon: 'sparkle'
        },
        {
            label: 'Design',
            icon: 'paintcan'
        },
        {
            label: 'Layout',
            icon: 'layout'
        },
        {
            label: 'Pencil',
            icon: 'pencil'
        },
        {
            label: 'Ruler',
            icon: 'symbol-ruler'
        },
        {
            label: 'Browser',
            icon: 'browser'
        },
        {
            label: 'Symbol Color',
            icon: 'symbol-color'
        }
    ];

    const COLORS = [{
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
        subscriptions: [],
        searchQuery: '',
        selectedIcon: ICONS[0],
        selectedColor: COLORS[0],
        collapsedGroups: {},
        isSubscribedReposOpen: false,
        currentUser: null
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
    const collapseAllBtn = document.getElementById('collapse-all-btn');
    const expandAllBtn = document.getElementById('expand-all-btn');
    const syncBtn = document.getElementById('sync-btn');
    const pullBtn = document.getElementById('pull-btn');
    const missingReposContainer = document.getElementById('missing-repos-container');
    const missingReposList = document.getElementById('missing-repos-list');
    const missingReposHeader = document.getElementById('missing-repos-header');
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

    // Collapse/Expand All
    collapseAllBtn.addEventListener('click', () => {
        // Set all current groups to collapsed
        const filtered = state.entries.filter(e => state.activeTab === 'pinned' ? e.pinned : (e.type === state.activeTab || e.type === state.activeTab.slice(0, -1)));
        const iconNames = [...new Set(filtered.map(e => e.icon || ((e.type === 'prompts' || e.type === 'prompt') ? 'terminal' : 'symbol-folder')))];
        iconNames.forEach(iconName => {
            state.collapsedGroups[iconName] = true;
        });
        render();
    });

    expandAllBtn.addEventListener('click', () => {
        // Set all current groups to expanded
        const filtered = state.entries.filter(e => state.activeTab === 'pinned' ? e.pinned : (e.type === state.activeTab || e.type === state.activeTab.slice(0, -1)));
        const iconNames = [...new Set(filtered.map(e => e.icon || ((e.type === 'prompts' || e.type === 'prompt') ? 'terminal' : 'symbol-folder')))];
        iconNames.forEach(iconName => {
            state.collapsedGroups[iconName] = false;
        });
        render();
    });

    let editingId = null;

    // Modal logic
    addBtn.addEventListener('click', () => {
        editingId = null;
        document.getElementById('modal-title').textContent = 'Add Entry';
        clearModal();
        setModalReadOnly(false);
        modal.classList.remove('hidden');
    });

    cancelModal.addEventListener('click', () => {
        modal.classList.add('hidden');
        hideDropdowns();
    });

    saveModal.addEventListener('click', () => {
        const nameInput = document.getElementById('entry-name');
        const contentInput = document.getElementById('entry-content');
        const notesInput = document.getElementById('entry-notes');
        const name = nameInput.value.trim();
        const content = contentInput.value.trim();
        const notes = notesInput.value.trim();

        console.log('Attempting to save:', {
            name,
            content,
            notes,
            activeTab: state.activeTab
        });

        if (!name || !content) {
            alert('Please enter both a name and some content.');
            return;
        }

        try {
            if (editingId) {
                const entry = state.entries.find(e => e.id === editingId);
                if (entry) {
                    entry.name = name;
                    entry.content = content;
                    entry.notes = notes;
                    entry.color = state.selectedColor.color;
                    entry.icon = state.selectedIcon.icon;
                }
            } else {
                const entry = {
                    id: Date.now().toString(),
                    type: state.activeTab === 'pinned' ? 'commands' : state.activeTab,
                    name,
                    content,
                    notes,
                    color: state.selectedColor.color,
                    icon: state.selectedIcon.icon,
                    pinned: state.activeTab === 'pinned'
                };
                state.entries.push(entry);
                console.log('New entry added:', entry);
            }
            save();
            render();
            modal.classList.add('hidden');
            hideDropdowns();
            console.log('Save successful');
        } catch (err) {
            console.error('Error during save:', err);
            alert('Error saving entry: ' + err.message);
        }
    });

    function editEntry(id, isReadOnly = false) {
        const entry = state.entries.find(e => e.id === id);
        if (entry) {
            editingId = id;
            document.getElementById('modal-title').textContent = isReadOnly ? 'View Detail' : 'Edit Entry';
            document.getElementById('entry-name').value = entry.name;
            document.getElementById('entry-content').value = entry.content;
            document.getElementById('entry-notes').value = entry.notes || '';

            const savedIcon = ICONS.find(i => i.icon === entry.icon) || ICONS[0];
            const savedColor = COLORS.find(c => c.color === entry.color) || COLORS[0];

            updateIconSelection(savedIcon);
            updateColorSelection(savedColor);

            setModalReadOnly(isReadOnly);
            modal.classList.remove('hidden');
        }
    }

    // Picker Logic
    iconTrigger.addEventListener('click', (e) => {
        if (modal.dataset.readonly === 'true') return;
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
        if (modal.dataset.readonly === 'true') return;
        e.stopPropagation();
        const rect = colorTrigger.getBoundingClientRect();
        colorDropdown.style.top = `${rect.bottom + 4}px`;
        colorDropdown.style.left = `${rect.left}px`;
        colorDropdown.classList.toggle('hidden');
        iconDropdown.classList.add('hidden');
        colorSearch.focus();
        renderColorList();
    });

    function renderIconList(filterQuery = '') {
        iconList.innerHTML = '';
        const filteredIcons = ICONS.filter(i => i.label.toLowerCase().includes(filterQuery.toLowerCase()));

        filteredIcons.forEach(icon => {
            const div = document.createElement('div');
            div.className = 'picker-item';
            div.innerHTML = `
                <span class="codicon codicon-${icon.icon}"></span>
                <span>${icon.label}</span>
            `;
            div.addEventListener('click', () => {
                updateIconSelection(icon);
                iconDropdown.classList.add('hidden');
            });
            iconList.appendChild(div);
        });
    }

    function renderColorList(filterQuery = '') {
        colorList.innerHTML = '';
        const filteredColors = COLORS.filter(c => c.label.toLowerCase().includes(filterQuery.toLowerCase()));

        filteredColors.forEach(color => {
            const div = document.createElement('div');
            div.className = 'picker-item';
            div.innerHTML = `
                <div class="color-dot" style="background-color: ${color.color};"></div>
                <span>${color.label}</span>
            `;
            div.addEventListener('click', () => {
                updateColorSelection(color);
                colorDropdown.classList.add('hidden');
            });
            colorList.appendChild(div);
        });
    }

    iconSearch.addEventListener('input', (e) => {
        renderIconList(e.target.value);
    });

    colorSearch.addEventListener('input', (e) => {
        renderColorList(e.target.value);
    });

    function updateIconSelection(icon) {
        state.selectedIcon = icon;
        const display = document.getElementById('current-icon-display');
        const name = document.getElementById('current-icon-name');
        display.className = `codicon codicon-${icon.icon}`;
        name.textContent = icon.label;
    }

    function updateColorSelection(color) {
        state.selectedColor = color;
        const display = document.getElementById('current-color-display');
        const name = document.getElementById('current-color-name');
        display.style.backgroundColor = color.color;
        name.textContent = color.label;
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

    pullBtn.addEventListener('click', () => {
        vscode.postMessage({
            type: 'pull'
        });
    });

    function setModalReadOnly(isReadOnly) {
        modal.dataset.readonly = isReadOnly;
        document.getElementById('entry-name').readOnly = isReadOnly;
        document.getElementById('entry-content').readOnly = isReadOnly;
        document.getElementById('entry-notes').readOnly = isReadOnly;

        if (isReadOnly) {
            saveModal.classList.add('hidden');
            cancelModal.textContent = 'Close';
        } else {
            saveModal.classList.remove('hidden');
            cancelModal.textContent = 'Cancel';
        }
    }

    function clearModal() {
        document.getElementById('entry-name').value = '';
        document.getElementById('entry-content').value = '';
        document.getElementById('entry-notes').value = '';
        updateIconSelection(ICONS[0]);
        updateColorSelection(COLORS[0]);
    }

    function save() {
        vscode.postMessage({
            type: 'saveData',
            value: state.entries
        });
    }

    // Periodically check for updates (every 5 minutes)
    setInterval(() => {
        vscode.postMessage({
            type: 'checkForUpdates'
        });
    }, 5 * 60 * 1000);

    // Message handling
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'dataLoaded':
                state.entries = message.value.items || [];
                state.subscriptions = message.value.subscriptions || [];
                state.currentUser = message.username || null;
                render();
                renderSubscriptions();
                break;
            case 'triggerAdd':
                addBtn.click();
                break;
            case 'updateStatus':
                if (message.value.behind > 0) {
                    pullBtn.classList.remove('hidden');
                    syncBtn.classList.add('hidden');
                } else {
                    pullBtn.classList.add('hidden');
                    syncBtn.classList.remove('hidden');
                }
                break;
            case 'missingReposLoaded':
                renderMissingRepos(message.value);
                break;
        }
    });

    function renderMissingRepos(repos) {
        if (!repos || repos.length === 0) {
            missingReposContainer.classList.add('hidden');
            return;
        }

        missingReposContainer.classList.remove('hidden');
        missingReposList.innerHTML = '';

        repos.forEach(repo => {
            const el = document.createElement('div');
            el.className = 'missing-repo-item';
            el.innerHTML = `
                <span class="codicon codicon-github"></span>
                <span class="missing-repo-name" title="${repo.full_name}">${repo.name}</span>
                <button class="download-icon-btn" title="Download to Scratch">
                    <span class="codicon codicon-cloud-download"></span>
                </button>
            `;

            el.querySelector('.download-icon-btn').addEventListener('click', () => {
                vscode.postMessage({
                    type: 'downloadRepo',
                    value: repo
                });
            });

            missingReposList.appendChild(el);
        });
    }

    missingReposHeader.addEventListener('click', () => {
        missingReposList.classList.toggle('hidden');
        const icon = missingReposHeader.querySelector('.codicon-chevron-down, .codicon-chevron-right');
        if (icon) {
            icon.classList.toggle('codicon-chevron-down');
            icon.classList.toggle('codicon-chevron-right');
        }
    });

    function render() {
        listContainer.innerHTML = '';

        const filtered = state.entries
            .filter(e => state.activeTab === 'pinned' ? e.pinned : (e.type === state.activeTab || e.type === state.activeTab.slice(0, -1)))
            .filter(e => {
                const query = state.searchQuery;
                const matchesSearch = e.name.toLowerCase().includes(query) ||
                    e.content.toLowerCase().includes(query) ||
                    (e.notes && e.notes.toLowerCase().includes(query)) ||
                    (e.source && e.source.toLowerCase().includes(query));
                return matchesSearch;
            })
            .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        // Group entries by icon
        const groupedByIcon = {};
        filtered.forEach(entry => {
            const defaultIcon = (entry.type === 'prompts' || entry.type === 'prompt') ? 'terminal' : 'symbol-folder';
            const iconName = entry.icon || defaultIcon;
            if (!groupedByIcon[iconName]) {
                groupedByIcon[iconName] = [];
            }
            groupedByIcon[iconName].push(entry);
        });

        // Render each icon group
        Object.keys(groupedByIcon).forEach(iconName => {
            const entries = groupedByIcon[iconName];
            const iconInfo = ICONS.find(i => i.icon === iconName) || {
                label: iconName,
                icon: iconName
            };
            const isCollapsed = state.searchQuery ? false : (state.collapsedGroups[iconName] !== false);

            // Create group header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'icon-group-header';
            groupHeader.innerHTML = `
                <span class="group-chevron codicon codicon-chevron-${isCollapsed ? 'right' : 'down'}"></span>
                <span class="group-icon codicon codicon-${iconName}"></span>
                <span class="group-label">${iconInfo.label}</span>
                <span class="group-count">(${entries.length})</span>
            `;

            groupHeader.addEventListener('click', () => {
                state.collapsedGroups[iconName] = !isCollapsed;
                render();
            });

            listContainer.appendChild(groupHeader);

            // Create group container
            if (!isCollapsed) {
                const groupContainer = document.createElement('div');
                groupContainer.className = 'icon-group-items';

                entries.forEach(entry => {
                    const el = document.createElement('div');
                    el.className = 'entry-item';

                    const iconColor = entry.color || 'var(--text-color)';
                    const pinIndicator = entry.pinned ? '<span class="pin-indicator" style="color: #e53935; margin-left: 4px;">📌</span>' : '';

                    const sourceBadge = entry.source && entry.source !== 'local' ?
                        `<span class="entry-source-badge" title="Source: ${entry.source}">@${entry.source}</span>` :
                        '';

                    // Determine if editable (local OR self-sourced)
                    const isEditable = !entry.source || entry.source === 'local' || (state.currentUser && entry.source === state.currentUser);

                    el.innerHTML = `
                        <div class="entry-icon">
                            <span class="codicon codicon-${iconName}" style="color: ${iconColor}"></span>
                        </div>
                        ${pinIndicator}
                        <div class="entry-info">
                            <div class="entry-name" title="${entry.name}">
                                ${entry.name}
                                ${sourceBadge}
                            </div>
                            ${entry.notes ? `<div class="entry-notes" title="${entry.notes}">${entry.notes}</div>` : ''}
                        </div>
                        <div class="entry-actions">
                            <button class="action-btn copy-btn" title="Copy Content"><span class="codicon codicon-copy"></span></button>
                            <button class="action-btn view-btn" title="View Detail"><span class="codicon codicon-eye"></span></button>
                            ${isEditable ? `<button class="action-btn edit-btn" title="Edit Entry"><span class="codicon codicon-edit"></span></button>` : ''}
                            <button class="action-btn pin-btn" title="${entry.pinned ? 'Unpin' : 'Pin'}"><span class="codicon codicon-${entry.pinned ? 'pin' : 'pinned'}"></span></button>
                            ${isEditable ? `<button class="action-btn delete-btn" title="Delete Entry"><span class="codicon codicon-trash"></span></button>` : ''}
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

                    el.querySelector('.view-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        editEntry(entry.id, true);
                    });

                    const editBtn = el.querySelector('.edit-btn');
                    if (editBtn) {
                        editBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            editEntry(entry.id, false);
                        });
                    }

                    el.querySelector('.pin-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        entry.pinned = !entry.pinned;
                        save();
                        render();
                    });

                    const deleteBtn = el.querySelector('.delete-btn');
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            state.entries = state.entries.filter(e => e.id !== entry.id);
                            save();
                            render();
                        });
                    }

                    groupContainer.appendChild(el);
                });

                listContainer.appendChild(groupContainer);
            }
        });
    }

    function renderSubscriptions() {
        // We'll inject the subscription UI into the sidebar
        let container = document.getElementById('subscriptions-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'subscriptions-container';
            container.className = 'subscriptions-container';
            const footer = document.querySelector('.sync-footer');
            footer.parentNode.insertBefore(container, footer);
        }

        container.innerHTML = `
            <div class="subscriptions-header" id="subs-header">
                <span class="codicon codicon-chevron-${state.isSubscribedReposOpen ? 'down' : 'right'}"></span>
                <span>Manage Sources</span>
                <span class="group-count">(${state.subscriptions.length})</span>
                <div style="flex:1"></div>
                <span class="codicon codicon-refresh" id="refresh-subs-btn" title="Refresh All" style="cursor:pointer; opacity:0.6"></span>
            </div>
            <div class="subscriptions-list ${state.isSubscribedReposOpen ? '' : 'hidden'}" id="subs-list">
                ${state.subscriptions.map(sub => `
                    <div class="subscription-item">
                        <div class="sub-status-dot ${sub.status === 'active' ? 'active' : 'unreachable'}" title="${sub.status}"></div>
                        <span class="sub-username" title="${sub.url}">@${sub.username}</span>
                        <div class="sub-actions">
                             <span class="codicon codicon-trash remove-sub-btn action-btn" data-id="${sub.id}" title="Remove Source" style="font-size:12px"></span>
                        </div>
                    </div>
                `).join('')}
                <div class="add-subscription-row">
                    <input type="text" id="add-sub-input" placeholder="GitHub Repo URL..." style="height:22px"/>
                    <button id="add-sub-btn">+</button>
                </div>
            </div>
        `;

        document.getElementById('subs-header').addEventListener('click', (e) => {
            if (e.target.id === 'refresh-subs-btn') {
                e.stopPropagation();
                vscode.postMessage({
                    type: 'refreshSubscriptions'
                });
                return;
            }
            state.isSubscribedReposOpen = !state.isSubscribedReposOpen;
            renderSubscriptions();
        });

        document.getElementById('add-sub-btn').addEventListener('click', () => {
            const input = document.getElementById('add-sub-input');
            const url = input.value.trim();
            if (url) {
                vscode.postMessage({
                    type: 'addSubscription',
                    value: url
                });
                input.value = '';
            }
        });

        document.querySelectorAll('.remove-sub-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                vscode.postMessage({
                    type: 'removeSubscription',
                    value: btn.dataset.id
                });
            });
        });
    }
})();