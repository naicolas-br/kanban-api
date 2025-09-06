// Main application initialization
class KanbanApp {
    constructor() {
        this.initialized = false;
        this.currentView = 'dashboard';
    }

    // Initialize the application
    async init() {
        if (this.initialized) return;
        
        try {
            // Check authentication
            if (!auth.requireAuth()) return;
            
            // Initialize components
            this.initializeEventListeners();
            this.initializeModals();
            this.loadInitialData();
            
            this.initialized = true;
            console.log('Kanban app initialized successfully');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showInitializationError();
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Navigation
        const backToDashboard = document.getElementById('backToDashboard');
        if (backToDashboard) {
            backToDashboard.addEventListener('click', () => {
                this.showDashboard();
            });
        }

        // Board creation
        const createBoardBtn = document.getElementById('createBoardBtn');
        if (createBoardBtn) {
            createBoardBtn.addEventListener('click', () => {
                boardManager.showCreateBoardModal();
            });
        }

        // Form submissions
        const createBoardForm = document.getElementById('createBoardForm');
        if (createBoardForm) {
            createBoardForm.addEventListener('submit', boardManager.handleCreateBoard.bind(boardManager));
        }

        const createCardForm = document.getElementById('createCardForm');
        if (createCardForm) {
            createCardForm.addEventListener('submit', boardManager.handleCreateCard.bind(boardManager));
        }

        // Owner actions
        const editBoardBtn = document.getElementById('editBoardBtn');
        if (editBoardBtn) {
            editBoardBtn.addEventListener('click', () => {
                this.showEditBoardModal();
            });
        }

        const addColumnBtn = document.getElementById('addColumnBtn');
        if (addColumnBtn) {
            addColumnBtn.addEventListener('click', () => {
                this.showAddColumnModal();
            });
        }

        // Keyboard shortcuts
        this.initializeKeyboardShortcuts();
    }

    // Initialize modals
    initializeModals() {
        // Generic modal close functionality
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('active');
            }
            
            if (e.target.classList.contains('modal-close')) {
                const modal = e.target.closest('.modal');
                if (modal) modal.classList.remove('active');
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    activeModal.classList.remove('active');
                }
            }
        });
    }

    // Load initial dashboard data
    async loadInitialData() {
        this.showDashboard();
    }

    // Show dashboard view
    async showDashboard() {
        this.currentView = 'dashboard';
        boardManager.showView('dashboardView');
        await boardManager.loadDashboard();
        
        // Update page title
        document.title = 'Kanban Board - Dashboard';
    }

    // Show board view
    showBoard(boardId) {
        this.currentView = 'board';
        boardManager.openBoard(boardId);
    }

    // Edit board modal
    async showEditBoardModal() {
        if (!boardManager.currentBoard || !boardManager.isOwner) return;
        
        const board = boardManager.currentBoard;
        
        const result = await Swal.fire({
            title: 'Editar Board',
            html: `
                <div class="swal-form">
                    <div class="form-group">
                        <label for="swal-board-title">Título</label>
                        <input type="text" id="swal-board-title" class="swal2-input" value="${board.title}" maxlength="80" required>
                    </div>
                    <div class="form-group">
                        <label for="swal-board-description">Descrição</label>
                        <textarea id="swal-board-description" class="swal2-textarea" rows="3">${board.description || ''}</textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Salvar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#6b7280',
            preConfirm: () => {
                const title = document.getElementById('swal-board-title').value.trim();
                const description = document.getElementById('swal-board-description').value.trim();
                
                if (!title) {
                    Swal.showValidationMessage('Título é obrigatório');
                    return false;
                }
                
                return { title, description };
            }
        });
        
        if (result.isConfirmed) {
            try {
                await api.updateBoard(board.id, result.value);
                api.showSuccess('Board atualizado!', 'As alterações foram salvas com sucesso.');
                await boardManager.openBoard(board.id);
            } catch (error) {
                console.error('Error updating board:', error);
            }
        }
    }

    // Add column modal
    async showAddColumnModal() {
        if (!boardManager.currentBoard || !boardManager.isOwner) return;
        
        const result = await Swal.fire({
            title: 'Nova Coluna',
            html: `
                <div class="swal-form">
                    <div class="form-group">
                        <label for="swal-column-name">Nome da Coluna</label>
                        <input type="text" id="swal-column-name" class="swal2-input" maxlength="40" required>
                    </div>
                    <div class="form-group">
                        <label for="swal-column-wip">Limite WIP</label>
                        <input type="number" id="swal-column-wip" class="swal2-input" value="999" min="0" required>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Criar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#6b7280',
            preConfirm: () => {
                const name = document.getElementById('swal-column-name').value.trim();
                const wipLimit = parseInt(document.getElementById('swal-column-wip').value);
                
                if (!name) {
                    Swal.showValidationMessage('Nome é obrigatório');
                    return false;
                }
                
                if (isNaN(wipLimit) || wipLimit < 0) {
                    Swal.showValidationMessage('Limite WIP deve ser um número válido');
                    return false;
                }
                
                return { name, wip_limit: wipLimit };
            }
        });
        
        if (result.isConfirmed) {
            try {
                const columnData = {
                    ...result.value,
                    order: boardManager.currentBoard.columns.length + 1
                };
                
                await api.createColumn(boardManager.currentBoard.id, columnData);
                api.showSuccess('Coluna criada!', 'Nova coluna foi adicionada com sucesso.');
                await boardManager.openBoard(boardManager.currentBoard.id);
            } catch (error) {
                console.error('Error creating column:', error);
            }
        }
    }

    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
                return;
            }
            
            // Global shortcuts
            if (e.key === 'd' && e.altKey) {
                e.preventDefault();
                this.showDashboard();
            }
            
            if (e.key === 'b' && e.ctrlKey && e.altKey) {
                e.preventDefault();
                const createBtn = document.getElementById('createBoardBtn');
                if (createBtn && createBtn.style.display !== 'none') {
                    createBtn.click();
                }
            }
            
            if (e.key === 'h' && e.altKey) {
                e.preventDefault();
                this.showKeyboardShortcuts();
            }
        });
    }

    // Show keyboard shortcuts help
    showKeyboardShortcuts() {
        Swal.fire({
            title: 'Atalhos do Teclado',
            html: `
                <div class="shortcuts-help">
                    <div class="shortcut-group">
                        <h4>Navegação</h4>
                        <div class="shortcut-item">
                            <kbd>Alt</kbd> + <kbd>D</kbd> - Voltar ao Dashboard
                        </div>
                        <div class="shortcut-item">
                            <kbd>Esc</kbd> - Fechar modal
                        </div>
                    </div>
                    
                    <div class="shortcut-group">
                        <h4>Ações</h4>
                        <div class="shortcut-item">
                            <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd> - Novo Board
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl</kbd> + <kbd>N</kbd> - Novo Card
                        </div>
                    </div>
                    
                    <div class="shortcut-group">
                        <h4>Ajuda</h4>
                        <div class="shortcut-item">
                            <kbd>Alt</kbd> + <kbd>H</kbd> - Mostrar atalhos
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#4f46e5',
            width: '500px'
        });
    }

    // Show initialization error
    showInitializationError() {
        Swal.fire({
            icon: 'error',
            title: 'Erro de Inicialização',
            text: 'Ocorreu um erro ao inicializar a aplicação. Tente recarregar a página.',
            confirmButtonText: 'Recarregar',
            confirmButtonColor: '#4f46e5'
        }).then(() => {
            window.location.reload();
        });
    }

    // Handle application errors
    handleError(error, context = 'aplicação') {
        console.error(`Error in ${context}:`, error);
        
        if (error.status === 401) {
            // Let auth manager handle 401 errors
            return;
        }
        
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: `Ocorreu um erro na ${context}. Tente novamente.`,
            confirmButtonText: 'OK',
            confirmButtonColor: '#4f46e5'
        });
    }

    // Update page title based on current view
    updatePageTitle() {
        let title = 'Kanban Board';
        
        if (this.currentView === 'board' && boardManager.currentBoard) {
            title = `${boardManager.currentBoard.title} - Kanban Board`;
        } else if (this.currentView === 'dashboard') {
            title = 'Dashboard - Kanban Board';
        }
        
        document.title = title;
    }
}

// Create global app instance
const app = new KanbanApp();

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Add CSS for SweetAlert2 customizations
    const style = document.createElement('style');
    style.textContent = `
        .swal-form {
            text-align: left;
        }
        
        .swal-form .form-group {
            margin-bottom: 1rem;
        }
        
        .swal-form label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: var(--text-primary);
        }
        
        .shortcuts-help {
            text-align: left;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .shortcut-group {
            margin-bottom: 1.5rem;
        }
        
        .shortcut-group h4 {
            margin-bottom: 0.5rem;
            color: var(--primary);
        }
        
        .shortcut-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.25rem 0;
            border-bottom: 1px solid var(--border);
        }
        
        .shortcut-item:last-child {
            border-bottom: none;
        }
        
        kbd {
            background: var(--border);
            border: 1px solid var(--text-secondary);
            border-radius: 3px;
            padding: 2px 6px;
            font-size: 0.8em;
            font-family: monospace;
        }
        
        .context-menu {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            padding: 0.5rem 0;
            min-width: 150px;
        }
        
        .context-menu-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            cursor: pointer;
            transition: var(--transition);
        }
        
        .context-menu-item:hover {
            background: var(--surface-hover);
        }
        
        .context-menu-item.danger:hover {
            background: var(--error);
            color: white;
        }
        
        .card-history {
            max-height: 400px;
            overflow-y: auto;
            text-align: left;
        }
        
        .history-entry {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            border-bottom: 1px solid var(--border);
        }
        
        .history-entry:last-child {
            border-bottom: none;
        }
        
        .history-icon {
            font-size: 1.2em;
            opacity: 0.7;
        }
        
        .history-content {
            flex: 1;
        }
        
        .history-description {
            font-weight: 500;
            margin-bottom: 0.25rem;
        }
        
        .history-meta {
            font-size: 0.875rem;
            color: var(--text-secondary);
        }
    `;
    document.head.appendChild(style);
    
    // Initialize the app
    await app.init();
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    app.handleError(event.error, 'aplicação');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (event.reason && event.reason.status !== 401) {
        app.handleError(event.reason, 'requisição');
    }
});

// Service worker registration for offline capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}