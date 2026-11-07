<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#10130f">
    <title>Ninja Sage — Cliente web</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    <main id="game-client" aria-live="polite">
        <p class="boot-message">Preparando el dojo…</p>
    </main>
</body>
</html>
