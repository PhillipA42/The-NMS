#!/usr/bin/env python
import os
import django
import json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nms_project.settings')
django.setup()

from django.test import Client

client = Client()
response = client.get('/api/sidebar-tree/')
data = response.json()

print("Response Status:", response.status_code)
print("\nFull Payload:")
print(json.dumps(data, indent=2)[:2000])

if data and len(data) > 0:
    root = data[0]
    print(f"\nRoot name: {root.get('name')}")
    print(f"Has regions: {'regions' in root}")
    print(f"Regions count: {len(root.get('regions', []))}")
    if root.get('regions'):
        print(f"First region: {root['regions'][0].get('name')}")
        print(f"First region counties: {len(root['regions'][0].get('counties', []))}")
