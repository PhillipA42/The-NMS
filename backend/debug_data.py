#!/usr/bin/env python
import os
import django
import json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nms_project.settings')
django.setup()

from monitoring.models import Network, Region, County

# Get OGN network
ogn_network = Network.objects.filter(name='OGN').prefetch_related('regions__counties').first()

print(f"OGN Network found: {ogn_network is not None}")
if ogn_network:
    print(f"OGN Network name: {ogn_network.name}")
    print(f"Regions in OGN: {ogn_network.regions.count()}")
    
    regions_list = []
    for region in ogn_network.regions.all()[:3]:
        print(f"\n  Region: {region.name}")
        print(f"  Counties in region: {region.counties.count()}")
        
        for county in region.counties.all()[:2]:
            print(f"    - County: {county.name}")
