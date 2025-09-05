<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Card;
use Illuminate\Http\Request;
// ... outros imports

class CardController extends Controller
{
    /**
     * Mostra os detalhes de um card (endpoint público).
     */
    public function show(Card $card)
    {
        $card->load(['creator:id,name', 'column:id,name']);
        return response()->json($card);
    }

    public function store(Request $request, Board $board)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:120',
            'description' => 'nullable|string',
            'column_id' => [
                'required',
                'integer',
                // Garante que a coluna pertence ao quadro correto
                Rule::exists('columns', 'id')->where('board_id', $board->id),
            ],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $column = Column::find($request->column_id);

        // Regra de Negócio: Verificar limite de WIP
        if ($column->isAtWipLimit()) { // Método do Model Column
            return response()->json([
                'message' => 'Limite de WIP atingido para esta coluna.',
                'error' => ['code' => 'WIP_LIMIT_REACHED']
            ], 422); // 422 Unprocessable Entity é apropriado aqui
        }

        $card = $column->cards()->create([
            'title' => $request->title,
            'description' => $request->description,
            'board_id' => $board->id,
            'created_by' => $request->user()->id,
            'position' => $column->cards()->max('position') + 1,
        ]);
        
        // Regra de Negócio: Implementar sistema de histórico automático
        MoveHistory::logCreated($card, $request->user()); // Método do Model MoveHistory

        return response()->json($card->load('creator:id,name'), 201);
    }
}