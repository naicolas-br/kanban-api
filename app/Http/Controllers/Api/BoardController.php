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
        // Carrega os quadros com o dono e suas colunas.
        // Para cada coluna, também contamos quantos cards ela tem.
        $boards = Board::with([
            'owner:id,name', 
            'columns' => function ($query) {
                $query->withCount('cards'); // Adiciona a propriedade 'cards_count' a cada coluna
            }
        ])->latest()->get();

        // O frontend espera uma propriedade 'count' em cada coluna, não 'cards_count'.
        // Vamos transformar a coleção para corresponder exatamente ao que o JS precisa.
        $boards->transform(function ($board) {
            $board->columns->transform(function ($column) {
                // Renomeia 'cards_count' para 'count'
                $column->count = $column->cards_count;
                unset($column->cards_count); // Remove a propriedade original
                return $column;
            });
            return $board;
        });
            
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
    
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:80',
            'description' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user(); // O middleware 'auth.token' nos dá o usuário

        $board = $user->boards()->create([
            'title' => $request->title,
            'description' => $request->description,
        ]);

        // Regra de Negócio: Todo board nasce com 3 colunas padrão
        $board->columns()->create(['name' => 'To Do', 'order' => 1, 'wip_limit' => 999]);
        $board->columns()->create(['name' => 'Doing', 'order' => 2, 'wip_limit' => 3]); // Limite padrão de 3 para "Doing"
        $board->columns()->create(['name' => 'Done', 'order' => 3, 'wip_limit' => 999]);

        return response()->json($board->load('columns'), 201);
    }

    public function update(Request $request, Board $board)
    {
        // A autorização já foi feita pelo middleware 'owner'
        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:80',
            'description' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $board->update($request->only('title', 'description'));

        return response()->json($board);
    }

    /**
     * Exclui um quadro e todos os seus conteúdos.
     * Requer que o usuário seja o dono do quadro.
     */
    public function destroy(Board $board)
    {
        // A autorização já foi feita pelo middleware 'owner'
        $board->delete();

        return response()->json(null, 204); // 204 No Content
    }

}