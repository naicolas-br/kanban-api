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
}