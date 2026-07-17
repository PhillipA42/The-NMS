#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nms_project.settings')
django.setup()

from django.test import Client
import json

client = Client()
response = client.get('/api/sidebar-tree/')
data = response.json()

print("Response Status:", response.status_code)
print("\nRoot keys:", list(data[0].keys()) if data else "No data")
if data and 'regions' in data[0]:
    print("Number of regions:", len(data[0]['regions']))
    if data[0]['regions']:
        first_region = data[0]['regions'][0]
        print("\nFirst region:", json.dumps(first_region, indent=2))
    else:
        print("Regions list is empty")
else:
    print("Full payload:", json.dumps(data[0] if data else {}, indent=2)[:1000])
