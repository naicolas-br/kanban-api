<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BoardController;
use App\Http\Controllers\Api\ColumnController;
use App\Http\Controllers\Api\CardController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// --- 1. Endpoints de Autenticação ---
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/refresh', [AuthController::class, 'refresh']);

// --- 2. Endpoints Públicos (sem token) ---
Route::get('/boards', [BoardController::class, 'index']);
Route::get('/boards/{board}', [BoardController::class, 'show']); // Usando Route Model Binding
Route::get('/cards/{card}', [CardController::class, 'show']);   // Usando Route Model Binding

// --- 3. Endpoints Privados (requerem token válido) ---
Route::middleware('auth.token')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // --- Boards (Apenas owner pode modificar) ---
    Route::post('/boards', [BoardController::class, 'store']); // Criar board

    Route::middleware('owner')->group(function() {
        Route::patch('/boards/{board}', [BoardController::class, 'update']);
        Route::delete('/boards/{board}', [BoardController::class, 'destroy']);
    });

    // --- Colunas (Apenas owner pode modificar) ---
    Route::post('/boards/{board}/columns', [ColumnController::class, 'store'])->middleware('owner');

    Route::middleware('owner')->group(function() {
         Route::patch('/columns/{column}', [ColumnController::class, 'update']);
         Route::delete('/columns/{column}', [ColumnController::class, 'destroy']);
    });


    // --- Cards (Qualquer usuário logado) ---
    Route::post('/boards/{board}/cards', [CardController::class, 'store']);
    Route::patch('/cards/{card}', [CardController::class, 'update']);
    Route::delete('/cards/{card}', [CardController::class, 'destroy']);
    Route::post('/cards/{card}/move', [CardController::class, 'move']); // Endpoint de movimentação
});