#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nms_project.settings')
django.setup()

from monitoring.models import Network, Region

n = Network.objects.first()
if n:
    print(f'Network: {n.name}')
    print(f'Regions in this network: {n.regions.count()}')
    for r in n.regions.all()[:3]:
        print(f'  - {r.name} ({r.counties.count()} counties)')
else:
    print('No networks found')
