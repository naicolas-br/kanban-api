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

    // Deixe os outros métodos para depois.
}