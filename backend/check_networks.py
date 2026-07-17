#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nms_project.settings')
django.setup()

from monitoring.models import Network, Region, County

print('Networks:', Network.objects.count())
for n in Network.objects.all():
    print(f'  - {n.name}: {n.regions.count()} regions')

print('\nOGN Network details:')
ogn = Network.objects.filter(name='OGN').first()
if ogn:
    print(f'OGN has {ogn.regions.count()} regions')
    for region in ogn.regions.all()[:2]:
        print(f'  Region {region.name}: network={region.network.name if region.network else "None"}')
        print(f'    Counties: {region.counties.count()}')
        for county in region.counties.all()[:1]:
            print(f'      - {county.name}')
