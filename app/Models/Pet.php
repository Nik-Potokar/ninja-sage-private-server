<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Pet extends Model
{
    use HasFactory;

    protected $fillable = [
        'pet_id',
        'name',
        'swf',
        'price_gold',
        'price_tokens',
        'premium',
        'skills',
        'icon',
    ];

    protected $casts = [
        'premium' => 'boolean',
        'skills' => 'array'
    ];

    public function calculateSkillsString($level)
    {
        if (empty($this->skills)) {
            $levels = [1, 10, 20, 30, 40, 50];
            $status = [];
            foreach ($levels as $lvl) {
                $status[] = ($level >= $lvl) ? 1 : 0;
            }
            return implode(',', $status);
        }

        $status = [];
        foreach ($this->skills as $skill) {
            $reqLevel = $skill['level'] ?? 1;
            $status[] = ($level >= $reqLevel) ? 1 : 0;
        }
        
        while (count($status) < 6) {
            $status[] = 0;
        }

        return implode(',', $status);
    }
}