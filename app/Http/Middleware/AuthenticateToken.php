<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\User; // Importar o Model User

class AuthenticateToken
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['message' => 'Token de acesso é obrigatório.'], 401);
        }

        // O método findByToken já valida a expiração do token
        $user = User::findByToken($token);

        if (!$user) {
            return response()->json(['message' => 'Token inválido ou expirado.'], 401);
        }

        // Anexa o usuário autenticado à requisição
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}