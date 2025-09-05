<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Board;
use Illuminate\Http\Request;
// ... outros imports

class BoardController extends Controller
{
    /**
     * Lista todos os quadros (endpoint público).
     */
    public function index()
    {
        // O frontend espera as contagens, então vamos otimizar a query
        $boards = Board::with('owner:id,name') // Carrega apenas id e nome do dono
            ->withCount(['columns', 'cards'])
            ->latest() // Ordena pelos mais recentes
            ->get();
            
        return response()->json($boards);
    }

    /**
     * Mostra os detalhes completos de um quadro (endpoint público).
     */
    public function show(Board $board) // Laravel faz o findOrFail($id) automaticamente
    {
        // O frontend precisa de todas as colunas e cards aninhados
        $board->load([
            'owner:id,name', 
            'columns' => function ($query) {
                $query->orderBy('order');
            },
            'cards.creator:id,name' // Carrega o criador de cada card
        ]);

        // Reorganiza os cards dentro de suas respectivas colunas para facilitar para o frontend
        $columns = $board->columns->map(function ($column) use ($board) {
            $column->cards = $board->cards->where('column_id', $column->id)->values();
            return $column;
        });

        // Retorna um objeto de board com as colunas já contendo os cards
        return response()->json([
            'id' => $board->id,
            'title' => $board->title,
            'description' => $board->description,
            'owner' => $board->owner,
            'columns' => $columns,
        ]);
    }
    
    // Deixe os outros métodos (store, update, destroy) para a próxima etapa.
}