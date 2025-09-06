// Board management module
class BoardManager {
    constructor() {
        this.currentBoard = null;
        this.isOwner = false;
    }

    // Load and display all boards
    async loadDashboard() {
        try {
            this.showLoadingState();
            
            const boards = await api.getBoards();
            const currentUser = auth.getCurrentUser();
            
            // Separate own boards from public boards
            const myBoards = boards.filter(board => board.owner.id === currentUser.id);
            const publicBoards = boards.filter(board => board.owner.id !== currentUser.id);
            
            this.renderBoardsGrid(myBoards, 'boardsGrid');
            this.renderBoardsGrid(publicBoards, 'publicBoardsGrid');
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showEmptyState('boardsGrid', 'Erro ao carregar boards');
            this.showEmptyState('publicBoardsGrid', 'Erro ao carregar boards públicos');
        } finally {
            this.hideLoadingState();
        }
    }

    // Render boards grid
    renderBoardsGrid(boards, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (boards.length === 0) {
            this.showEmptyState(containerId, 
                containerId === 'boardsGrid' 
                    ? 'Você ainda não criou nenhum board' 
                    : 'Nenhum board público disponível'
            );
            return;
        }

        container.innerHTML = boards.map(board => this.renderBoardCard(board)).join('');
        
        // Add click listeners
        container.querySelectorAll('.board-card').forEach(card => {
            card.addEventListener('click', () => {
                const boardId = card.dataset.boardId;
                this.openBoard(boardId);
            });
        });
    }

    // Render individual board card
    renderBoardCard(board) {
        const totalCards = board.columns.reduce((sum, col) => sum + col.count, 0);
        
        return `
            <div class="board-card" data-board-id="${board.id}">
                <h3 class="board-card-title">${this.escapeHtml(board.title)}</h3>
                <p class="board-card-description">${this.escapeHtml(board.description || 'Sem descrição')}</p>
                <div class="board-card-meta">
                    <span class="board-card-owner">Por: ${this.escapeHtml(board.owner.name)}</span>
                    <div class="board-card-stats">
                        <span>${board.columns.length} colunas</span>
                        <span>${totalCards} cards</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Open board view
    async openBoard(boardId) {
        try {
            this.showLoadingState();
            
            const board = await api.getBoard(boardId);
            const currentUser = auth.getCurrentUser();
            
            this.currentBoard = board;
            this.isOwner = board.owner.id === currentUser.id;
            
            this.renderBoardView(board);
            this.showView('boardView');
            
        } catch (error) {
            console.error('Error loading board:', error);
        } finally {
            this.hideLoadingState();
        }
    }

    // Render board view
    renderBoardView(board) {
        // Update board header
        document.getElementById('boardTitle').textContent = board.title;
        document.getElementById('boardDescription').textContent = board.description || 'Sem descrição';
        document.getElementById('boardOwner').textContent = board.owner.name;
        
        // Show/hide owner actions
        const ownerActions = document.getElementById('ownerActions');
        if (this.isOwner) {
            ownerActions.classList.remove('hidden');
        } else {
            ownerActions.classList.add('hidden');
        }
        
        // Render kanban board
        this.renderKanbanBoard(board);
    }

    // Render kanban board with columns and cards
    renderKanbanBoard(board) {
        const kanbanBoard = document.getElementById('kanbanBoard');
        if (!kanbanBoard) return;

        // Sort columns by order
        const sortedColumns = [...board.columns].sort((a, b) => a.order - b.order);
        
        kanbanBoard.innerHTML = sortedColumns.map(column => {
            const columnCards = board.cards.filter(card => card.column_id === column.id);
            return this.renderColumn(column, columnCards);
        }).join('');
        
        // Initialize drag & drop for each column
        this.initializeDragAndDrop();
    }

    // Render individual column
    renderColumn(column, cards) {
        const isAtLimit = cards.length >= column.wip_limit;
        const limitClass = isAtLimit ? 'at-limit' : '';
        
        return `
            <div class="kanban-column ${limitClass}" data-column-id="${column.id}">
                <div class="column-header">
                    <div>
                        <h3 class="column-title">${this.escapeHtml(column.name)}</h3>
                        <span class="column-count">${cards.length}/${column.wip_limit}</span>
                    </div>
                    ${this.isOwner ? `
                        <div class="column-actions">
                            <button class="btn btn-icon btn-sm" onclick="boardManager.editColumn(${column.id})" title="Editar coluna">
                                ✏️
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div class="column-body" data-column-id="${column.id}">
                    ${cards.map(card => this.renderCard(card)).join('')}
                    ${auth.isAuthenticated() ? `
                        <button class="column-add-card" onclick="boardManager.showCreateCardModal(${column.id})">
                            ➕ Adicionar Card
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Render individual card
    renderCard(card) {
        const currentUser = auth.getCurrentUser();
        const canEdit = currentUser && (this.isOwner || card.created_by === currentUser.id);
        
        return `
            <div class="kanban-card" data-card-id="${card.id}" draggable="true">
                <h4 class="card-title">${this.escapeHtml(card.title)}</h4>
                ${card.description ? `<p class="card-description">${this.escapeHtml(card.description)}</p>` : ''}
                <div class="card-footer">
                    <span class="card-author">Por: ${this.escapeHtml(card.creator?.name || 'Anônimo')}</span>
                    ${canEdit ? `
                        <div class="card-actions">
                            <button class="card-action" onclick="boardManager.editCard(${card.id})" title="Editar">
                                ✏️
                            </button>
                            <button class="card-action danger" onclick="boardManager.deleteCard(${card.id})" title="Excluir">
                                🗑️
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Initialize drag and drop
    initializeDragAndDrop() {
        const columns = document.querySelectorAll('.column-body');
        
        columns.forEach(column => {
            new Sortable(column, {
                group: 'kanban',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'dragging',
                onStart: (evt) => {
                    // Add visual feedback
                    evt.item.classList.add('dragging');
                },
                onEnd: async (evt) => {
                    evt.item.classList.remove('dragging');
                    
                    const cardId = evt.item.dataset.cardId;
                    const newColumnId = evt.to.dataset.columnId;
                    const oldColumnId = evt.from.dataset.columnId;
                    
                    if (newColumnId !== oldColumnId) {
                        await this.moveCard(cardId, newColumnId, evt.newIndex);
                    }
                }
            });
        });
    }

    // Move card to different column
    async moveCard(cardId, newColumnId, position) {
        try {
            await api.moveCard(cardId, {
                to_column_id: parseInt(newColumnId),
                position: position === 0 ? 'top' : 'bottom'
            });
            
            // Reload board to reflect changes
            await this.openBoard(this.currentBoard.id);
            
            api.showSuccess('Card movido!', 'Card foi movido com sucesso.');
            
        } catch (error) {
            console.error('Error moving card:', error);
            // Reload board to revert visual changes
            await this.openBoard(this.currentBoard.id);
        }
    }

    // Show create board modal
    showCreateBoardModal() {
        const modal = document.getElementById('createBoardModal');
        const form = document.getElementById('createBoardForm');
        
        form.reset();
        modal.classList.add('active');
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('boardTitleInput').focus();
        }, 100);
    }

    // Handle create board form
    async handleCreateBoard(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const boardData = Object.fromEntries(formData);
        
        try {
            const newBoard = await api.createBoard(boardData);
            
            this.hideModal('createBoardModal');
            
            api.showSuccess('Board criado!', 'Novo board foi criado com sucesso.');
            
            // Reload dashboard
            this.loadDashboard();
            
        } catch (error) {
            console.error('Error creating board:', error);
        }
    }

    // Show create card modal
    showCreateCardModal(columnId) {
        const modal = document.getElementById('createCardModal');
        const form = document.getElementById('createCardForm');
        
        form.reset();
        document.getElementById('cardColumnId').value = columnId;
        modal.classList.add('active');
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('cardTitleInput').focus();
        }, 100);
    }

    // Handle create card form
    async handleCreateCard(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const cardData = Object.fromEntries(formData);
        
        try {
            await api.createCard(this.currentBoard.id, cardData);
            
            this.hideModal('createCardModal');
            
            api.showSuccess('Card criado!', 'Novo card foi criado com sucesso.');
            
            // Reload board
            await this.openBoard(this.currentBoard.id);
            
        } catch (error) {
            console.error('Error creating card:', error);
        }
    }

    // Edit card
    async editCard(cardId) {
    const card = this.currentBoard.cards.find(c => c.id == cardId);
    if (!card) {
        console.error('Card não encontrado!');
        return;
    }

    try {
        const { value: formValues } = await Swal.fire({
            title: 'Editar Card',
            html: `
                <div class="swal-form">
                    <div class="form-group">
                        <label for="swal-card-title">Título</label>
                        <input type="text" id="swal-card-title" class="swal2-input" value="${this.escapeHtml(card.title)}" maxlength="120" required>
                    </div>
                    <div class="form-group">
                        <label for="swal-card-desc">Descrição</label>
                        <textarea id="swal-card-desc" class="swal2-textarea" rows="4">${this.escapeHtml(card.description || '')}</textarea>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Salvar Alterações',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const title = document.getElementById('swal-card-title').value.trim();
                const description = document.getElementById('swal-card-desc').value.trim();
                if (!title) {
                    Swal.showValidationMessage('O título do card é obrigatório');
                    return false;
                }
                return { title, description };
            }
        });

        if (formValues) {
            await api.updateCard(cardId, formValues);
            api.showSuccess('Card atualizado!', 'As alterações foram salvas com sucesso.');
            this.openBoard(this.currentBoard.id); // Recarrega o quadro para mostrar a atualização
        }
    } catch (error) {
        console.error('Error editing card:', error);
        // O erro já é tratado pelo api.js
    }
}


    // Delete card
    async deleteCard(cardId) {
        try {
            const result = await Swal.fire({
                title: 'Excluir card?',
                text: 'Esta ação não pode ser desfeita.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sim, excluir',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280'
            });
            
            if (result.isConfirmed) {
                await api.deleteCard(cardId);
                
                api.showSuccess('Card excluído!', 'Card foi removido com sucesso.');
                
                // Reload board
                await this.openBoard(this.currentBoard.id);
            }
        } catch (error) {
            console.error('Error deleting card:', error);
        }
    }

    // <-- NOVA FUNÇÃO ADICIONADA AQUI -->
    async editColumn(columnId) {
        if (!this.isOwner) return;

        const column = this.currentBoard.columns.find(c => c.id == columnId);
        if (!column) return;

        try {
            const { value: formValues } = await Swal.fire({
                title: 'Editar Coluna',
                html: `
                    <div class="swal-form">
                        <div class="form-group">
                            <label for="swal-column-name">Nome da Coluna</label>
                            <input type="text" id="swal-column-name" class="swal2-input" value="${this.escapeHtml(column.name)}" maxlength="40" required>
                        </div>
                        <div class="form-group">
                            <label for="swal-column-wip">Limite WIP</label>
                            <input type="number" id="swal-column-wip" class="swal2-input" value="${column.wip_limit}" min="0" required>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Salvar',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    const name = document.getElementById('swal-column-name').value.trim();
                    const wip_limit = parseInt(document.getElementById('swal-column-wip').value);
                    if (!name) {
                        Swal.showValidationMessage('O nome da coluna é obrigatório');
                        return false;
                    }
                    if (isNaN(wip_limit) || wip_limit < 0) {
                         Swal.showValidationMessage('O limite WIP deve ser um número válido');
                        return false;
                    }
                    return { name, wip_limit };
                }
            });

            if (formValues) {
                await api.updateColumn(columnId, formValues);
                api.showSuccess('Coluna atualizada!', 'As alterações foram salvas.');
                this.openBoard(this.currentBoard.id); // Recarrega o quadro
            }
        } catch (error) {
            console.error('Error editing column:', error);
            // O erro já é tratado pelo api.js
        }
    }
    
    // Utility methods
    showView(viewId) {
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    }

    showLoadingState() {
        document.getElementById('loadingScreen').classList.remove('hidden');
    }

    hideLoadingState() {
        document.getElementById('loadingScreen').classList.add('hidden');
    }

    showEmptyState(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-title">${message}</div>
                </div>
            `;
        }
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global board manager
const boardManager = new BoardManager();