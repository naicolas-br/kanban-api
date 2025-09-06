// Card management module
class CardManager {
    constructor() {
        this.draggedCard = null;
        this.draggedFromColumn = null;
    }

    // Enhanced drag and drop with visual feedback
    initializeDragAndDrop() {
        document.addEventListener('dragstart', this.handleDragStart.bind(this));
        document.addEventListener('dragend', this.handleDragEnd.bind(this));
        document.addEventListener('dragover', this.handleDragOver.bind(this));
        document.addEventListener('drop', this.handleDrop.bind(this));
        document.addEventListener('dragenter', this.handleDragEnter.bind(this));
        document.addEventListener('dragleave', this.handleDragLeave.bind(this));
    }

    handleDragStart(e) {
        if (!e.target.classList.contains('kanban-card')) return;
        
        this.draggedCard = e.target;
        this.draggedFromColumn = e.target.closest('.column-body');
        
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        
        // Add visual feedback to valid drop zones
        document.querySelectorAll('.column-body').forEach(column => {
            if (column !== this.draggedFromColumn) {
                column.classList.add('drag-target');
            }
        });
    }

    handleDragEnd(e) {
        if (!e.target.classList.contains('kanban-card')) return;
        
        e.target.classList.remove('dragging');
        
        // Remove all drag-related classes
        document.querySelectorAll('.column-body').forEach(column => {
            column.classList.remove('drag-target', 'drag-over');
        });
        
        this.draggedCard = null;
        this.draggedFromColumn = null;
    }

    handleDragOver(e) {
        if (!this.draggedCard) return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e) {
        if (!this.draggedCard) return;
        
        const columnBody = e.target.closest('.column-body');
        if (columnBody && columnBody !== this.draggedFromColumn) {
            columnBody.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        if (!this.draggedCard) return;
        
        const columnBody = e.target.closest('.column-body');
        if (columnBody && !columnBody.contains(e.relatedTarget)) {
            columnBody.classList.remove('drag-over');
        }
    }

    async handleDrop(e) {
        if (!this.draggedCard) return;
        
        e.preventDefault();
        
        const targetColumn = e.target.closest('.column-body');
        if (!targetColumn || targetColumn === this.draggedFromColumn) return;
        
        const cardId = this.draggedCard.dataset.cardId;
        const newColumnId = targetColumn.dataset.columnId;
        const position = this.calculateDropPosition(e, targetColumn);
        
        try {
            // Show loading state
            this.draggedCard.style.opacity = '0.5';
            
            await boardManager.moveCard(cardId, newColumnId, position);
            
        } catch (error) {
            console.error('Error in drag and drop:', error);
            // Visual feedback is handled by the moveCard method
        }
    }

    calculateDropPosition(e, targetColumn) {
        const cards = [...targetColumn.querySelectorAll('.kanban-card')];
        const mouseY = e.clientY;
        
        let insertPosition = cards.length;
        
        for (let i = 0; i < cards.length; i++) {
            const cardRect = cards[i].getBoundingClientRect();
            const cardMiddle = cardRect.top + cardRect.height / 2;
            
            if (mouseY < cardMiddle) {
                insertPosition = i;
                break;
            }
        }
        
        return insertPosition;
    }

    // Card editing functionality
    async showEditCardModal(cardId) {
        try {
            const card = boardManager.currentBoard.cards.find(c => c.id == cardId);
            if (!card) return;
            
            const result = await Swal.fire({
                title: 'Editar Card',
                html: `
                    <div class="swal-form">
                        <div class="form-group">
                            <label for="swal-title">Título</label>
                            <input type="text" id="swal-title" class="swal2-input" value="${card.title}" maxlength="120" required>
                        </div>
                        <div class="form-group">
                            <label for="swal-description">Descrição</label>
                            <textarea id="swal-description" class="swal2-textarea" rows="4">${card.description || ''}</textarea>
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Salvar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4f46e5',
                cancelButtonColor: '#6b7280',
                preConfirm: () => {
                    const title = document.getElementById('swal-title').value.trim();
                    const description = document.getElementById('swal-description').value.trim();
                    
                    if (!title) {
                        Swal.showValidationMessage('Título é obrigatório');
                        return false;
                    }
                    
                    return { title, description };
                }
            });
            
            if (result.isConfirmed) {
                await this.updateCard(cardId, result.value);
            }
            
        } catch (error) {
            console.error('Error showing edit card modal:', error);
        }
    }

    async updateCard(cardId, cardData) {
        try {
            await api.updateCard(cardId, cardData);
            
            api.showSuccess('Card atualizado!', 'As alterações foram salvas com sucesso.');
            
            // Reload board
            await boardManager.openBoard(boardManager.currentBoard.id);
            
        } catch (error) {
            console.error('Error updating card:', error);
        }
    }

    // Card history viewer
    async showCardHistory(cardId) {
        try {
            const history = await api.getCardHistory(cardId);
            const card = boardManager.currentBoard.cards.find(c => c.id == cardId);
            
            const historyHtml = history.length > 0 ? 
                history.map(entry => this.renderHistoryEntry(entry)).join('') :
                '<p class="text-secondary">Nenhum histórico disponível.</p>';
            
            Swal.fire({
                title: `Histórico: ${card.title}`,
                html: `
                    <div class="card-history">
                        ${historyHtml}
                    </div>
                `,
                width: '600px',
                confirmButtonText: 'Fechar',
                confirmButtonColor: '#4f46e5'
            });
            
        } catch (error) {
            console.error('Error loading card history:', error);
        }
    }

    renderHistoryEntry(entry) {
        const icons = {
            created: '➕',
            moved: '🔄',
            updated: '✏️',
            deleted: '🗑️'
        };
        
        const icon = icons[entry.type] || '📝';
        const date = new Date(entry.at).toLocaleString('pt-BR');
        
        let description = '';
        switch (entry.type) {
            case 'created':
                description = `Criado na coluna "${entry.to_column?.name}"`;
                break;
            case 'moved':
                description = `Movido de "${entry.from_column?.name}" para "${entry.to_column?.name}"`;
                break;
            case 'updated':
                description = 'Card foi editado';
                break;
            case 'deleted':
                description = 'Card foi excluído';
                break;
        }
        
        return `
            <div class="history-entry">
                <div class="history-icon">${icon}</div>
                <div class="history-content">
                    <div class="history-description">${description}</div>
                    <div class="history-meta">
                        Por ${entry.by_user?.name} em ${date}
                    </div>
                </div>
            </div>
        `;
    }

    // Quick actions menu for cards
    showCardActions(cardId, event) {
        event.stopPropagation();
        
        const card = boardManager.currentBoard.cards.find(c => c.id == cardId);
        const currentUser = auth.getCurrentUser();
        const canEdit = currentUser && (boardManager.isOwner || card.created_by === currentUser.id);
        
        const actions = [
            {
                text: 'Ver Histórico',
                icon: '📜',
                action: () => this.showCardHistory(cardId)
            }
        ];
        
        if (canEdit) {
            actions.unshift(
                {
                    text: 'Editar',
                    icon: '✏️',
                    action: () => this.showEditCardModal(cardId)
                },
                {
                    text: 'Excluir',
                    icon: '🗑️',
                    action: () => boardManager.deleteCard(cardId),
                    danger: true
                }
            );
        }
        
        this.showContextMenu(event, actions);
    }

    showContextMenu(event, actions) {
        // Remove existing context menu
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.top = `${event.clientY}px`;
        menu.style.left = `${event.clientX}px`;
        menu.style.zIndex = '10000';
        
        menu.innerHTML = actions.map(action => `
            <div class="context-menu-item ${action.danger ? 'danger' : ''}" data-action="${actions.indexOf(action)}">
                <span class="context-menu-icon">${action.icon}</span>
                <span class="context-menu-text">${action.text}</span>
            </div>
        `).join('');
        
        document.body.appendChild(menu);
        
        // Handle clicks
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item) {
                const actionIndex = parseInt(item.dataset.action);
                actions[actionIndex].action();
                menu.remove();
            }
        });
        
        // Remove on outside click
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 0);
    }

    // Keyboard shortcuts for cards
    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.key === 'n' && e.ctrlKey) {
                e.preventDefault();
                // Focus on first "Add Card" button
                const addButton = document.querySelector('.column-add-card');
                if (addButton) addButton.click();
            }
        });
    }

    // Batch operations for cards
    async moveMultipleCards(cardIds, targetColumnId) {
        const promises = cardIds.map(cardId => 
            api.moveCard(cardId, { to_column_id: targetColumnId })
        );
        
        try {
            await Promise.all(promises);
            api.showSuccess('Cards movidos!', `${cardIds.length} cards foram movidos com sucesso.`);
            await boardManager.openBoard(boardManager.currentBoard.id);
        } catch (error) {
            console.error('Error moving multiple cards:', error);
        }
    }

    // Search and filter cards
    filterCards(searchTerm) {
        const cards = document.querySelectorAll('.kanban-card');
        const term = searchTerm.toLowerCase();
        
        cards.forEach(card => {
            const title = card.querySelector('.card-title').textContent.toLowerCase();
            const description = card.querySelector('.card-description')?.textContent.toLowerCase() || '';
            
            if (title.includes(term) || description.includes(term)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }
}

// Create global card manager
const cardManager = new CardManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    cardManager.initializeDragAndDrop();
    cardManager.initializeKeyboardShortcuts();
});