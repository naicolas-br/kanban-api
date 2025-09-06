<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('personal_access_tokens', function (Blueprint $table) {
        $table->id();
        $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
        $table->string('token_hash')->unique();
        $table->string('refresh_token_hash')->unique();
        
        // CORREÇÃO: Adicionado nullable() para compatibilidade
        $table->timestamp('expires_at')->nullable();
        $table->timestamp('refresh_expires_at')->nullable();
        $table->timestamp('last_used_at')->nullable();
        
        $table->string('ip_address')->nullable();
        $table->text('user_agent')->nullable();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
    }
};