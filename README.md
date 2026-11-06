<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## Cliente web inicial

Este repositorio incluye un cliente web mínimo en `/` que se conecta al gateway AMF real (`/amf`) para registrar e iniciar sesión, crear y seleccionar personajes, consultar sus datos e iniciar misiones. El catálogo de misiones y enemigos se carga desde los JSON incluidos en `public/game_data`; no necesita ni descarga recursos gráficos externos.

### Ejecutar localmente

Requisitos: PHP 8.2 o posterior, Composer, Node.js y npm.

1. Instala dependencias y prepara la configuración:

   ```sh
   composer install
   cp .env.example .env
   php artisan key:generate
   ```

   Configura la conexión a la base de datos en `.env` y ejecuta `php artisan migrate`.

2. Carga los catálogos incluidos:

   ```sh
   php artisan db:seed --class=GameDataSeeder
   ```

   `GameDataSeeder` reemplaza las tablas de catálogos del juego (misiones, enemigos, habilidades, objetos y otros datos importados). No lo ejecutes sobre esos catálogos si necesitas conservar cambios propios.

3. Compila el cliente e inicia Laravel:

   ```sh
   npm ci
   npm run build
   php artisan serve
   ```

4. Abre `http://127.0.0.1:8000`, crea una cuenta, crea tu personaje y elige una misión disponible para iniciar. El usuario y la clave se validan mediante `SystemLogin.loginUser`; la clave de sesión se conserva solo en la pestaña actual y se elimina localmente al salir. El gateway no ofrece una operación para revocar la sesión en el servidor.

Para comprobar el cliente y el protocolo AMF:

```sh
npm run test:client
npm run build
php artisan test
```

### Límite del flujo de juego

El backend valida `BattleSystem.startMission` y devuelve un token de misión. Aunque existe una operación `finishMission`, no hay acciones de combate por turnos ni una resolución de combate verificada por el servidor; por eso el cliente muestra los objetivos de la misión iniciada, pero no simula victorias ni llama a la operación de recompensas como atajo. El token de una misión activa tampoco se puede recuperar mediante una operación de reanudación existente.

Para despliegues no locales, sirve el cliente y el gateway por HTTPS: el transporte del navegador es la protección de las credenciales y de la clave de sesión.

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework. You can also check out [Laravel Learn](https://laravel.com/learn), where you will be guided through building a modern Laravel application.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com)**
- **[Tighten Co.](https://tighten.co)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Redberry](https://redberry.international/laravel-development)**
- **[Active Logic](https://activelogic.com)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
