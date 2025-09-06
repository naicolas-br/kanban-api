<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    /**
     * Lida com a tentativa de login do usuário.
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Credenciais inválidas'], 401);
        }

        // A lógica de criação de token já está no seu Model User
        $tokenData = $user->createToken($request->ip(), $request->userAgent());

        return response()->json([
            'user' => $user->only('id', 'name', 'email'),
            'access_token' => $tokenData['access_token'],
            'refresh_token' => $tokenData['refresh_token'],
            'expires_at' => $tokenData['expires_at'],
        ]);
    }

    /**
     * Invalida o token de acesso do usuário (Logout).
     */
    public function logout(Request $request)
    {
        // O middleware 'auth.token' já garante que temos um usuário.
        $user = $request->user();
        $token = $request->bearerToken();

        $user->revokeToken($token); // Método do Model User

        return response()->json(['message' => 'Logout realizado com sucesso']);
    }

    /**
     * Renova o token de acesso usando um refresh token.
     */
    public function refresh(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'refresh_token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // A lógica de renovação também está no seu Model User
        // O método refreshToken precisa ser encontrado ou implementado no model User.php
        // Supondo que você tenha um método findUserByRefreshToken
        $user = User::findUserByRefreshToken($request->refresh_token);
        
        if (!$user) {
             return response()->json(['message' => 'Refresh token inválido ou expirado'], 401);
        }

        $tokenData = $user->refreshToken($request->refresh_token);

        if(!$tokenData) {
            return response()->json(['message' => 'Refresh token inválido ou expirado'], 401);
        }

        return response()->json([
            'access_token' => $tokenData['access_token'],
            'refresh_token' => $tokenData['refresh_token'], // O refresh token pode ou não ser renovado
            'expires_at' => $tokenData['expires_at'],
        ]);
    }

    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        // Opcional: Logar o usuário automaticamente após o cadastro
        $tokenData = $user->createToken($request->ip(), $request->userAgent());

        return response()->json([
            'user' => $user->only('id', 'name', 'email'),
            'access_token' => $tokenData['access_token'],
            'refresh_token' => $tokenData['refresh_token'],
        ], 201);
    }

}