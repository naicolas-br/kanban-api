<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Column;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ColumnController extends Controller
{
    /**
     * Adiciona uma nova coluna a um quadro.
     * Requer que o usuário seja o dono do quadro.
     */
    public function store(Request $request, Board $board)
    {
        // A autorização já foi feita pelo middleware 'owner' na rota
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:40',
            'wip_limit' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $column = $board->columns()->create([
            'name' => $request->name,
            'wip_limit' => $request->wip_limit,
            'order' => $board->columns()->max('order') + 1, // Adiciona no final
        ]);

        return response()->json($column, 201);
    }

    public function update(Request $request, Column $column)
    {
        // A autorização já foi feita pelo middleware 'owner'
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:40',
            'wip_limit' => 'sometimes|required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $column->update($request->only('name', 'wip_limit'));

        return response()->json($column);
    }

    /**
     * Exclui uma coluna.
     * Requer que o usuário seja o dono do quadro.
     */
    public function destroy(Column $column)
    {
        // A autorização já foi feita pelo middleware 'owner'
        // Cuidado: cards nesta coluna serão excluídos em cascata pelo banco de dados.
        // Se a regra de negócio fosse mover os cards, a lógica seria mais complexa aqui.
        $column->delete();

        return response()->json(null, 204);
    }
    
}