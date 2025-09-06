<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Card;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

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

    public function update(Request $request, Card $card)
    {
        // Opcional: Adicionar uma verificação de permissão mais granular
        // if ($request->user()->id !== $card->created_by && !$card->board->isOwnedBy($request->user())) {
        //     return response()->json(['message' => 'Você não tem permissão para editar este card.'], 403);
        // }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:120',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $card->update($request->only('title', 'description'));

        MoveHistory::logUpdated($card, $request->user());

        return response()->json($card);
    }

    /**
     * Move um card para outra coluna.
     * Este é um endpoint customizado, conforme o frontend `api.js`.
     */
    public function move(Request $request, Card $card)
    {
        $validator = Validator::make($request->all(), [
            'to_column_id' => [
                'required',
                'integer',
                Rule::exists('columns', 'id')->where('board_id', $card->board_id),
            ],
            'position' => 'required|string|in:top,bottom',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $fromColumnId = $card->column_id;
        $toColumn = Column::find($request->to_column_id);

        if ($fromColumnId == $toColumn->id) {
            return response()->json(['message' => 'O card já está nesta coluna.'], 400);
        }
        
        if ($toColumn->isAtWipLimit()) {
            return response()->json([
                'message' => 'Limite de WIP atingido para a coluna de destino.',
                'error' => ['code' => 'WIP_LIMIT_REACHED']
            ], 422);
        }

        if ($request->position === 'top') {
            $card->moveToTop($toColumn); // Método do Model Card
        } else {
            $card->moveToBottom($toColumn); // Método do Model Card
        }
        
        MoveHistory::logMoved($card, $fromColumnId, $toColumn->id, $request->user());

        return response()->json($card);
    }


    /**
     * Exclui um card.
     */
    public function destroy(Request $request, Card $card)
    {
        // Opcional: Verificação de permissão
        // if ($request->user()->id !== $card->created_by && !$card->board->isOwnedBy($request->user())) {
        //     return response()->json(['message' => 'Você não tem permissão para excluir este card.'], 403);
        // }
        
        MoveHistory::logDeleted($card, $request->user());
        $card->delete();

        return response()->json(null, 204);
    }
}