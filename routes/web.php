<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AmfController;

Route::get('/', function () {
    return view('client');
});

// AMF Gateway Routes
Route::any('/amf', [AmfController::class, 'handle']);
Route::any('/gateway.php', [AmfController::class, 'handle']);
