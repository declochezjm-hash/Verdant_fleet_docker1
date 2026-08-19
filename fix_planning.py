#!/usr/bin/env python3
import sys

# Lire le fichier
with open('D:\\CODE\\verdant-fleet\\verdant-fleet-docker1\\src\\components\\views\\planning-supabase-view.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Garder seulement les 76 premières lignes
new_content = ''.join(lines[:76])

# Écrire le fichier
with open('D:\\CODE\\verdant-fleet\\verdant-fleet-docker1\\src\\components\\views\\planning-supabase-view.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Fichier tronqué à {len(lines[:76])} lignes")
