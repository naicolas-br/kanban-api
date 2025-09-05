<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\Board; // Importar o Model Board
use App\Models\Column; // Importar o Model Column

class EnsureBoardOwner
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        $board = null;

        // Tenta obter o board a partir do parâmetro da rota
        if ($request->route('board')) { // Ex: /boards/{board}/columns
            $board = $request->route('board');
        } elseif ($request->route('id')) { // Ex: /boards/{id}
             $board = Board::find($request->route('id'));
        } elseif ($request->route('column')) { // Ex: /columns/{column}
            $column = $request->route('column');
            $board = $column ? $column->board : null;
        }


        if (!$board || !$board instanceof Board) {
             return response()->json(['message' => 'Quadro não encontrado.'], 404);
        }

        // O método isOwnedBy já existe no seu model Board!
        if (!$board->isOwnedBy($user)) {
            return response()->json(['message' => 'Acesso negado. Apenas o dono do quadro pode realizar esta ação.'], 403);
        }

        return $next($request);
    }
}